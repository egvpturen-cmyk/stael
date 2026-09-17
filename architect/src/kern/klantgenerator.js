// Klantgenerator op de gebouwmodel-kern: dezelfde ontwerptaal-kennisbank
// (typologieen, massastrategieen, kopthema's, secundaire elementen met
// dosering), maar de uitvoer is een kern-parameterset die door bouwModel,
// valideerModel en repareerModel gaat. Wat de wetten niet haalt, komt
// nooit bij de klant. Alleen elementen die de kern vandaag echt kan
// bouwen doen mee, zodat elke beschrijvingszin klopt met het beeld.

import { kernRng, bouwModel } from './model.js'
import { valideerModel, repareerModel } from './valideer.js'
import { MATERIAALPRESETS, materiaalKleur } from './materialen.js'
import {
  STAEL, KLEUREN, MASSAS, STRAMIENEN, KOPTHEMAS, SECUNDAIR, TYPOLOGIEEN, typologieenVoor,
} from '../ontwerptaal.js'

const grad = g => g * Math.PI / 180
const tussen = (r, [lo, hi]) => lo + r() * (hi - lo)
const kies = (r, lijst) => lijst[Math.floor(r() * lijst.length) % lijst.length]
const donker = kleur => [KLEUREN.houtZwart, KLEUREN.staalZwart].includes(kleur)
function kiesGewogen(r, items) {
  const totaal = items.reduce((s, [, g]) => s + g, 0)
  let lot = r() * totaal
  for (const [naam, g] of items) { lot -= g; if (lot <= 0) return naam }
  return items.length ? items[items.length - 1][0] : null
}
function schud(r, lijst) {
  const l = [...lijst]
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]
  }
  return l
}

// wat de kern vandaag kan bouwen; de rest van de kennisbank wacht
const MASSA_KAN = ['enkel', 'kopstaart', 'dwarskap', 'asym', 'stapel', 'zwevend']
const KOPTHEMA_KAN = ['puiStrak', 'puiKader', 'puiLamellen', 'puiPenanten', 'portaal', 'lamellenVeld']
const SECUNDAIR_KAN = ['balkon', 'veranda', 'zijLuifel', 'aanbouw', 'plint', 'pergola']

// het plan van een set: doelaantal plus de deterministische reeks
// pogingen (typologie, massa, seed); los uitvoerbaar zodat een
// workerpool de pogingen parallel kan bouwen met identieke uitkomst
export function variantenPlan(prog, ronde = 0) {
  const basis = ronde * 7919 + 13
  const r = kernRng((basis + 1) * 2654435761)
  const kandidaten = typologieenVoor(prog.dak, prog.lagen)
  const pool = []
  kandidaten.forEach(t => t.massas.filter(m => MASSA_KAN.includes(m))
    .forEach(m => pool.push({ t, m })))
  if (!pool.length) return { doel: 0, pogingen: [] }
  const volgorde = schud(r, pool)
  const doel = 5 + Math.floor(r() * 3)
  const pogingen = []
  const maxPogingen = volgorde.length * 4 + 8
  for (let poging = 0; poging < maxPogingen; poging++) {
    const { t, m } = volgorde[poging % volgorde.length]
    pogingen.push({ tId: t.id, m, seed: basis + poging * 31 + poging * 7 })
  }
  return { doel, pogingen }
}

export function maakVariantUitPoging(prog, poging) {
  const t = TYPOLOGIEEN.find(x => x.id === poging.tId)
  if (!t) return null
  return maakKernVariant(t, poging.m, prog, poging.seed)
}

export function genereerKernVarianten(prog, ronde = 0) {
  const { doel, pogingen } = variantenPlan(prog, ronde)
  const lijst = []
  for (const poging of pogingen) {
    if (lijst.length >= doel) break
    const v = maakVariantUitPoging(prog, poging)
    if (v) lijst.push(v)
  }
  return lijst
}

