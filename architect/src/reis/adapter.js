// Adapterlaag voor de Stem-Architect. Een klein contract met drie
// invullingen: Realtime (spraak via WebRTC), tekst (chat via de eigen
// API) en test (scripted dialoog voor de gesprekstests, zonder audio en
// zonder API-kosten). Zodra de GPT-Live-API opent komt er alleen een
// vierde invulling van ditzelfde contract bij.
//
// Contract:
//   const a = maakXAdapter(opties)
//   a.onTranscript = (rol, tekst, definitief) => {}   rol: 'architect'|'klant'
//   a.onFunctionCall = async (naam, args) => resultaat
//   a.onStatus = status => {}   'start'|'luistert'|'spreekt'|'gestopt'|'fout:...'
//   await a.start()
//   await a.zegTekst('...')      een tekstbeurt van de klant
//   a.stop()
import { PERSOONLIJKHEID, FUNCTIES } from './persoonlijkheid.js'
import { stemSessie, stemTekst } from './api.js'

function basis() {
  return {
    onTranscript: () => {}, onFunctionCall: async () => ({ ok: false }), onStatus: () => {},
    async start() {}, async zegTekst() {}, stop() {},
  }
}

// ---- tekst: hetzelfde gesprek via chat completions op de eigen API ----
export function maakTekstAdapter({ token }) {
  const a = basis()
  const berichten = []
  let bezig = false
  a.start = async () => { a.onStatus('start') }
  a.zegTekst = async tekst => {
    if (bezig) return
    bezig = true
    try {
      a.onTranscript('klant', tekst, true)
      berichten.push({ role: 'user', content: tekst })
      for (let ronde = 0; ronde < 5; ronde++) {
        a.onStatus('spreekt')
        const uit = await stemTekst(token, berichten)
        if (uit.ruw) berichten.push(uit.ruw)
        if (uit.tekst) a.onTranscript('architect', uit.tekst, true)
        if (!uit.functieAanroepen || uit.functieAanroepen.length === 0) break
        for (const fc of uit.functieAanroepen) {
          const resultaat = await a.onFunctionCall(fc.naam, fc.args)
          berichten.push({ role: 'tool', tool_call_id: fc.id, content: JSON.stringify(resultaat) })
        }
      }
      a.onStatus('luistert')
    } catch (e) {
      a.onStatus('fout:' + (e.status || '') + ':' + (e.message || e))
    } finally { bezig = false }
  }
  return a
}

// ---- Realtime: spraak in en uit via WebRTC ----
export function maakRealtimeAdapter({ token, stemOverride }) {
  const a = basis()
  let pc = null, dc = null, micStroom = null, audioEl = null, klok = null

  const stuur = obj => { if (dc && dc.readyState === 'open') dc.send(JSON.stringify(obj)) }

  a.start = async () => {
    a.onStatus('start')
    const s = await stemSessie(token) // kortlevend token van de eigen API
    micStroom = await navigator.mediaDevices.getUserMedia({ audio: true })
    pc = new RTCPeerConnection()
    audioEl = document.createElement('audio')
    audioEl.autoplay = true
    pc.ontrack = e => { audioEl.srcObject = e.streams[0] }
    for (const spoor of micStroom.getTracks()) pc.addTrack(spoor, micStroom)
    dc = pc.createDataChannel('oai-events')
    dc.onopen = () => {
      stuur({
        type: 'session.update',
        session: {
          instructions: PERSOONLIJKHEID,
          tools: FUNCTIES.map(f => ({ type: 'function', ...f })),
          input_audio_transcription: { model: 'whisper-1' },
          ...(stemOverride ? { audio: { output: { voice: stemOverride } } } : {}),
        },
      })
      a.onStatus('luistert')
    }
    let architectBuffer = ''
    dc.onmessage = async e => {
      let ev
      try { ev = JSON.parse(e.data) } catch { return }
      const t = ev.type || ''
      if (t.endsWith('audio_transcript.delta')) {
        architectBuffer += ev.delta || ''
        a.onTranscript('architect', architectBuffer, false)
      } else if (t.endsWith('audio_transcript.done')) {
        a.onTranscript('architect', ev.transcript || architectBuffer, true)
        architectBuffer = ''
      } else if (t === 'conversation.item.input_audio_transcription.completed') {
        a.onTranscript('klant', ev.transcript || '', true)
      } else if (t === 'response.function_call_arguments.done') {
        let args = {}
        try { args = JSON.parse(ev.arguments || '{}') } catch { /* leeg */ }
        const resultaat = await a.onFunctionCall(ev.name, args)
        stuur({
          type: 'conversation.item.create',
          item: { type: 'function_call_output', call_id: ev.call_id, output: JSON.stringify(resultaat) },
        })
        stuur({ type: 'response.create' })
      }
    }
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    // GA-endpoint eerst, oudere vorm als terugval
    const vraag = async url => fetch(url, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + s.clientSecret, 'Content-Type': 'application/sdp' },
      body: offer.sdp,
    })
    let sdpAntwoord = await vraag('https://api.openai.com/v1/realtime/calls?model=' + encodeURIComponent(s.model))
    if (!sdpAntwoord.ok) sdpAntwoord = await vraag('https://api.openai.com/v1/realtime?model=' + encodeURIComponent(s.model))
    if (!sdpAntwoord.ok) throw new Error('realtime-verbinding geweigerd (' + sdpAntwoord.status + ')')
    await pc.setRemoteDescription({ type: 'answer', sdp: await sdpAntwoord.text() })
    // kostenrem aan de clientkant: na de maximale duur netjes stoppen
    klok = setTimeout(() => { a.stop(); a.onStatus('fout:tijd:maximale gespreksduur bereikt') }, s.maxMinuten * 60000)
  }

  a.zegTekst = async tekst => {
    a.onTranscript('klant', tekst, true)
    stuur({
      type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: tekst }] },
    })
    stuur({ type: 'response.create' })
  }

  a.stop = () => {
    if (klok) clearTimeout(klok)
    if (micStroom) micStroom.getTracks().forEach(sp => sp.stop())
    if (dc) try { dc.close() } catch { /* al dicht */ }
    if (pc) try { pc.close() } catch { /* al dicht */ }
    pc = dc = micStroom = null
    a.onStatus('gestopt')
  }
  return a
}

// ---- test: scripted dialoog voor de gesprekstests ----
// script: per klantbeurt een lijst architect-acties:
//   { zeg: '...' }                       de architect spreekt (ondertitel)
//   { functie: { naam, args } }          de architect roept een functie aan
export function maakTestAdapter({ script }) {
  const a = basis()
  let beurt = 0
  a.start = async () => { a.onStatus('start') }
  a.zegTekst = async tekst => {
    a.onTranscript('klant', tekst, true)
    const acties = script[beurt++] || []
    for (const actie of acties) {
      if (actie.zeg) a.onTranscript('architect', actie.zeg, true)
      if (actie.functie) await a.onFunctionCall(actie.functie.naam, actie.functie.args)
    }
    a.onStatus('luistert')
  }
  return a
}
