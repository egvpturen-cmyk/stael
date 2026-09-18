// De smaakmotor past de vertaaltabel (smaakvertaling.js, puur data)
// toe op de bestaande klantgenerator: het smaakprofiel, het programma
// en de kavel sturen welke varianten er komen en hoe ze eruitzien.
// Alles gaat door dezelfde wetten (bouwModel, valideerModel,
// repareerModel); wat de poort niet haalt, komt nooit bij de klant.
// Puur JavaScript zonder React, zodat de gesprekstest hem in node
// draait.
import { SMAAKVERTALING } from './smaakvertaling.js'
import { COLLECTIE } from './collectie.js'
import { variantenPlan, maakVariantUitPoging } from '../kern/klantgenerator.js'
import { bouwModel, kernRng } from '../kern/model.js'
import { valideerModel, repareerModel } from '../kern/valideer.js'
import { MATERIAALPRESETS, materiaalKleur } from '../kern/materialen.js'
import { REGELS_DEFAULT } from '../ontwerptaal.js'

const T = SMAAKVERTALING

// familietelling plus trefwoorden uit het smaakprofiel
function profielKenmerken(smaak) {
  const families = smaak?.families || {}
  const tekst = [...(smaak?.materialen || []), ...(smaak?.elementen || []), ...(smaak?.citaten || [])]
    .join(' ').toLowerCase()
  const materiaalTreffers = Object.keys(T.materialen).filter(w => tekst.includes(w))
  const elementTreffers = Object.keys(T.elementen).filter(w => tekst.includes(w))
  return { families, materiaalTreffers, elementTreffers }
}

// programma plus kavel naar generatorinvoer; de dakvorm volgt uit de
// gewogen dakvoorkeur van de favoriete families
export function profielNaarProg(smaak, programma, kavel) {
  const a = T.afleiding
  const { families } = profielKenmerken(smaak)
  const dakScore = { zadel: 0, plat: 0, mix: .5 }
  for (const [fam, telling] of Object.entries(families)) {
    for (const [dak, g] of Object.entries(T.families[fam]?.dak || {})) {
      dakScore[dak] = (dakScore[dak] || 0) + g * telling
    }
  }
  const dak = Object.entries(dakScore).sort((x, y) => y[1] - x[1])[0][0]
  const kavelOpp = kavel?.oppervlakte || a.kavelStandaard
  const bouwvlak = Math.round(Math.min(a.bouwvlakMax, Math.max(a.bouwvlakMin, kavelOpp * a.bouwvlakDeel)))
  const lagen = (programma?.verdiepingen >= 2 || (programma?.slaapkamers || 0) >= a.slaapkamersVoorVerdieping) ? 2 : 1
  return {
    kavel: kavelOpp, bouwvlak,
    woonopp: programma?.woonoppervlakte || a.woonoppStandaard,
    lagen, dak, regels: { ...REGELS_DEFAULT },
  }
}

// controleerbare kenmerken van een gebouwde variant, voor de
// element-bonussen en de smaakzin
function kenmerkenVan(v) {
  const p = v.params
  const k = new Set()
  if (p.massa?.type === 'stapel' && v.id.includes('zwevend')) k.add('massaZwevend')
  if (p.massa?.type === 'stapel') k.add('stapel')
  if (p.massa?.terras) k.add('terras')
  if (p.massa?.pergola || p.uitbouw?.type === 'pergola') k.add('pergola')
  if (p.uitbouw?.type === 'veranda') k.add('veranda')
  if (p.uitbouw?.type === 'zijluifel') k.add('luifel')
  if (p.uitbouw?.type === 'portaal') k.add('portaal')
  if (p.plint) k.add('plint')
  for (const el of p.gevelElementen || []) {
    if (el.type === 'balkon') k.add('balkon')
    if (el.type === 'lamellenveld') k.add('lamellen')
    if (el.type === 'penanten') k.add('lamellen')
  }
  if ((p.sparingen || []).length) k.add('puiStrak')
  return k
}

