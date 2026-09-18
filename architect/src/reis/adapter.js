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
import { collectieContext } from './collectie.js'
import { stemSessie, stemTekst } from './api.js'

const SYSTEEM = PERSOONLIJKHEID + '\n\n' + collectieContext()

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

// ---- bewaking van het spraakgesprek ----

// Er loopt nooit meer dan een response-generatie tegelijk: zolang de
// Architect antwoordt wordt een nieuwe aanvraag gebundeld tot precies
// een vervolg (na meerdere function calls in een beurt volgt dus een
// antwoord, niet drie). Twee stemmen tegelijk is daarmee technisch
// onmogelijk aan onze kant.
export function maakResponseManager(stuur) {
  let actief = false, wachtend = false
  const klaarTypes = ['response.done', 'response.cancelled', 'response.failed', 'response.incomplete']
  return {
    vraag() {
      if (actief) { wachtend = true; return }
      actief = true
      stuur({ type: 'response.create' })
    },
    // een nieuwe gebruikersbeurt onderbreekt eerst netjes de lopende
    onderbreek() { if (actief) stuur({ type: 'response.cancel' }) },
    event(type) {
      if (type === 'response.created') actief = true
      if (klaarTypes.includes(type)) {
        actief = false
        if (wachtend) { wachtend = false; actief = true; stuur({ type: 'response.create' }) }
      }
    },
    isActief: () => actief,
  }
}

// dezelfde gebruikersbeurt mag nooit twee keer in het gesprek landen
export function isDubbeleBeurt(vorige, tekst, nu = Date.now()) {
  return !!vorige && vorige.tekst.trim() === (tekst || '').trim() && nu - vorige.om < 2500
}

// de verwerking van Realtime-events, los van WebRTC zodat de
// gesprekstest hem met nagespeelde events kan controleren
export function maakEventVerwerker({ stuur, rm, onTranscript, onFunctionCall }) {
  let architectBuffer = ''
  let laatsteKlant = null
  const gezienItems = new Set()
  return async ev => {
    const t = ev.type || ''
    rm.event(t)
    if (t.endsWith('audio_transcript.delta')) {
      architectBuffer += ev.delta || ''
      onTranscript('architect', architectBuffer, false)
    } else if (t.endsWith('audio_transcript.done')) {
      onTranscript('architect', ev.transcript || architectBuffer, true)
      architectBuffer = ''
    } else if (t === 'conversation.item.input_audio_transcription.completed') {
      if (ev.item_id) {
        if (gezienItems.has(ev.item_id)) return
        gezienItems.add(ev.item_id)
      }
      const tekst = ev.transcript || ''
      if (isDubbeleBeurt(laatsteKlant, tekst)) return
      laatsteKlant = { tekst, om: Date.now() }
      onTranscript('klant', tekst, true)
    } else if (t === 'response.function_call_arguments.done') {
      let args = {}
      try { args = JSON.parse(ev.arguments || '{}') } catch { /* leeg */ }
      const resultaat = await onFunctionCall(ev.name, args)
      stuur({
        type: 'conversation.item.create',
        item: { type: 'function_call_output', call_id: ev.call_id, output: JSON.stringify(resultaat) },
      })
      rm.vraag()
    }
  }
}

// ---- Realtime: spraak in en uit via WebRTC ----
export function maakRealtimeAdapter({ token, stemOverride, sprekenBijStart }) {
  const a = basis()
  let pc = null, dc = null, micStroom = null, audioEl = null, klok = null

  const stuur = obj => { if (dc && dc.readyState === 'open') dc.send(JSON.stringify(obj)) }
  const rm = maakResponseManager(stuur)

  a.start = async () => {
    a.onStatus('start')
    // eerst de microfoon: een weigering kost dan geen spreektijd van
    // het dagplafond
    micStroom = await navigator.mediaDevices.getUserMedia({ audio: true })
    const s = await stemSessie(token) // kortlevend token van de eigen API
    pc = new RTCPeerConnection()
    audioEl = document.createElement('audio')
    audioEl.autoplay = true
    pc.ontrack = e => { audioEl.srcObject = e.streams[0] }
    for (const spoor of micStroom.getTracks()) pc.addTrack(spoor, micStroom)
    dc = pc.createDataChannel('oai-events')
    dc.onopen = () => {
      // de server configureert de sessie al volledig bij de token-
      // uitgifte; deze update (GA-schema, met session.type) is de
      // stemkeuze plus verdediging in de diepte
      stuur({
        type: 'session.update',
        session: {
          type: 'realtime',
          instructions: SYSTEEM,
          tools: FUNCTIES.map(f => ({ type: 'function', ...f })),
          audio: {
            input: { transcription: { model: 'whisper-1' } },
            ...(stemOverride ? { output: { voice: stemOverride } } : {}),
          },
        },
      })
      // bij het ontmoeten spreekt de Architect direct de welkomsttekst
      if (sprekenBijStart) rm.vraag()
      a.onStatus('luistert')
    }
    const verwerk = maakEventVerwerker({
      stuur, rm,
      onTranscript: (rol, tekst, definitief) => a.onTranscript(rol, tekst, definitief),
      onFunctionCall: (naam, args) => a.onFunctionCall(naam, args),
    })
    dc.onmessage = e => {
      let ev
      try { ev = JSON.parse(e.data) } catch { return }
      verwerk(ev)
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
    // een nieuwe beurt onderbreekt eerst netjes een lopend antwoord
    rm.onderbreek()
    stuur({
      type: 'conversation.item.create',
      item: { type: 'message', role: 'user', content: [{ type: 'input_text', text: tekst }] },
    })
    rm.vraag()
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
