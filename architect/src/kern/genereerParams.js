// Parametergenerator voor de massatest: brede, deterministische variatie
// over programma's, seeds, typologie-achtige vormen en detailfamilies.
// De generator volgt de ONTWERPregels (zoals: een balkon vraagt een pui);
// alle GEOMETRIEregels horen in het model te zitten en worden door de
// validaties gecontroleerd.

import { kernRng } from './model.js'

export function willekeurigeParams(seed) {
  const r = kernRng((seed + 13) * 2654435761)
  const b = 4.5 + r() * 7
  const d = Math.min(26, b * (1.1 + r() * 1.9))
  let goot = 2.2 + r() * 3.8
  const helling = 32 + r() * 26
  const nokOffset = r() < .35 ? (r() - .5) * b * .38 : 0
  const familie = r() < .6 ? undefined : { familie: 'kolossaal', overstek: .8 + r() * .7 }
  // een klein deel is een enkelvoudig plat volume (bungalow)
  const bungalow = r() < .07
  if (bungalow) goot = 2.7 + r() * .9

  const puiBreedte = b * (.4 + r() * .34)
  const params = {
    seed,
    volume: { b, d, goot, helling, nokOffset, plat: bungalow || undefined },
    rand: familie,
    sparingen: [{ wand: 'kop+', vorm: 'contour', x: (r() - .5) * b * .15, breedte: puiBreedte, marge: .18 + r() * .1, stramien: ['stroken', 'grid', 'vlak'][Math.floor(r() * 3)] }],
    raamRitme: { n: 2 + Math.floor(r() * 4), w: .7 + r() * .4, plint: .25 + r() * .2 },
    gevelElementen: [],
  }

  if (r() < .3) params.plint = { h: .6 + r() * 1.2, kleur: '#b09a72' }
  // elementtypen geforceerd aanwezig in een deel van de varianten,
  // zodat de massatest alle element-afheidsregels blijft raken
  const blok = seed % 5
  const heeftKader = blok === 0 || r() < .2
  if (heeftKader) params.gevelElementen.push({ wand: 'kop+', type: 'kader', kleur: '#26262a' })
  if (blok === 0 || r() < .2) params.gevelElementen.push({
    wand: 'kop+', type: 'lamellenveld', grens: heeftKader ? 'kader' : 'dakcontour',
    v0: goot + .3, v1: goot + 1.2 + r() * 2.5, kleur: '#84705a',
  })
  if (blok === 1 || r() < .15) {
    const vloer = 2.5 + r() * .6
    if (vloer < goot + 1.2) params.gevelElementen.push({ wand: 'kop+', type: 'balkon', u: 0, breedte: Math.min(3, puiBreedte - .4), vloer, diepte: 1.2 + r() * .5 })
  }
  if (blok === 2 || r() < .15) params.gevelElementen.push({
    wand: r() < .5 ? 'langs-' : 'langs+', type: 'paneel',
    functie: r() < .55 ? 'ritmevak' : 'poort',
    u: (r() - .5) * d * .5, h: 2.2 + r() * .4, b: 1 + r() * .5, kleur: '#d8d4c9',
  })
  if (blok === 3 || r() < .15) params.gevelElementen.push({
    wand: 'kop+', type: 'penanten', n: 2 + Math.floor(r() * 3), b: .35 + r() * .2,
    span: puiBreedte * .8, hMax: goot + .4, kleur: '#77644c',
  })

  // massastrategieen (stap 3 en 4); een bungalow blijft enkelvoudig
  const lot = bungalow ? 1 : r()
  if (lot < .13 && d > 10) {
    params.massa = {
      type: 'kopstaart',
      dKop: Math.max(4, d * (.28 + r() * .12)),
      gootK: goot + .8 + r() * .8,
      krimp: .78 + r() * .12,
    }
  } else if (lot < .26) {
    params.massa = {
      type: 'aanbouw', kant: r() < .5 ? -1 : 1,
      b: 2.6 + r() * 1.6, d: Math.min(d * .5, 3.5 + r() * 2.5),
      h: Math.min(goot - .15, 2.5 + r() * .7),
      z: (r() - .3) * d * .3,
    }
  } else if (lot < .44) {
    // dwarskap, bewust ook in vervelende verhoudingen: smal op breed,
    // breed op smal, verschoven posities, beide detailfamilies
    const smal = r() < .5
    params.massa = {
      type: 'dwarskap', kant: r() < .5 ? -1 : 1,
      b2: smal ? 3 + r() * 1.6 : b * (.5 + r() * .4),
      goot2: goot - .4 + r() * 1.1,
      helling2: 32 + r() * 26,
      uitsteek: 1.2 + r() * 2.3,
      z: (r() - .5) * d * .8,
    }
  } else if (lot < .68) {
    // stapelmassa: platte dozen, ook in vervelende verhoudingen; een
    // flink deel met forse uitkraging (carport-inham op kolommen)
    const carport = r() < .4
    params.massa = {
      type: 'stapel',
      h1: 2.8 + r() * .9, h2: 2.6 + r() * .8,
      b2: b * (.55 + r() * .55), d2: d * (.4 + r() * .5),
      dx: carport ? (r() < .5 ? -1 : 1) * (b * .5 + .8 + r() * 1.8) : (r() - .5) * b * .8,
      dz: (r() - .5) * d * .8,
      terras: r() < .8,
    }
    if (r() < .4) params.massa.opbouw = { b: 2 + r() * 1.4, d: 1.8 + r() * 1.2, h: 2.5 + r() * .4 }
    params.raamRitme = null
    params.sparingen = []
  }
  // op een plat gastvlak bestaan kader, lamellen en balkon niet
  if (bungalow || params.massa?.type === 'stapel') {
    params.gevelElementen = params.gevelElementen.filter(e2 => e2.type === 'paneel' || e2.type === 'penanten')
  }
  const geenKap = bungalow || params.massa?.type === 'stapel'
  const uitLot = r()
  if (!geenKap && uitLot < .22) params.uitbouw = { type: 'veranda', diepte: 1.8 + r() * 1.6, kolommen: 2 + Math.floor(r() * 2) }
  else if (!geenKap && uitLot < .34) params.uitbouw = { type: 'portaal', uit: .5 + r() * 1.6 }
  else if (!geenKap && uitLot < .45) params.uitbouw = { type: 'zijluifel', kant: r() < .5 ? -1 : 1, uit: 1.2 + r() * 1.2 }
  else if (uitLot < .68) params.uitbouw = {
    type: 'pergola', kant: r() < .5 ? -1 : 1,
    diepte: 1.6 + r() * 1.7, breedte: 2.2 + r() * 2.4, z: (r() - .5) * d * .4,
  }

  return params
}
