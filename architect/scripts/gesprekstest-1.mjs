// Gesprekstest stap 1 (smaak): scripted dialoog via de testadapter
// controleert favorieten, doorvragen, het smaakprofiel en de
// afrondregels, tegen een lokale API. Controleert ook dat app en
// server exact dezelfde collectie kennen.
import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

const POORT = 18789
process.env.API_BASIS = 'http://127.0.0.1:' + POORT
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stael-gesprek1-'))
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
  // app en server kennen exact dezelfde collectie
  const appC = await import('../src/reis/collectie.js')
  const apiC = await import('file://' + path.join(apiMap, 'collectie.js').replace(/\\/g, '/'))
  eis('collectie app en server identiek (34 ontwerpen)',
    JSON.stringify(appC.COLLECTIE) === JSON.stringify(apiC.COLLECTIE) && appC.COLLECTIE.length === 34)
  eis('collectiecontext voor de prompt is compact en compleet',
    appC.collectieContext().split('\n').length === 35 && appC.collectieContext() === apiC.collectieContext())

  const { sessieMaak, sessieLees } = await import('../src/reis/api.js')
  const { maakFuncties } = await import('../src/reis/functies.js')
  const { maakTestAdapter } = await import('../src/reis/adapter.js')

  const { token, sessie } = await sessieMaak()
  const sessieRef = { huidige: sessie }
  const functies = maakFuncties({ token, sessieRef, opUiSignaal: () => {} })
  await functies.voerUit('naarStap', { stap: 1 })

  // afronden zonder favorieten hoort te weigeren
  const teVroeg = await functies.voerUit('stapAfronden', { stap: 1 })
  eis('afronden zonder favorieten wordt geweigerd', teVroeg.ok === false && teVroeg.fout.includes('3 tot 5'))

  // scripted smaakgesprek: drie favorieten met doorvragen
  const adapter = maakTestAdapter({
    script: [
      [
        { functie: { naam: 'favorietKiezen', args: { nummer: 3, aan: true } } },
        { zeg: 'Mooi, ERTS. Wat spreekt u daarin aan: de vorm, het materiaal of de sfeer?' },
      ],
      [
        { functie: { naam: 'smaakToevoegen', args: { favoriet: 3, familie: 'D', materiaal: 'cortenstaal', citaat: 'dat roest vind ik prachtig verweren' } } },
        { functie: { naam: 'favorietKiezen', args: { nummer: 1, aan: true } } },
        { zeg: 'Genoteerd. En SPANT, wat raakt u daar?' },
      ],
      [
        { functie: { naam: 'smaakToevoegen', args: { favoriet: 1, familie: 'A', element: 'entreeluifel', citaat: 'die lage luifel maakt het uitnodigend' } } },
        { functie: { naam: 'favorietKiezen', args: { nummer: 25, aan: true } } },
        { functie: { naam: 'smaakToevoegen', args: { favoriet: 25, familie: 'A', element: 'balkonhek' } } },
        { zeg: 'Dan vat ik samen: u houdt van de archetypische kap met warme materialen en een verweerd accent. Klopt dat?' },
      ],
      [
        { functie: { naam: 'stapAfronden', args: { stap: 1 } } },
        { functie: { naam: 'naarStap', args: { stap: 2 } } },
      ],
    ],
  })
  adapter.onFunctionCall = (naam, args) => functies.voerUit(naam, args)
  adapter.onTranscript = () => {}
  await adapter.start()
  await adapter.zegTekst('die roestige vind ik mooi, nummer 3')
  await adapter.zegTekst('vooral het materiaal, dat roest vind ik prachtig verweren')
  await adapter.zegTekst('bij SPANT die lage luifel, dat maakt het uitnodigend')
  await adapter.zegTekst('ja dat klopt precies')

  const { sessie: eind } = await sessieLees(token)
  eis('drie favorieten vastgelegd', JSON.stringify([...eind.smaak.favorieten].sort((a, b) => a - b)) === '[1,3,25]')
  eis('familietelling volgt deterministisch uit de favorieten',
    eind.smaak.families.A === 2 && eind.smaak.families.D === 1)
  eis('materialen en elementen genoteerd',
    eind.smaak.materialen.includes('cortenstaal') && eind.smaak.elementen.includes('entreeluifel') && eind.smaak.elementen.includes('balkonhek'))
  eis('letterlijke citaten bewaard', eind.smaak.citaten.length === 2
    && eind.smaak.citaten[0].includes('prachtig verweren'))
  eis('de reis staat op stap 2', eind.stap === 2)

  // regels: maximaal vijf favorieten
  const { token: t2, sessie: s2 } = await sessieMaak()
  const ref2 = { huidige: s2 }
  const f2 = maakFuncties({ token: t2, sessieRef: ref2, opUiSignaal: () => {} })
  await f2.voerUit('naarStap', { stap: 1 })
  for (const n of [2, 4, 6, 8, 10]) await f2.voerUit('favorietKiezen', { nummer: n, aan: true })
  const zesde = await f2.voerUit('favorietKiezen', { nummer: 12, aan: true })
  eis('een zesde favoriet wordt geweigerd', zesde.ok === false && zesde.fout.includes('maximaal 5'))
  const losgelaten = await f2.voerUit('favorietKiezen', { nummer: 8, aan: false })
  eis('een favoriet loslaten kan altijd', losgelaten.ok === true && !losgelaten.favorieten.includes(8))
} finally {
  console.log(fouten ? 'FAAL: ' + fouten + ' checks rood' : 'gesprekstest 1 groen')
  fs.rmSync(tmp, { recursive: true, force: true })
  process.exitCode = fouten ? 1 : 0
  server.kill()
}
