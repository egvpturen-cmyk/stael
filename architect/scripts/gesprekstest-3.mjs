// Gesprekstest stap 3 (modellen en aanpasgesprek): de smaakgestuurde
// set, het kiezen van een variant, parameterwijzigingen door de
// bouwregels en het bouwvlak, eerlijke weigeringen, verversen met
// behoud van de keuze en hervatten midden in stap 3. Twee smaak-
// profielen horen aantoonbaar verschillend uit te pakken.
import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

const POORT = 18795
process.env.API_BASIS = 'http://127.0.0.1:' + POORT
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stael-gesprek3-'))
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
  const appP = await import('../src/reis/persoonlijkheid.js')
  const apiP = await import('file://' + path.join(apiMap, 'persoonlijkheid.js').replace(/\\/g, '/'))
  eis('persoonlijkheid app en server identiek',
    appP.PERSOONLIJKHEID === apiP.PERSOONLIJKHEID && JSON.stringify(appP.FUNCTIES) === JSON.stringify(apiP.FUNCTIES))
  eis('stap-3-functies gedeclareerd',
    ['variantKiezen', 'parameterWijzigen', 'setVerversen'].every(n => appP.FUNCTIES.some(f => f.name === n)))

  const { sessieMaak, sessieLees, sessiePatch } = await import('../src/reis/api.js')
  const { maakFuncties } = await import('../src/reis/functies.js')

  // sessie met smaakprofiel D (corten, overstek) en programma
  const smaakD = {
    favorieten: [3, 15, 20], families: { D: 2, C: 1 },
    materialen: ['cortenstaal'], elementen: ['overstek'],
    citaten: ['dat roest vind ik prachtig verweren'],
  }
  const programma = { woonoppervlakte: 180, verdiepingen: 2, slaapkamers: 4 }
  const { token, sessie } = await sessieMaak()
  await sessiePatch(token, { stap: 3, smaak: smaakD, programma, kavel: { oppervlakte: 800, adres: 'testkavel' } })
  const ref = { huidige: (await sessieLees(token)).sessie }
  const f = maakFuncties({ token, sessieRef: ref, opUiSignaal: () => {} })

  // afronden zonder set of keuze hoort te weigeren
  const teVroeg = await f.voerUit('stapAfronden', { stap: 3 })
  eis('afronden zonder gekozen variant wordt geweigerd', teVroeg.ok === false && teVroeg.fout.includes('variant'))

  const set = await f.voerUit('setVerversen', {})
  eis('setVerversen levert vijf varianten met smaakzin',
    set.ok === true && set.varianten.length === 5 && set.varianten.every(v => v.smaakZin?.length > 10))
  eis('het corten-profiel kleurt de set (cortenLandelijk aanwezig)',
    ref.huidige.model.varianten.some(v => v.params.materiaalPreset === 'cortenLandelijk'))
  eis('de set staat in het sessie-object met programma-invoer',
    ref.huidige.model.prog.woonopp === 180 && ref.huidige.model.prog.lagen === 2)

  const blind = await f.voerUit('parameterWijzigen', { pad: 'volume.goot', waarde: 3.4 })
  eis('aanpassen zonder gekozen variant wordt geweigerd', blind.ok === false && blind.fout.includes('variant'))

  const fout = await f.voerUit('variantKiezen', { variantId: 'bestaat-niet' })
  eis('onbekende variant wordt geweigerd', fout.ok === false)
  const doelId = set.varianten[0].id
  const keuze = await f.voerUit('variantKiezen', { variantId: doelId })
  eis('variant gekozen als uitgangspunt', keuze.ok === true && ref.huidige.model.gekozenId === doelId)

  // het aanpasgesprek: geldige wijziging, grenzen en eerlijke weigering
  const goot = await f.voerUit('parameterWijzigen', { pad: 'volume.goot', waarde: 3.4 })
  eis('goothoogte aangepast met resultaat (voet, goot, nok)',
    goot.ok === true && goot.resultaat.goot >= 3.3 && goot.resultaat.nok > goot.resultaat.goot - .01)
  const teHoog = await f.voerUit('parameterWijzigen', { pad: 'volume.goot', waarde: 12 })
  eis('onmogelijke goothoogte eerlijk geweigerd met de grens', teHoog.ok === false && teHoog.fout.includes('tussen'))
  const gevel = await f.voerUit('parameterWijzigen', { pad: 'materialen.gevel', waarde: 'corten' })
  eis('gevelmateriaal gewijzigd via de poort', gevel.ok === true && gevel.gewijzigd === 'gevelmateriaal')
  const nepMat = await f.voerUit('parameterWijzigen', { pad: 'materialen.dak', waarde: 'chocolade' })
  eis('onbekend materiaal geweigerd met de keuzelijst', nepMat.ok === false && nepMat.fout.includes('kies uit'))
  const teBreed = await f.voerUit('parameterWijzigen', { pad: 'volume.b', waarde: 12 })
  const bouwvlakOk = teBreed.ok === false
    ? (teBreed.fout.includes('bouwvlak') || teBreed.fout.includes('tussen') || teBreed.fout.includes('bouwregels'))
    : (ref.huidige.model.varianten.find(v => v.id === doelId).voet <= ref.huidige.model.prog.bouwvlak + .5)
  eis('verbreden blijft binnen bouwvlak en bouwregels (of eerlijke weigering)', bouwvlakOk, JSON.stringify(teBreed))
  const nepPad = await f.voerUit('parameterWijzigen', { pad: 'volume.magie', waarde: 1 })
  eis('onbekend parameterpad geweigerd met wat wel kan', nepPad.ok === false && nepPad.fout.includes('volume.goot'))

  eis('wijzigingsgeschiedenis in het sessie-object',
    ref.huidige.model.wijzigingen.length >= 2
    && ref.huidige.model.wijzigingen.some(w => w.pad === 'materialen.gevel'))

  // verversen behoudt de keuze
  const set2 = await f.voerUit('setVerversen', {})
  eis('nieuwe set behoudt de gekozen variant',
    set2.ok === true && ref.huidige.model.gekozenId === doelId
    && ref.huidige.model.varianten.some(v => v.id === doelId))

  // hervatten midden in stap 3: alles staat er nog
  const { sessie: hervat } = await sessieLees(token)
  eis('hervatten midden in stap 3: set, keuze en wijzigingen intact',
    hervat.model.varianten.length >= 5 && hervat.model.gekozenId === doelId
    && hervat.model.wijzigingen.length >= 2)

  // afronden kan nu; stap 4 is nog niet gebouwd en dat wordt gemeld
  const klaar = await f.voerUit('stapAfronden', { stap: 3 })
  eis('afronden met gekozen variant lukt en meldt de beschikbaarheid',
    klaar.ok === true && klaar.volgendeStapBeschikbaar === false)

  // tweede profiel (sereen, travertin) pakt aantoonbaar anders uit
  const smaakE = {
    favorieten: [14, 26, 30], families: { E: 3 },
    materialen: ['travertin', 'brons'], elementen: ['lamellen'],
    citaten: ['die serene rust'],
  }
  const { token: t2 } = await sessieMaak()
  await sessiePatch(t2, { stap: 3, smaak: smaakE, programma, kavel: { oppervlakte: 800 } })
  const ref2 = { huidige: (await sessieLees(t2)).sessie }
  const f2 = maakFuncties({ token: t2, sessieRef: ref2, opUiSignaal: () => {} })
  await f2.voerUit('setVerversen', {})
  const mD = (await sessieLees(token)).sessie.model
  const mE = ref2.huidige.model
  eis('twee smaakprofielen pakken verschillend uit (dakvorm)',
    mD.prog.dak !== mE.prog.dak, mD.prog.dak + ' vs ' + mE.prog.dak)
  eis('het serene profiel krijgt geen corten in de set',
    !mE.varianten.some(v => v.params.materiaalPreset === 'cortenLandelijk'))
} finally {
  console.log(fouten ? 'FAAL: ' + fouten + ' checks rood' : 'gesprekstest 3 groen')
  fs.rmSync(tmp, { recursive: true, force: true })
  process.exitCode = fouten ? 1 : 0
  server.kill()
}