function maakKernVariant(t, massaWens, prog, seed) {
  const r = kernRng((seed + 7) * 2246822519)
  const regels = prog.regels
  const lagen = t.id === 'loft' ? 2 : Math.min(prog.lagen, Math.max(...t.lagen))
  const factor = t.id === 'loft' ? STAEL.loftVerdiepingFactor : STAEL.verdiepingFactor
  const nodig = prog.woonopp / (lagen === 2 ? factor : 1)
  const voet = Math.min(nodig, prog.bouwvlak)
  const past = nodig <= prog.bouwvlak

  let ratio = tussen(r, t.ratio)
  let b = Math.sqrt(voet / ratio)
  if (b > STAEL.overspanningComfort[1]) {
    const ratioNodig = voet / (STAEL.overspanningComfort[1] ** 2)
    if (ratioNodig <= t.ratio[1]) {
      ratio = Math.max(ratio, ratioNodig)
      b = Math.sqrt(voet / ratio)
    }
  }
  if (b > STAEL.maxOverspanning) b = STAEL.maxOverspanning
  const d = voet / b

  let goot = Math.min(tussen(r, t.goot), regels.gootMax)
  if (t.id === 'loft') goot = Math.min(Math.max(goot, 5.9), Math.max(regels.gootMax, 5.9))
  const plat = t.helling[1] === 0 || (prog.dak === 'plat' && t.dakvormen.includes('plat'))
  let helling = 0, nok = goot
  if (!plat) {
    const hMin = Math.max(t.helling[0], regels.hellingMin)
    const hMax = Math.max(hMin, Math.min(t.helling[1], regels.hellingMax))
    helling = tussen(r, [hMin, hMax])
    nok = goot + Math.tan(grad(helling)) * b / 2
    if (nok > regels.nokMax) {
      nok = regels.nokMax
      helling = Math.atan2(nok - goot, b / 2) / Math.PI * 180
    }
  }

  // materiaalpreset uit de bibliotheek: gevel, dak, accent als geheel
  const preset = MATERIAALPRESETS[Math.floor(r() * MATERIAALPRESETS.length) % MATERIAALPRESETS.length]
  const gevel = materiaalKleur(preset.gevel.mat, preset.gevel.kleur) || KLEUREN[kies(r, t.gevels)]
  const dakKleur = materiaalKleur(preset.dak.mat, preset.dak.kleur) || KLEUREN[kies(r, t.daken)]
  const accentHex = materiaalKleur(preset.accent.mat, preset.accent.kleur) || KLEUREN.houtBlank
  const stramien = kies(r, Object.keys(STRAMIENEN))
  const zinnen = []

  let massa = MASSA_KAN.includes(massaWens) ? massaWens : 'enkel'
  const s = { plat, b, d, voet, lagen, goot, helling: Math.round(helling), massa, kopThema: null }
  if (massa !== 'enkel' && MASSAS[massa].kan && !MASSAS[massa].kan(s)) massa = 'enkel'
  s.massa = massa

  const puiBreedte = Math.min(b - .9, b * .74)
  const params = {
    seed,
    volume: { b, d, goot, helling, nokOffset: 0, plat: plat || undefined },
    sparingen: [{ wand: 'kop+', vorm: 'contour', x: 0, breedte: puiBreedte, marge: .2, stramien }],
    raamRitme: { n: Math.max(2, Math.round(d / 2.6)), w: .9, plint: .3 },
    gevelElementen: [],
    kleuren: { gevel, dak: dakKleur },
    materialen: {
      gevel: preset.gevel, dak: preset.dak,
      daklijnen: preset.daklijnen || null, accent: preset.accent,
    },
    materiaalPreset: preset.id,
  }

  if (massa === 'kopstaart') {
    params.massa = {
      type: 'kopstaart', dKop: Math.max(4.5, d * .34),
      gootK: Math.min(goot + 1.1, regels.gootMax + 1.1), krimp: .82,
    }
  }
  if (massa === 'dwarskap') {
    params.massa = {
      type: 'dwarskap', kant: r() < .5 ? -1 : 1,
      b2: Math.max(3.6, b * .55), goot2: Math.max(2.2, goot * .9),
      helling2: Math.min(60, helling + 4), uitsteek: 1.6 + r() * 1.6,
      z: (r() - .5) * d * .5,
    }
  }
  if (massa === 'asym') {
    params.volume.nokOffset = (r() < .5 ? -1 : 1) * b * (.1 + r() * .15)
  }
  if (massa === 'stapel' || massa === 'zwevend') {
    params.raamRitme = null
    params.sparingen = []
    const h1 = 2.9 + r() * .4
    if (massa === 'zwevend') {
      // uitkragende doos op een kleine kern plus kolommen
      params.volume = { b: Math.max(2.6, b * .36), d: Math.max(3, d * .32), goot: 3 }
      params.massa = {
        type: 'stapel', h1, h2: 2.8 + r() * .6, b2: b, d2: d,
        dx: b * .22, dz: d * .22, terras: false,
      }
    } else {
      params.volume = { b, d, goot: 3 }
      params.massa = {
        type: 'stapel', h1, h2: 2.7 + r() * .7,
        b2: b * (.7 + r() * .4), d2: d * (.55 + r() * .35),
        dx: 0, dz: 0, terras: false,
      }
      const richting = kies(r, ['voor', 'zij', 'terug'])
      if (richting === 'voor') params.massa.dz = d * .3
      if (richting === 'zij') {
        params.massa.dx = (r() < .5 ? -1 : 1) * b * .45
        params.massa.terras = r() < .7
        if (params.massa.terras && r() < .5) params.massa.pergola = { kant: params.massa.dx < 0 ? 1 : -1, z: 0 }
      }
      if (richting === 'terug') {
        params.massa.dz = -d * .15
        params.massa.d2 = d * .7
        params.massa.terras = true
      }
      if (r() < .35) params.massa.opbouw = { b: 2.2 + r() * 1, d: 2 + r() * .8, h: 2.5 + r() * .3 }
    }
  }
  if (plat || massa === 'stapel' || massa === 'zwevend') {
    params.materialen.dak = { mat: 'bitumen', kleur: 'zwart' }
    params.materialen.daklijnen = null
  }
  zinnen.push(MASSAS[massa].zin)

  // dominant kopgevel-thema (niet bij stapelmassa's: daar zijn de
  // glasbanden per laag het thema)
  if (massa !== 'stapel' && massa !== 'zwevend') {
    const kandidaten = Object.entries(KOPTHEMAS)
      .filter(([naam, def]) => KOPTHEMA_KAN.includes(naam) && def.kan(s, prog))
      .map(([naam, def]) => [naam, def.gewicht])
    s.kopThema = kiesGewogen(r, kandidaten) || 'puiStrak'
    if (s.kopThema === 'puiKader') {
      params.gevelElementen.push({ wand: 'kop+', type: 'kader', kleur: accentHex })
    }
    if (s.kopThema === 'puiLamellen' && !plat) {
      params.gevelElementen.push({
        wand: 'kop+', type: 'lamellenveld', grens: 'dakcontour',
        v0: goot + .3, v1: Math.max(goot + 1, nok - .8), kleur: '#84705a',
      })
    }
    if (s.kopThema === 'puiPenanten') {
      params.gevelElementen.push({
        wand: 'kop+', type: 'penanten', n: 3, b: .5,
        span: puiBreedte * .8, hMax: goot + .3, kleur: KLEUREN.houtWarm,
      })
    }
    if (s.kopThema === 'portaal') {
      params.uitbouw = { type: 'portaal', uit: .5 + r() * 1.8 }
    }
    if (s.kopThema === 'lamellenVeld' && plat) {
      params.gevelElementen.push({
        wand: 'kop+', type: 'lamellenveld', grens: 'pui',
        v0: goot * .5, v1: goot - .8, uit: .3, kleur: '#84705a',
      })
    }
    zinnen.push(KOPTHEMAS[s.kopThema].zin)
    zinnen.push(STRAMIENEN[stramien].zin)
  } else {
    zinnen.push('glasbanden per laag, geknipt rond de deuren')
  }

  // secundaire laag: een of twee elementen, gedoseerd, zonder conflicten
  const aantal = 1 + (r() < .45 ? 1 : 0)
  const volgorde = schud(r, Object.entries(SECUNDAIR)
    .filter(([naam]) => SECUNDAIR_KAN.includes(naam))
    .map(([naam, def]) => [naam, def.gewicht]))
  const gekozen = []
  for (const [naam] of volgorde) {
    if (gekozen.length >= aantal) break
    const el = SECUNDAIR[naam]
    if (!el.kan(s, prog)) continue
    if (gekozen.some(g => SECUNDAIR[g].sluit.includes(naam) || el.sluit.includes(g))) continue
    if (['veranda', 'zijLuifel', 'pergola'].includes(naam) && params.uitbouw) continue
    if (naam === 'aanbouw' && params.massa) continue
    if (naam === 'balkon' && (massa === 'stapel' || massa === 'zwevend')) continue
    gekozen.push(naam)
  }
  for (const naam of gekozen) {
    if (naam === 'veranda') params.uitbouw = { type: 'veranda', diepte: 2.2 + r() * 1.2, kolommen: 2 + (r() < .4 ? 1 : 0) }
    else if (naam === 'zijLuifel') params.uitbouw = { type: 'zijluifel', kant: r() < .5 ? -1 : 1, uit: 1.6 + r() * .8, wandKleur: donker(gevel) ? KLEUREN.houtBlank : KLEUREN.houtZwart }
    else if (naam === 'pergola') params.uitbouw = { type: 'pergola', kant: r() < .5 ? -1 : 1, diepte: 1.8 + r() * 1.4, breedte: 2.4 + r() * 2, z: (r() - .5) * d * .4 }
    else if (naam === 'aanbouw') params.massa = { type: 'aanbouw', kant: r() < .5 ? -1 : 1, b: 3 + r() * 1.2, d: Math.min(d * .5, 5), h: Math.min(2.9, Math.max(2.5, goot * .9)), z: (r() - .3) * d * .3 }
    else if (naam === 'plint') params.plint = { h: .9 + r() * 1.4, kleur: donker(gevel) ? KLEUREN.houtBlank : KLEUREN.houtZwart }
    else if (naam === 'balkon') params.gevelElementen.push({ wand: 'kop+', type: 'balkon', u: 0, breedte: Math.min(3, puiBreedte - .5), vloer: 2.6 + r() * .4, diepte: 1.3 })
    zinnen.push(SECUNDAIR[naam].zin)
  }

  // door de wetten: bouwen, valideren, zo nodig repareren; wat dan nog
  // faalt komt nooit bij de klant
  let model, fouten
  try {
    model = bouwModel(params)
    fouten = valideerModel(model)
    if (fouten.length) { model = repareerModel(model); fouten = valideerModel(model) }
  } catch { return null }
  if (fouten.length) return null

  const nokEcht = Math.max(...model.volumes.map(v => v.nok))
  const gootEcht = Math.max(...model.volumes.map(v => v.goot))
  const afst = Math.max(...model.volumes.map(v => Math.max(v.b, v.d))) * 1.35 + 4
  return {
    id: t.id + '-' + massa + '-' + seed,
    naam: t.naam + (massa !== 'enkel' ? ' · ' + MASSAS[massa].naam : ''),
    beschrijving: maakBeschrijving(t, zinnen),
    voet: Math.round(voet), opp: Math.round(voet * (lagen === 2 ? factor : 1)),
    goot: gootEcht, nok: nokEcht, helling: Math.round(helling), plat, past,
    params, model,
    kijk: {
      pos: [afst * .62, nokEcht * .8 + 2.4, afst * .82],
      doel: [0, Math.min(gootEcht, 3.4) * .85, 0], fov: 40,
    },
  }
}

function maakBeschrijving(t, zinnen) {
  const [massa, tweede, ...rest] = zinnen
  let zin = t.kern.charAt(0).toUpperCase() + t.kern.slice(1) + ', als ' + massa + '. '
  if (tweede) {
    zin += tweede.charAt(0).toUpperCase() + tweede.slice(1)
    const extra = rest.filter(Boolean)
    if (extra.length) zin += ', met ' + extra.join(' en ') + '.'
    else zin += '.'
  }
  return zin
}
