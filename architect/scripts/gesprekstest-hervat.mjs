// Gesprekstest hervatten en beschikbaarheid: een sessie die tot en met
// stap 2 is afgerond wordt hervat; de server hoort de volledige
// sessiecontext in de systeemprompt te injecteren (zodat de Architect
// nooit opnieuw kennismaakt) en de functieresultaten horen te melden
// welke stappen in de app beschikbaar zijn, zodat de Architect nooit
// een niet-gebouwde stap belooft.
import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

const POORT = 18793
process.env.API_BASIS = 'http://127.0.0.1:' + POORT
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stael-hervat-'))
const hier = path.dirname(fileURLToPath(import.meta.url))
const apiMap = path.resolve(hier, '../../api')

const server = spawn(process.execPath, ['server.js'], {
  cwd: apiMap,
  env: { ...process.env, PORT: String(POORT), OPSLAG_PAD: tmp, STEM_TEST_MODUS: '1', DATABASE_URL: '', OPENAI_API_KEY: '' },
  stdio: 'ignore',
})

let fouten = 0
const eis = (naam, conditie, detail) => {
  if (conditie) console.log('ok  |', naam)
  else { fouten++; console.log('FOUT|', naam, detail ?? '') }
}

for (let i = 0; i < 60; i++) {
  try { const r = await fetch(process.env.API_BASIS + '/gezond'); if (r.ok) break } catch { /* wacht */ }
  await new Promise(r => setTimeout(r, 250))
}

try {
  const pdok = await import('../src/reis/pdok.js')
  pdok.zetPdokFixture(true)
  const { sessieMaak } = await import('../src/reis/api.js')
  const { maakFuncties, GEBOUWDE_STAPPEN } = await import('../src/reis/functies.js')
  const { PERSOONLIJKHEID } = await import('../src/reis/persoonlijkheid.js')

  // een sessie tot en met stap 2 afronden, zoals een echte klant
  const { token, sessie } = await sessieMaak()
  const ref = { huidige: sessie }
  const f = maakFuncties({ token, sessieRef: ref, opUiSignaal: () => {} })
  await f.voerUit('spraakVoorkeur', { spraak: false })
  await f.voerUit('naarStap', { stap: 1 })
  for (const n of [1, 3, 25]) await f.voerUit('favorietKiezen', { nummer: n, aan: true })
  await f.voerUit('smaakToevoegen', { favoriet: 3, familie: 'D', materiaal: 'cortenstaal', citaat: 'dat roest vind ik prachtig verweren' })
  await f.voerUit('stapAfronden', { stap: 1 })
  await f.voerUit('naarStap', { stap: 2 })
  await f.voerUit('kavelZoeken', { adres: 'Tweetandschelp 52, Monster' })
  await f.voerUit('kavelKiezen', { perceelId: '3469' })
  await f.voerUit('programmaVastleggen', { woonoppervlakte: 180, verdiepingen: 2, slaapkamers: 4 })
  const afgerond = await f.voerUit('stapAfronden', { stap: 2 })
  const doorStap = await f.voerUit('naarStap', { stap: 3 })

  // beschikbaarheid komt uit de app-state, niet uit prompttekst
  eis('stapAfronden meldt of de volgende stap beschikbaar is',
    typeof afgerond.volgendeStapBeschikbaar === 'boolean'
    && afgerond.volgendeStapBeschikbaar === GEBOUWDE_STAPPEN.includes(3))
  eis('naarStap meldt de beschikbaarheid van de stap zelf',
    doorStap.ok === true && typeof doorStap.beschikbaar === 'boolean'
    && (doorStap.beschikbaar || String(doorStap.let || '').includes('binnenkort')))
  eis('de persoonlijkheid draagt de beschikbaarheidsregel',
    PERSOONLIJKHEID.includes('als beschikbaar meldt'))

  // hervatten: een neutraal bericht in een verse gespreksgeschiedenis;
  // de server hoort de sessiecontext in de systeemprompt te zetten
  const r = await fetch(process.env.API_BASIS + '/api/stem/tekst', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessieToken: token, berichten: [{ role: 'user', content: 'oke' }] }),
  })
  const uit = await r.json()
  eis('tekstkanaal antwoordt in testmodus met de opgebouwde systeemprompt', r.ok && typeof uit.systeem === 'string')
  const sys = uit.systeem || ''
  eis('sessiecontext meldt de huidige stap', sys.includes('SESSIECONTEXT') && sys.includes('huidige stap: 3'))
  eis('sessiecontext bevat de favorieten', sys.includes('favorieten (collectienummers): 1, 3, 25'))
  eis('sessiecontext bevat kavel met adres en oppervlakte', sys.includes('Tweetandschelp 52') && sys.includes('291 m2'))
  eis('sessiecontext bevat het programma', sys.includes('"woonoppervlakte":180') && sys.includes('"slaapkamers":4'))
  eis('sessiecontext bevat het citaat van de klant', sys.includes('prachtig verweren'))
  eis('de systeemprompt verbiedt opnieuw kennismaken expliciet',
    sys.includes('stel jezelf NIET opnieuw voor') && sys.includes('kennismaking al geweest'))
  eis('de persoonlijkheid verankert de sessiecontext-regel',
    PERSOONLIJKHEID.includes('SESSIECONTEXT') && PERSOONLIJKHEID.includes('nooit opnieuw voor'))

  // een verse sessie op stap 0 krijgt geen valse voortgang mee
  const { token: t0 } = await sessieMaak()
  const r0 = await fetch(process.env.API_BASIS + '/api/stem/tekst', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessieToken: t0, berichten: [{ role: 'user', content: 'hallo' }] }),
  })
  const uit0 = await r0.json()
  eis('verse sessie: context op stap 0 zonder favorieten of kavel',
    uit0.systeem.includes('huidige stap: 0') && !uit0.systeem.includes('favorieten (collectienummers)')
    && !uit0.systeem.includes('kavel:'))
} finally {
  console.log(fouten ? 'FAAL: ' + fouten + ' checks rood' : 'gesprekstest hervatten groen')
  fs.rmSync(tmp, { recursive: true, force: true })
  process.exitCode = fouten ? 1 : 0
  server.kill()
}
