// API-tests onderdeel A: sessie aanmaken, hervatten, bijwerken,
// veldbewaking, en de kostenrem van het stem-endpoint. Draait tegen een
// eigen serverproces met bestandsstore in een tijdelijke map; geen
// database en geen OpenAI nodig (STEM_TEST_MODUS).
import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

const POORT = 18787
const BASIS = 'http://127.0.0.1:' + POORT
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stael-api-'))

const server = spawn(process.execPath, ['server.js'], {
  cwd: new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
  env: {
    ...process.env, PORT: String(POORT), OPSLAG_PAD: tmp,
    STEM_TEST_MODUS: '1', STEM_MAX_SESSIE_MIN: '20', STEM_DAG_PLAFOND_MIN: '60',
    DATABASE_URL: '', OPENAI_API_KEY: '',
  },
  stdio: 'ignore',
})

let fouten = 0
const eis = (naam, conditie, detail) => {
  if (conditie) console.log('ok  |', naam)
  else { fouten++; console.log('FOUT|', naam, detail ?? '') }
}

// wacht tot de server leeft
for (let i = 0; i < 60; i++) {
  try { const r = await fetch(BASIS + '/gezond'); if (r.ok) break } catch { /* nog niet op */ }
  await new Promise(r => setTimeout(r, 250))
}

try {
  // 1. aanmaken
  let r = await fetch(BASIS + '/api/sessies', { method: 'POST' })
  const { token, sessie } = await r.json()
  eis('sessie aanmaken geeft 201 met token', r.status === 201 && typeof token === 'string' && token.length >= 8)
  eis('verse sessie start op stap 0 met leeg smaakprofiel',
    sessie.stap === 0 && Array.isArray(sessie.smaak.favorieten) && sessie.smaak.favorieten.length === 0)

  // 2. hervatten via het deel-token
  r = await fetch(BASIS + '/api/sessies/' + token)
  eis('hervatten via token geeft de sessie terug', r.status === 200 && (await r.json()).sessie.stap === 0)

  // 3. bijwerken per stap
  r = await fetch(BASIS + '/api/sessies/' + token, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      stap: 1,
      smaak: { favorieten: [3, 17], families: { A: 1, D: 1 }, materialen: ['corten'], elementen: ['balkon'], citaten: ['dat roest vind ik prachtig'] },
      notities: [{ stap: 1, tekst: 'houdt van verweerd materiaal' }],
    }),
  })
  const na = (await r.json()).sessie
  eis('bijwerken slaat stap, smaak en notities op',
    r.status === 200 && na.stap === 1 && na.smaak.favorieten.length === 2 && na.notities.length === 1)
  r = await fetch(BASIS + '/api/sessies/' + token)
  const terug = (await r.json()).sessie
  eis('hervatten na bijwerken behoudt alles', terug.smaak.citaten[0] === 'dat roest vind ik prachtig')

  // 4. veldbewaking
  r = await fetch(BASIS + '/api/sessies/' + token, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ hack: true }),
  })
  eis('onbekend veld wordt geweigerd met 400', r.status === 400)
  r = await fetch(BASIS + '/api/sessies/' + token, {
    method: 'PATCH', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ stap: 9 }),
  })
  eis('stap buiten 0 tot 4 wordt geweigerd', r.status === 400)
  r = await fetch(BASIS + '/api/sessies/bestaatniet')
  eis('onbekend token geeft 404', r.status === 404)

  // 5. kostenrem: 20 min per sessie, plafond 60 = drie tokens, dan 429
  for (let i = 1; i <= 3; i++) {
    r = await fetch(BASIS + '/api/stem/sessie', {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessieToken: token }),
    })
    const d = await r.json()
    eis('stemtoken ' + i + ' binnen het plafond (200, maxMinuten 20)',
      r.status === 200 && d.maxMinuten === 20 && typeof d.clientSecret === 'string')
  }
  r = await fetch(BASIS + '/api/stem/sessie', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessieToken: token }),
  })
  const rem = await r.json()
  eis('vierde stemtoken raakt het dagplafond (429 met advies tekst)',
    r.status === 429 && rem.advies === 'schakel over op tekst' && rem.verbruiktMin === 60)
  r = await fetch(BASIS + '/api/stem/sessie', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ sessieToken: 'bestaatniet' }),
  })
  eis('stemtoken voor onbekende sessie geeft 404', r.status === 404)
} finally {
  console.log(fouten ? 'FAAL: ' + fouten + ' tests rood' : 'alle API-tests groen')
  fs.rmSync(tmp, { recursive: true, force: true })
  // natuurlijke afloop met exitCode: geforceerd exiten tijdens de
  // child-kill geeft op Windows een libuv-assertion
  process.exitCode = fouten ? 1 : 0
  server.kill()
}
