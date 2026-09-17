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
  const goot = 2.2 + r() * 3.8
  const helling = 32 + r() * 26
  const nokOffset = r() < .35 ? (r() - .5) * b * .38 : 0
  const familie = r() < .6 ? undefined : { familie: 'kolossaal', overstek: .8 + r() * .7 }

  const puiBreedte = b * (.4 + r() * .34)
  const params = {
    seed,
    volume: { b, d, goot, helling, nokOffset },
    rand: familie,
    sparingen: [{ wand: 'kop+', vorm: 'contour', x: (r() - .5) * b * .15, breedte: puiBreedte, marge: .18 + r() * .1, stramien: ['stroken', 'grid', 'vlak'][Math.floor(r() * 3)] }],
    raamRitme: { n: 2 + Math.floor(r() * 4), w: .7 + r() * .4, plint: .25 + r() * .2 },
    gevelElementen: [],
  }

  if (r() < .3) params.plint = { h: .6 + r() * 1.2, kleur: '#b09a72' }
  if (r() < .3) params.gevelElementen.push({ wand: 'kop+', type: 'kader', kleur: '#26262a' })
  if (r() < .25) params.gevelElementen.push({
    wand: 'kop+', type: 'lamellenveld', u: (r() - .5) * b * .2,
    breedte: b * (.4 + r() * .3), v0: goot + .3, v1: goot + 1.2 + r() * 2.5, kleur: '#84705a',
  })
  if (r() < .2) {
    // balkon vraagt een pui erachter: alleen als de vloer onder de puitop ligt
    const vloer = 2.5 + r() * .6
    if (vloer < goot + 1.2) params.gevelElementen.push({ wand: 'kop+', type: 'balkon', u: 0, breedte: Math.min(3, puiBreedte - .4), vloer, diepte: 1.2 + r() * .5 })
  }
  if (r() < .25) params.gevelElementen.push({
    wand: r() < .5 ? 'langs-' : 'langs+', type: 'paneel',
    u: (r() - .5) * d * .5, v: .2, h: 1.5 + r() * 1.5, b: 1 + r() * .8, kleur: '#d8d4c9',
  })
  if (r() < .25) params.gevelElementen.push({
    wand: 'kop+', type: 'penanten', n: 2 + Math.floor(r() * 3), b: .35 + r() * .2,
    span: puiBreedte * .8, hMax: goot + .4, kleur: '#77644c',
  })

  // massastrategieen (stap 3)
  const lot = r()
  if (lot < .18 && d > 10) {
    params.massa = {
      type: 'kopstaart',
      dKop: Math.max(4, d * (.28 + r() * .12)),
      gootK: goot + .8 + r() * .8,
      krimp: .78 + r() * .12,
    }
  } else if (lot < .36) {
    params.massa = {
      type: 'aanbouw', kant: r() < .5 ? -1 : 1,
      b: 2.6 + r() * 1.6, d: Math.min(d * .5, 3.5 + r() * 2.5),
      h: Math.min(goot - .15, 2.5 + r() * .7),
      z: (r() - .3) * d * .3,
    }
  }
  if (r() < .22) params.uitbouw = { type: 'veranda', diepte: 1.8 + r() * 1.6, kolommen: 2 + Math.floor(r() * 2) }
  else if (r() < .15) params.uitbouw = { type: 'portaal', uit: .5 + r() * 1.6 }
  else if (r() < .15) params.uitbouw = { type: 'zijluifel', kant: r() < .5 ? -1 : 1, uit: 1.2 + r() * 1.2 }

  return params
}
