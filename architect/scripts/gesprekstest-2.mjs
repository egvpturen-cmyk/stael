// Gesprekstest stap 2 (kavel en programma): scripted dialoog via de
// testadapter, met de PDOK-fixture zodat de test nooit van de
// PDOK-uptime afhangt. Controleert adres zoeken, perceel kiezen met de
// oppervlakte uit de kadastrale data, het programma van eisen en de
// afrondregels, tegen een lokale API. Controleert ook dat app en
// server exact dezelfde persoonlijkheid en functies kennen.
import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

const POORT = 18791
process.env.API_BASIS = 'http://127.0.0.1:' + POORT
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stael-gesprek2-'))
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
  // app en server kennen exact dezelfde persoonlijkheid en functies
  const appP = await import('../src/reis/persoonlijkheid.js')
  const apiP = await import('file://' + path.join(apiMap, 'persoonlijkheid.js').replace(/\\/g, '/'))
  eis('persoonlijkheid app en server identiek',
    appP.PERSOONLIJKHEID === apiP.PERSOONLIJKHEID && JSON.stringify(appP.FUNCTIES) === JSON.stringify(apiP.FUNCTIES))
  eis('kavel- en programmafuncties gedeclareerd',
    ['kavelZoeken', 'kavelKiezen', 'programmaVastleggen'].every(n => appP.FUNCTIES.some(f => f.name === n)))

  const pdok = await import('../src/reis/pdok.js')
  pdok.zetPdokFixture(true)

  const { sessieMaak, sessieLees } = await import('../src/reis/api.js')
  const { maakFuncties } = await import('../src/reis/functies.js')
  const { maakTestAdapter } = await import('../src/reis/adapter.js')

  const { token, sessie } = await sessieMaak()
  const sessieRef = { huidige: sessie }
  const functies = maakFuncties({ token, sessieRef, opUiSignaal: () => {} })
  await functies.voerUit('naarStap', { stap: 2 })

  // afronden zonder kavel hoort te weigeren
  const teVroeg = await functies.voerUit('stapAfronden', { stap: 2 })
  eis('afronden zonder kavel wordt geweigerd', teVroeg.ok === false && teVroeg.fout.includes('perceel'))

  // kiezen voordat er gezocht is hoort te weigeren
  const blind = await functies.voerUit('kavelKiezen', { perceelId: 'fx-1' })
  eis('perceel kiezen zonder adreszoek wordt geweigerd', blind.ok === false)

  // onbestaand adres
  const nergens = await functies.voerUit('kavelZoeken', { adres: 'Bestaatnietstraat 99, Nergenshuizen' })
  eis('onbekend adres geeft een nette fout', nergens.ok === false && nergens.fout.includes('geen adres'))

  // scripted kavel-en-programmagesprek via de testadapter
  const adapter = maakTestAdapter({
    script: [
      [
        { functie: { naam: 'kavelZoeken', args: { adres: 'Molenstraat 1, Naaldwijk' } } },
        { zeg: 'Ik heb Molenstraat 1 in Naaldwijk gevonden. Wijs op de kaart uw perceel aan, of noem het perceelnummer.' },
      ],
      [
        { functie: { naam: 'kavelKiezen', args: { perceelId: 'fx-1' } } },
        { zeg: 'Vastgelegd: perceel D 591, 270 vierkante meter volgens het Kadaster. Hoeveel woonoppervlakte wenst u ongeveer?' },
      ],
      [
        { functie: { naam: 'programmaVastleggen', args: { woonoppervlakte: 180, verdiepingen: 2 } } },
        { zeg: 'Genoteerd. En hoeveel slaapkamers en badkamers heeft u nodig?' },
      ],
      [
        { functie: { naam: 'programmaVastleggen', args: { slaapkamers: 4, badkamers: 2, keuken: 'leefkeuken' } } },
        { functie: { naam: 'notitieMaken', args: { tekst: 'klant kent het bestemmingsplan nog niet; bouwvlak navragen bij de gemeente Westland' } } },
        { zeg: 'Dan vat ik samen: 180 vierkante meter wonen op twee lagen, vier slaapkamers, twee badkamers en een leefkeuken. Klopt dat?' },
      ],
      [
        { functie: { naam: 'programmaVastleggen', args: { bijzonderheden: 'werkplek aan de tuinzijde; bestemmingsplan nog navragen' } } },
        { functie: { naam: 'stapAfronden', args: { stap: 2 } } },
        { functie: { naam: 'naarStap', args: { stap: 3 } } },
      ],
    ],
  })
  adapter.onFunctionCall = (naam, args) => functies.voerUit(naam, args)
  adapter.onTranscript = () => {}
  await adapter.start()
  await adapter.zegTekst('het adres is Molenstraat 1 in Naaldwijk')
  await adapter.zegTekst('het middelste perceel, dat is nummer 591')
  await adapter.zegTekst('ongeveer 180 vierkante meter, twee verdiepingen')
  await adapter.zegTekst('vier slaapkamers en twee badkamers, met een leefkeuken')
  await adapter.zegTekst('ja, en ik wil graag een werkplek aan de tuinzijde')

  const { sessie: eind } = await sessieLees(token)
  eis('kavel vastgelegd met adres en perceel',
    eind.kavel?.perceelId === 'fx-1' && eind.kavel?.adres?.includes('Molenstraat 1'))
  eis('oppervlakte komt uit de kadastrale data (270 m2)', eind.kavel?.oppervlakte === 270)
  eis('perceelgeometrie bewaard voor de kavelcontext van stap 3',
    eind.kavel?.geometrie?.type === 'Polygon' && eind.kavel.geometrie.coordinates[0].length >= 4)
  eis('programma over losse beurten samengevoegd',
    eind.programma?.woonoppervlakte === 180 && eind.programma?.verdiepingen === 2
    && eind.programma?.slaapkamers === 4 && eind.programma?.badkamers === 2
    && eind.programma?.keuken === 'leefkeuken' && eind.programma?.bijzonderheden?.includes('tuinzijde'))
  eis('bestemmingsplan-notitie bewaard', eind.notities.some(n => n.tekst.includes('bestemmingsplan')))
  eis('de reis staat op stap 3', eind.stap === 3)

  // afrondregel: kavel zonder programma blijft geweigerd
  const { token: t2, sessie: s2 } = await sessieMaak()
  const ref2 = { huidige: s2 }
  const f2 = maakFuncties({ token: t2, sessieRef: ref2, opUiSignaal: () => {} })
  await f2.voerUit('naarStap', { stap: 2 })
  await f2.voerUit('kavelZoeken', { adres: 'Molenstraat 1, Naaldwijk' })
  await f2.voerUit('kavelKiezen', { perceelId: 'fx-2' })
  const zonderProgramma = await f2.voerUit('stapAfronden', { stap: 2 })
  eis('afronden met kavel maar zonder programma wordt geweigerd',
    zonderProgramma.ok === false && zonderProgramma.fout.includes('programma'))
  const halfProgramma = await f2.voerUit('programmaVastleggen', { keuken: 'gesloten keuken' })
  const nogSteeds = await f2.voerUit('stapAfronden', { stap: 2 })
  eis('afronden zonder woonoppervlakte en slaapkamers blijft geweigerd',
    halfProgramma.ok === true && nogSteeds.ok === false)
  eis('tweede perceel heeft eigen kadastrale oppervlakte (425 m2)', ref2.huidige.kavel?.oppervlakte === 425)
} finally {
  console.log(fouten ? 'FAAL: ' + fouten + ' checks rood' : 'gesprekstest 2 groen')
  fs.rmSync(tmp, { recursive: true, force: true })
  process.exitCode = fouten ? 1 : 0
  server.kill()
}
