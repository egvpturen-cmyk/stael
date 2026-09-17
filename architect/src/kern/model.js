// Gebouwmodel-kern (BIM-denkwijze, plan 2.7): eerst een model met
// elementen en relaties, daarna pas geometrie. De renderer rekent niets
// zelf uit; alles wat getekend wordt staat hier als data.
//
// Determinisme is een harde eis: bouwModel is een pure functie van zijn
// parameterset plus seed. In de kern staat geen enkele Math.random.
//
// Assenstelsel: x = breedte (gevelbreedte kop), y = hoogte, z = diepte.
// Kopgevels liggen op z = +d/2 (kop+) en z = -d/2 (kop-).
// Wandcoordinaten zijn lokaal (u langs de gevel, v = hoogte).

import { STAELDETAILS } from './staeldetails.js'

export const WAND_DIKTE = .28

// deterministische pseudo-random voor latere stappen (nu ongebruikt,
// maar de kern kent per afspraak geen andere randombron)
export function kernRng(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0
    let t = Math.imul(a ^ a >>> 15, 1 | a)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// hoogte van de onderzijde van het dakpakket op kopgevel-positie u.
// De bovenrand van een wand IS deze lijn, per definitie.
export function dakOnderY(u, vol) {
  const { b, goot, nok, nokOffset } = vol
  if (nok <= goot) return goot
  if (u <= nokOffset) return goot + (nok - goot) * ((u + b / 2) / (nokOffset + b / 2))
  return goot + (nok - goot) * ((b / 2 - u) / (b / 2 - nokOffset))
}

// kopgevelcontour: eigen elementtype, volgt de volledige dakcontour
// (driehoek of vijfhoek bij verschoven nok)
export function kopContour(vol) {
  const { b, goot, nok, nokOffset } = vol
  const punten = [[-b / 2, 0], [b / 2, 0], [b / 2, goot]]
  if (nok > goot) punten.push([nokOffset, nok])
  punten.push([-b / 2, goot])
  return punten
}

// sparingpolygon voor een pui die de dakcontour volgt, met marge
function puiContour(vol, cx, breedte, marge, plint = .12) {
  const links = cx - breedte / 2, rechts = cx + breedte / 2
  const punten = [[links, plint], [rechts, plint],
    [rechts, dakOnderY(rechts, vol) - marge]]
  if (vol.nok > vol.goot && vol.nokOffset > links && vol.nokOffset < rechts)
    punten.push([vol.nokOffset, dakOnderY(vol.nokOffset, vol) - marge])
  punten.push([links, dakOnderY(links, vol) - marge])
  return punten
}

// bouwModel: parameterset -> gebouwmodel. Stap 1 dekt een rechthoekig
// volume met zadeldak, een contourpui in de kopgevel en raamritmes in
// de langsgevels.
export function bouwModel(p) {
  const v = p.volume
  const nok = v.nok ?? v.goot + Math.tan(v.helling * Math.PI / 180) * (v.b / 2 - Math.abs(v.nokOffset || 0))

  // detailfamilie: strak/gootloos (default, zoals gebouwd) of een
  // bewust kolossaal maar slank gedetailleerd overstek
  const familie = p.rand?.familie === 'kolossaal' ? 'kolossaal' : 'strak'
  const helling = Math.atan2(nok - v.goot, v.b / 2 - Math.abs(v.nokOffset || 0))
  const cosH = Math.cos(helling)
  const overstekHor = familie === 'kolossaal'
    ? Math.min(STAELDETAILS.kolossaal.overstek[1],
        Math.max(STAELDETAILS.kolossaal.overstek[0], p.rand?.overstek ?? 1.1))
    : STAELDETAILS.strak.overstek

  const vol = {
    id: 'vol-1',
    b: v.b, d: v.d, goot: v.goot, nok,
    nokOffset: v.nokOffset || 0,
    dakDikte: v.dakDikte ?? STAELDETAILS.dak.dikte,
    familie,
    // maten langs het dakvlak en in z, afgeleid uit de familie
    dakInzet: familie === 'strak' ? STAELDETAILS.strak.dakInzet / cosH : 0,
    overstekLangs: overstekHor / cosH,
    overstekKop: familie === 'kolossaal' ? overstekHor * STAELDETAILS.kolossaal.overstekKopFactor : 0,
  }

  const dakvlakken = [-1, 1].map(kant => {
    const gootU = kant * vol.b / 2
    return {
      id: 'dak' + (kant === -1 ? 'L' : 'R'), volumeId: vol.id, kant,
      goot2D: [gootU, vol.goot], nok2D: [vol.nokOffset, vol.nok],
      dikte: vol.dakDikte,
      inzetLangs: vol.dakInzet,
      overstekLangs: vol.overstekLangs, overstekKop: vol.overstekKop,
    }
  })

  // wanden per gevel; bovenrand = onderzijde dakpakket, per constructie
  const wanden = []
  for (const richting of [1, -1]) {
    wanden.push({
      id: 'kop' + (richting === 1 ? '+' : '-'), type: 'kop',
      richting, vlakZ: richting * vol.d / 2,
      contour: kopContour(vol),
      sparingen: [], vulling: [],
    })
  }
  for (const kant of [1, -1]) {
    wanden.push({
      id: 'langs' + (kant === 1 ? '+' : '-'), type: 'langs',
      kant, vlakX: kant * vol.b / 2,
      contour: [[-vol.d / 2, 0], [vol.d / 2, 0], [vol.d / 2, vol.goot], [-vol.d / 2, vol.goot]],
      sparingen: [], vulling: [],
    })
  }
  const wand = id => wanden.find(w => w.id === id)

  // sparingen: openingen IN een gastwand (host-relatie)
  for (const s of p.sparingen || []) {
    const gast = wand(s.wand)
    if (!gast) continue
    if (s.vorm === 'contour' && gast.type === 'kop') {
      gast.sparingen.push({
        id: gast.id + '-pui', type: 'pui',
        poly: puiContour(vol, s.x || 0, s.breedte, s.marge ?? .2),
        stramien: s.stramien || 'stroken',
      })
    } else {
      gast.sparingen.push({
        id: gast.id + '-' + (s.type || 'raam') + '-' + gast.sparingen.length,
        type: s.type || 'raam',
        rect: { u: s.u, v: s.v ?? .3, w: s.w, h: s.h },
      })
    }
  }

  // raamritme op beide langsgevels: stroken van plint tot goot
  if (p.raamRitme) {
    const r = p.raamRitme
    const plint = r.plint ?? .3
    const top = vol.goot - .35
    for (const kant of [1, -1]) {
      const gast = wand('langs' + (kant === 1 ? '+' : '-'))
      for (let i = 0; i < r.n; i++) {
        const u = -vol.d / 2 + vol.d * ((i + .5) / r.n)
        gast.sparingen.push({
          id: gast.id + '-raam-' + i, type: 'raam',
          rect: { u, v: plint, w: r.w ?? .9, h: top - plint },
        })
      }
    }
  }

  // randafwerking: automatisch langs alle dakranden, zodat elke rand
  // per constructie gesloten is; de invulling volgt de detailfamilie
  const randafwerking = [{ type: 'nokvouw', volumeId: vol.id }]
  if (familie === 'strak') {
    // gevel en dakrand vormen een vlak: doorlopend boeideel, verholen goot
    randafwerking.push(
      { type: 'boeideel', kant: 1, volumeId: vol.id },
      { type: 'boeideel', kant: -1, volumeId: vol.id },
      { type: 'boeikop', richting: 1, volumeId: vol.id },
      { type: 'boeikop', richting: -1, volumeId: vol.id },
    )
  } else {
    randafwerking.push(
      { type: 'randprofiel', kant: 1, volumeId: vol.id },
      { type: 'randprofiel', kant: -1, volumeId: vol.id },
      { type: 'windveer', richting: 1, volumeId: vol.id },
      { type: 'windveer', richting: -1, volumeId: vol.id },
      { type: 'gordingen', kant: 1, volumeId: vol.id },
      { type: 'gordingen', kant: -1, volumeId: vol.id },
    )
  }

  return {
    seed: p.seed ?? 1,
    volumes: [vol],
    dakvlakken, wanden, randafwerking,
    kleuren: {
      gevel: p.kleuren?.gevel || '#77644c',
      dak: p.kleuren?.dak || '#232327',
      kozijn: p.kleuren?.kozijn || '#1b1b1e',
      glas: p.kleuren?.glas || '#4c5c6b',
    },
  }
}