function scoreVariant(v, kenmerken) {
  const { families, elementTreffers } = kenmerken
  const [tId, massa] = v.id.split('-')
  let score = 0
  const bij = []
  for (const [fam, telling] of Object.entries(families)) {
    const rij = T.families[fam]
    if (!rij) continue
    const t = (rij.typologieen[tId] || 0) * telling
    const m = (rij.massas[massa] || 0) * telling
    score += t + m
    if (t + m > 0) bij.push({ soort: 'familie', fam, punten: t + m })
  }
  const aanwezig = kenmerkenVan(v)
  for (const woord of elementTreffers) {
    const regel = T.elementen[woord]
    if (regel && aanwezig.has(regel.kenmerk)) {
      score += regel.bonus
      bij.push({ soort: 'element', woord, punten: regel.bonus })
    }
  }
  return { score, bijdragen: bij.sort((a, b) => b.punten - a.punten) }
}

// materiaalpreset gewogen op genoemde materialen en familievoorkeur
function presetGewichten(kenmerken) {
  const g = {}
  for (const woord of kenmerken.materiaalTreffers) {
    for (const [preset, w] of Object.entries(T.materialen[woord])) g[preset] = (g[preset] || 0) + w * 2
  }
  for (const [fam, telling] of Object.entries(kenmerken.families)) {
    for (const [preset, w] of Object.entries(T.families[fam]?.presets || {})) {
      g[preset] = (g[preset] || 0) + w * telling
    }
  }
  return g
}

// deterministisch op rangorde van smaakgewicht: de sterkst gewogen
// preset eerst, elke preset hooguit twee keer per set; alleen zonder
// enige smaakvoorkeur valt de keuze terug op een nette spreiding
function kiesPreset(gewichten, r, alGebruikt) {
  const rangorde = [...MATERIAALPRESETS]
    .map(p => [p, gewichten[p.id] || 0])
    .sort((a, b) => b[1] - a[1])
  const heeftVoorkeur = rangorde[0][1] > 0
  if (!heeftVoorkeur) {
    const vrij = rangorde.filter(([p]) => !alGebruikt.includes(p.id))
    const pool = vrij.length ? vrij : rangorde
    return pool[Math.floor(r() * pool.length) % pool.length][0]
  }
  for (const [p] of rangorde) {
    if (alGebruikt.filter(id => id === p.id).length < 2) return p
  }
  return rangorde[0][0]
}

// preset toepassen en opnieuw door de wetten; mislukt dat, dan houdt
// de variant zijn oorspronkelijke, al goedgekeurde materialen
function metPreset(v, preset) {
  const params = structuredClone(v.params)
  params.materialen = {
    gevel: preset.gevel, dak: preset.dak,
    daklijnen: preset.daklijnen || null, accent: preset.accent,
  }
  if (params.volume.plat || params.massa?.type === 'stapel') {
    params.materialen.dak = { mat: 'bitumen', kleur: 'zwart' }
    params.materialen.daklijnen = null
  }
  params.kleuren = {
    gevel: materiaalKleur(preset.gevel.mat, preset.gevel.kleur) || params.kleuren.gevel,
    dak: materiaalKleur(preset.dak.mat, preset.dak.kleur) || params.kleuren.dak,
  }
  params.materiaalPreset = preset.id
  try {
    let model = bouwModel(params)
    let fouten = valideerModel(model)
    if (fouten.length) { model = repareerModel(model); fouten = valideerModel(model) }
    if (fouten.length) return v
    return { ...v, params, model }
  } catch { return v }
}

// de zin die de link met de smaakkeuzes benoemt, deterministisch uit
// de echte bijdragen (nooit een verzonnen verband)
function smaakZin(v, smaak, bijdragen, preset, materiaalTreffers) {
  const delen = []
  const fam = bijdragen.find(b => b.soort === 'familie')
  if (fam) {
    const favoriet = (smaak?.favorieten || [])
      .map(n => COLLECTIE.find(c => c.nummer === n))
      .find(c => c && c.familie === fam.fam)
    if (favoriet) delen.push('de lijn van uw favoriet ' + favoriet.naam + ' (N° ' + String(favoriet.nummer).padStart(2, '0') + ')')
  }
  const el = bijdragen.find(b => b.soort === 'element')
  if (el) delen.push('uw wens voor ' + el.woord)
  const mat = materiaalTreffers.find(w => Object.keys(T.materialen[w]).includes(preset.id))
  if (mat) delen.push('uw voorkeur voor ' + mat)
  if (!delen.length) return 'Een vrije variant binnen uw programma, ter vergelijking naast de smaakvolgers.'
  return 'Gebaseerd op ' + delen.slice(0, 2).join(' en ') + '.'
}

