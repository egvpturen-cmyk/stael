// Proefopnames voor de stemkeuze van de Architect: laat elke
// kandidaatstem van de Realtime API dezelfde Nederlandse zinnen spreken
// en schrijf ze als wav naar schermen/stemmen/. Draaien met:
//   OPENAI_API_KEY=sk-... node scripts/stem-proef.mjs
// In de browser kan het ook live: /reis?stem=<naam> gebruikt die stem.
import fs from 'fs'

const SLEUTEL = process.env.OPENAI_API_KEY
if (!SLEUTEL) {
  console.log('Geen OPENAI_API_KEY gezet; zet de sleutel en draai opnieuw.')
  console.log('Kandidaten: marin, cedar, alloy, ash, ballad, coral, echo, sage, shimmer, verse')
  process.exit(0)
}

const STEMMEN = ['marin', 'cedar', 'alloy', 'ash', 'ballad', 'coral', 'echo', 'sage', 'shimmer', 'verse']
const ZIN = 'Welkom bij STAEL. Ik ben de Architect en ik neem u in vier stappen mee naar uw woning. Zullen we beginnen met uw smaak?'
const MODEL = process.env.STEM_MODEL || 'gpt-realtime'
fs.mkdirSync('schermen/stemmen', { recursive: true })

function wavKop(lengte, rate = 24000) {
  const b = Buffer.alloc(44)
  b.write('RIFF', 0); b.writeUInt32LE(36 + lengte, 4); b.write('WAVE', 8)
  b.write('fmt ', 12); b.writeUInt32LE(16, 16); b.writeUInt16LE(1, 20); b.writeUInt16LE(1, 22)
  b.writeUInt32LE(rate, 24); b.writeUInt32LE(rate * 2, 28); b.writeUInt16LE(2, 32); b.writeUInt16LE(16, 34)
  b.write('data', 36); b.writeUInt32LE(lengte, 40)
  return b
}

for (const stem of STEMMEN) {
  const stukken = []
  const klaar = await new Promise(resolve => {
    const ws = new WebSocket('wss://api.openai.com/v1/realtime?model=' + MODEL, {
      headers: { Authorization: 'Bearer ' + SLEUTEL },
    })
    const stop = uitkomst => { try { ws.close() } catch { } resolve(uitkomst) }
    const tikker = setTimeout(() => stop('tijd'), 30000)
    ws.onopen = () => {
      ws.send(JSON.stringify({ type: 'session.update', session: { voice: stem, output_audio_format: 'pcm16' } }))
      ws.send(JSON.stringify({
        type: 'response.create',
        response: { modalities: ['audio', 'text'], instructions: 'Zeg exact, in het Nederlands: ' + ZIN },
      }))
    }
    ws.onmessage = e => {
      let ev
      try { ev = JSON.parse(e.data) } catch { return }
      if ((ev.type || '').endsWith('audio.delta') && ev.delta) stukken.push(Buffer.from(ev.delta, 'base64'))
      if (ev.type === 'response.done') { clearTimeout(tikker); stop('ok') }
      if (ev.type === 'error') { clearTimeout(tikker); stop('fout: ' + (ev.error?.message || '')) }
    }
    ws.onerror = () => { clearTimeout(tikker); stop('verbinding') }
  })
  if (klaar === 'ok' && stukken.length) {
    const data = Buffer.concat(stukken)
    fs.writeFileSync('schermen/stemmen/' + stem + '.wav', Buffer.concat([wavKop(data.length), data]))
    console.log(stem, 'ok (' + Math.round(data.length / 48000) + 's)')
  } else {
    console.log(stem, 'niet gelukt:', klaar)
  }
}
console.log('klaar; luister de wav-bestanden in schermen/stemmen/')
