// Gesprekstest stap 2 (kavel en programma): scripted dialoog via de
// testadapter, met de PDOK-fixture (echte vastgelegde WFS-respons in
// live-vorm) zodat de test nooit van de PDOK-uptime afhangt.
// Controleert adres zoeken met thuisperceel, perceel kiezen op nummer
// met de oppervlakte uit de kadastrale data, de moederperceel-route,
// het zelf intekenen van een kavel, het programma van eisen en de
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

// vaste ids uit de vastgelegde testdata
const THUIS_ID = '23520346970000'   // Monster F 3469, 291 m2
const MOEDER_ID = '22720686070000'  // 's-Gravenzande I 6860, 29234 m2

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
  eis('kavel-, teken- en programmafuncties gedeclareerd',
    ['kavelZoeken', 'kavelKiezen', 'kavelTekenenStarten', 'programmaVastleggen'].every(n => appP.FUNCTIES.some(f => f.name === n)))

  const pdok = await import('../src/reis/pdok.js')
  pdok.zetPdokFixture(true)

  const { sessieMaak, sessieLees } = await import('../src/reis/api.js')
  const { maakFuncties } = await import('../src/reis/functies.js')
  const { maakTestAdapter } = await import('../src/reis/adapter.js')

  const signalen = []
  const { token, sessie } = await sessieMaak()
  const sessieRef = { huidige: sessie }
  const functies = maakFuncties({ token, sessieRef, opUiSignaal: (naam, data) => signalen.push({ naam, data }) })
  await functies.voerUit('naarStap', { stap: 2 })

  // afronden zonder kavel hoort te weigeren
  const teVroeg = await functies.voerUit('stapAfronden', { stap: 2 })
  eis('afronden zonder kavel wordt geweigerd', teVroeg.ok === false && teVroeg.fout.includes('perceel'))
  const blind = await functies.voerUit('kavelKiezen', { perceelId: THUIS_ID })
  eis('perceel kiezen zonder adreszoek wordt geweigerd', blind.ok === false)
  const nergens = await functies.voerUit('kavelZoeken', { adres: 'Bestaatnietstraat 99, Nergenshuizen' })
  eis('onbekend adres geeft een nette fout', nergens.ok === false && nergens.fout.includes('geen adres'))

  // zoeken bevestigt de laag, het thuisperceel en de moederperceel-vlag
  const zoek = await functies.voerUit('kavelZoeken', { adres: 'Tweetandschelp 52, Monster' })
  eis('kavelZoeken bevestigt pas ok met geladen percelen (aantalPercelen)',
    zoek.ok === true && zoek.aantalPercelen === 12)
  eis('thuisPerceel is het perceel onder de adresmarker (F 3469, 291 m2)',
    zoek.thuisPerceel?.id === THUIS_ID && zoek.thuisPerceel.oppervlakte === 291
    && !zoek.thuisPerceel.waarschijnlijkMoederperceel)
  eis('een onwaarschijnlijk groot perceel draagt de moederperceel-vlag',
    zoek.percelen.some(p => p.id === MOEDER_ID && p.waarschijnlijkMoederperceel === true))

  // bijladen bij pannen: dubbelen worden overgeslagen, nooit stil
  const bijNieuw = await functies.voerUit('kavelBijladen', { lon: 4.1608659, lat: 52.02000707 })
  eis('kavelBijladen ontdubbelt en meldt het totaal',
    bijNieuw.ok === true && bijNieuw.nieuwe === 0 && bijNieuw.totaal === 12)

  // scripted gesprek: perceel op nummer, programma, afronden
  const adapter = maakTestAdapter({
    script: [
      [
        { functie: { naam: 'kavelKiezen', args: { perceelId: '3469' } } },
        { zeg: 'Vastgelegd: perceel F 3469, 291 vierkante meter volgens het Kadaster. Hoeveel woonoppervlakte wenst u ongeveer?' },
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
        { functie: { naam: 'programmaVastleggen', args: { bijzonderheden: 'werkplek aan de tuinzijde' } } },
        { functie: { naam: 'stapAfronden', args: { stap: 2 } } },
        { functie: { naam: 'naarStap', args: { stap: 3 } } },
      ],
    ],
  })
  adapter.onFunctionCall = (naam, args) => functies.voerUit(naam, args)
  adapter.onTranscript = () => {}
  await adapter.start()
  await adapter.zegTekst('mijn perceel is nummer 3469')
  await adapter.zegTekst('ongeveer 180 vierkante meter, twee verdiepingen')
  await adapter.zegTekst('vier slaapkamers en twee badkamers, met een leefkeuken')
  await adapter.zegTekst('ja, en ik wil graag een werkplek aan de tuinzijde')

  const { sessie: eind } = await sessieLees(token)
  eis('perceel gekozen op nummer, vastgelegd met adres en herkomst kadastraal',
    eind.kavel?.perceelId === THUIS_ID && eind.kavel?.adres?.includes('Tweetandschelp 52')
    && eind.kavel?.herkomst === 'kadastraal')
  eis('oppervlakte komt uit de kadastrale data (291 m2)', eind.kavel?.oppervlakte === 291)
  eis('perceelgeometrie bewaard voor de kavelcontext van stap 3',
    ['Polygon', 'MultiPolygon'].includes(eind.kavel?.geometrie?.type))
  eis('programma over losse beurten samengevoegd',
    eind.programma?.woonoppervlakte === 180 && eind.programma?.slaapkamers === 4
    && eind.programma?.keuken === 'leefkeuken' && eind.programma?.bijzonderheden?.includes('tuinzijde'))
  eis('bestemmingsplan-notitie bewaard', eind.notities.some(n => n.tekst.includes('bestemmingsplan')))
  eis('de reis staat op stap 3', eind.stap === 3)

  // de moederperceel-route: eerlijk benoemen en zelf intekenen
  const { token: t2, sessie: s2 } = await sessieMaak()
  const ref2 = { huidige: s2 }
  const sig2 = []
  const f2 = maakFuncties({ token: t2, sessieRef: ref2, opUiSignaal: (naam, data) => sig2.push({ naam, data }) })
  await f2.voerUit('naarStap', { stap: 2 })
  await f2.voerUit('kavelZoeken', { adres: 'Tweetandschelp 52, Monster' })
  const moeder = await f2.voerUit('kavelKiezen', { perceelId: MOEDER_ID })
  eis('keuze van een reuzenperceel draagt de moederperceel-vlag',
    moeder.ok === true && moeder.waarschijnlijkMoederperceel === true && moeder.kavel.oppervlakte === 29234)

  const dialoog = maakTestAdapter({
    script: [[
      { zeg: 'Dit perceel is ruim 29 duizend vierkante meter; de kavelsplitsing is hier waarschijnlijk nog niet bij het Kadaster ingeschreven. Zullen we uw kavel zelf intekenen?' },
      { functie: { naam: 'kavelTekenenStarten', args: {} } },
    ]],
  })
  dialoog.onFunctionCall = (naam, args) => f2.voerUit(naam, args)
  dialoog.onTranscript = () => {}
  await dialoog.start()
  await dialoog.zegTekst('dat hele vlak kan niet kloppen, ik koop maar een kavel daarvan')
  eis('kavelTekenenStarten zet de kaart in tekenmodus (ui-signaal)',
    sig2.some(s => s.naam === 'tekenModus' && s.data?.aan === true))

  // de klant tekent een rechthoek van 20 bij 30 meter
  const lon0 = 4.1608659, lat0 = 52.02000707
  const dLon = 20 / (111320 * Math.cos(lat0 * Math.PI / 180)), dLat = 30 / 111320
  const teken = await f2.voerUit('kavelIntekenen', {
    punten: [[lon0, lat0], [lon0 + dLon, lat0], [lon0 + dLon, lat0 + dLat], [lon0, lat0 + dLat]],
  })
  eis('ingetekende kavel: oppervlakte klopt (20x30 m is ~600 m2)',
    teken.ok === true && Math.abs(teken.kavel.oppervlakte - 600) <= 3, JSON.stringify(teken))
  eis('herkomst is zelf ingetekend en de geometrie is bewaard',
    ref2.huidige.kavel?.herkomst === 'zelf ingetekend'
    && ref2.huidige.kavel?.geometrie?.type === 'Polygon'
    && ref2.huidige.kavel?.perceelId === null)
  const teWeinig = await f2.voerUit('kavelIntekenen', { punten: [[lon0, lat0], [lon0 + dLon, lat0]] })
  eis('intekenen met minder dan drie punten wordt geweigerd', teWeinig.ok === false)

  // afronden kan met een ingetekende kavel, maar pas met programma
  const zonderProgramma = await f2.voerUit('stapAfronden', { stap: 2 })
  eis('afronden met kavel maar zonder programma wordt geweigerd',
    zonderProgramma.ok === false && zonderProgramma.fout.includes('programma'))
  await f2.voerUit('programmaVastleggen', { woonoppervlakte: 150, slaapkamers: 3 })
  const klaar = await f2.voerUit('stapAfronden', { stap: 2 })
  eis('afronden met ingetekende kavel plus programma lukt', klaar.ok === true)
} finally {
  console.log(fouten ? 'FAAL: ' + fouten + ' checks rood' : 'gesprekstest 2 groen')
  fs.rmSync(tmp, { recursive: true, force: true })
  process.exitCode = fouten ? 1 : 0
  server.kill()
}