const adem = () => new Promise(r => setTimeout(r, 0))

// de set van vijf: kandidaten bouwen, scoren op het smaakprofiel,
// divers selecteren en de materialen smaakgestuurd omkleuren; async
// met ademruimte zodat de UI tijdens het bouwen blijft ademen
export async function genereerSmaakSet({ smaak, programma, kavel, ronde = 0, behoud = null }) {
  const prog = profielNaarProg(smaak, programma, kavel)
  const kenmerken = profielKenmerken(smaak)
  const { pogingen } = variantenPlan(prog, ronde)
  const kandidaten = []
  for (const poging of pogingen) {
    if (kandidaten.length >= T.set.kandidaten) break
    const v = maakVariantUitPoging(prog, poging)
    if (v) kandidaten.push(v)
    if (kandidaten.length % 3 === 0) await adem()
  }
  const gescoord = kandidaten
    .map(v => ({ v, ...scoreVariant(v, kenmerken) }))
    .sort((a, b) => b.score - a.score)

  const r = kernRng((ronde + 3) * 40503 + (smaak?.favorieten || []).reduce((s, n) => s + n, 7))
  const gewichten = presetGewichten(kenmerken)
  const gekozen = []
  const perCombi = {}
  const doel = T.set.grootte - (behoud ? 1 : 0)
  for (const { v, bijdragen } of gescoord) {
    if (gekozen.length >= doel) break
    const combi = v.id.split('-').slice(0, 2).join('-')
    if ((perCombi[combi] || 0) >= T.set.maxPerTypologieMassa) continue
    if (behoud && v.id === behoud.id) continue
    perCombi[combi] = (perCombi[combi] || 0) + 1
    const preset = kiesPreset(gewichten, r, gekozen.map(g => g.params.materiaalPreset))
    const klaar = metPreset(v, preset)
    gekozen.push({
      ...klaar,
      smaakZin: smaakZin(klaar, smaak, bijdragen, preset, kenmerken.materiaalTreffers),
    })
    await adem()
  }
  // is de kandidatenpool smal (bijv. een laag met plat dak), dan telt
  // de volle set zwaarder dan de diversiteitscap: aanvullen met de
  // hoogst gescoorde resterende kandidaten
  if (gekozen.length < doel) {
    for (const { v, bijdragen } of gescoord) {
      if (gekozen.length >= doel) break
      if (gekozen.some(g => g.id === v.id) || (behoud && v.id === behoud.id)) continue
      const preset = kiesPreset(gewichten, r, gekozen.map(g => g.params.materiaalPreset))
      const klaar = metPreset(v, preset)
      gekozen.push({
        ...klaar,
        smaakZin: smaakZin(klaar, smaak, bijdragen, preset, kenmerken.materiaalTreffers),
      })
      await adem()
    }
  }
  return { prog, varianten: gekozen }
}

// een variant compact voor het sessie-object (zonder three-model)
export function variantVoorSessie(v) {
  const { model, kijk, ...rest } = v
  return { ...rest }
}

// en weer terug: model en camera opnieuw afleiden uit de params
export function herbouwVariant(v) {
  try {
    let model = bouwModel(v.params)
    let fouten = valideerModel(model)
    if (fouten.length) { model = repareerModel(model); fouten = valideerModel(model) }
    if (fouten.length) return null
    const nok = Math.max(...model.volumes.map(x => x.nok))
    const goot = Math.max(...model.volumes.map(x => x.goot))
    const afst = Math.max(...model.volumes.map(x => Math.max(x.b, x.d))) * 1.35 + 4
    return {
      ...v, model,
      goot, nok,
      kijk: { pos: [afst * .62, nok * .8 + 2.4, afst * .82], doel: [0, Math.min(goot, 3.4) * .85, 0], fov: 40 },
    }
  } catch { return null }
}
