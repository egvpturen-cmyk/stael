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

// snijpunt van twee lijnen P + t*u en Q + s*v
export function snijd(P, u, Q, v) {
  const det = u[0] * v[1] - u[1] * v[0]
  const t = ((Q[0] - P[0]) * v[1] - (Q[1] - P[1]) * v[0]) / det
  return [P[0] + u[0] * t, P[1] + u[1] * t]
}

// richtingen van een dakvlak: eenheid nok->goot en normaal omhoog
export function vlakRichting(vlak) {
  const [gu, gv] = vlak.goot2D, [nu, nv] = vlak.nok2D
  const n0 = Math.hypot(gu - nu, gv - nv)
  const u = [(gu - nu) / n0, (gv - nv) / n0]
  let n = [-u[1], u[0]]
  if (n[1] < 0) n = [-n[0], -n[1]]
  return { u, n, n0, nok: [nu, nv] }
}

// de nok is EEN doorlopende gevouwen afdekking: een knikprofiel waarvan
// de vouwlijn exact op het snijpunt van de twee plaatbovenvlakken ligt
// en de flanken strak op beide dakvlakken aansluiten
export function nokProfiel(dakvlakken, flank, dikte) {
  const [L, R] = dakvlakken.map(vl => {
    const { u, n, nok } = vlakRichting(vl)
    return { u, n, B: [nok[0] + n[0] * vl.dikte, nok[1] + n[1] * vl.dikte] }
  })
  const S = snijd(L.B, L.u, R.B, R.u)
  const Sb = snijd(
    [L.B[0] + L.n[0] * dikte, L.B[1] + L.n[1] * dikte], L.u,
    [R.B[0] + R.n[0] * dikte, R.B[1] + R.n[1] * dikte], R.u)
  const FL = [S[0] + L.u[0] * flank, S[1] + L.u[1] * flank]
  const FR = [S[0] + R.u[0] * flank, S[1] + R.u[1] * flank]
  const FLb = [FL[0] + L.n[0] * dikte, FL[1] + L.n[1] * dikte]
  const FRb = [FR[0] + R.n[0] * dikte, FR[1] + R.n[1] * dikte]
  return [FL, S, FR, FRb, Sb, FLb]
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

// horizontaal bereik binnen de kopgevelcontour op hoogte v
export function kopBereik(v, vol, marge = .12) {
  const { b, goot, nok, nokOffset } = vol
  if (v <= goot) return [-b / 2 + marge, b / 2 - marge]
  if (v >= nok) return null
  const f = (v - goot) / (nok - goot)
  const uMin = -b / 2 + f * (nokOffset + b / 2) + marge
  const uMax = b / 2 - f * (b / 2 - nokOffset) - marge
  return uMax - uMin > .1 ? [uMin, uMax] : null
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
      sparingen: [], vulling: [], elementen: [],
    })
  }
  for (const kant of [1, -1]) {
    wanden.push({
      id: 'langs' + (kant === 1 ? '+' : '-'), type: 'langs',
      kant, vlakX: kant * vol.b / 2,
      contour: [[-vol.d / 2, 0], [vol.d / 2, 0], [vol.d / 2, vol.goot], [-vol.d / 2, vol.goot]],
      sparingen: [], vulling: [], elementen: [],
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

  // gevel-elementen: het gastvlak is de wand (de kopgevel is het
  // expliciete geval), en alles wordt tegen de contour geclipt in het
  // MODEL, zodat de renderer niets meer hoeft te raden
  const dakY = u => dakOnderY(u, vol)
  for (const e of p.gevelElementen || []) {
    const gast = wand(e.wand)
    if (!gast) continue
    const kop = gast.type === 'kop'
    const kleur = e.kleur || null
    if (e.type === 'kader') {
      // stroken die de daklijn volgen plus verticale stijlen tot de rand
      const dik = e.dik ?? .28, uitst = .05
      for (const kant of [1, -1]) {
        const u = kant * (vol.b / 2 - dik / 2)
        gast.elementen.push({ type: 'blok', u, v0: 0, v1: dakY(kant * vol.b / 2) - .02, b: dik, diep: .22, uit: uitst, kleur })
      }
      const stukken = vol.nok > vol.goot
        ? [[-vol.b / 2 + dik, vol.nokOffset], [vol.nokOffset, vol.b / 2 - dik]] : []
      for (const [u1, u2] of stukken) {
        gast.elementen.push({
          type: 'strook', van: [u1, dakY(u1) - .13], tot: [u2, dakY(u2) - .13],
          b: .24, diep: .22, uit: uitst, kleur,
        })
      }
    }
    if (e.type === 'penanten') {
      const n = e.n ?? 3
      const span = e.span ?? vol.b * .5
      for (let i = 1; i <= n; i++) {
        const u = (e.u ?? 0) - span / 2 + (span / (n + 1)) * i
        const v1 = Math.min(e.hMax ?? 1e9, dakY(u) - .15)
        if (v1 > .4) gast.elementen.push({ type: 'blok', u, v0: .05, v1, b: e.b ?? .4, diep: .24, uit: .04, kleur })
      }
    }
    if (e.type === 'lamellenveld') {
      for (let v = e.v0; v <= e.v1; v += e.stap ?? .3) {
        let u0 = (e.u ?? 0) - e.breedte / 2, u1 = (e.u ?? 0) + e.breedte / 2
        if (kop) {
          const ber = kopBereik(v, vol, .15)
          if (!ber) continue
          u0 = Math.max(u0, ber[0]); u1 = Math.min(u1, ber[1])
        }
        if (u1 - u0 > .25) gast.elementen.push({
          type: 'strook', van: [u0, v], tot: [u1, v], b: .07, diep: .16, uit: e.uit ?? .12, kleur,
        })
      }
    }
    if (e.type === 'paneel') {
      let v1 = e.v + e.h
      if (kop) v1 = Math.min(v1, Math.min(dakY(e.u - e.b / 2), dakY(e.u + e.b / 2)) - .12)
      if (v1 - e.v > .25) gast.elementen.push({ type: 'blok', u: e.u, v0: e.v, v1, b: e.b, diep: .06, uit: e.uit ?? .05, kleur })
    }
    if (e.type === 'balkon') {
      gast.elementen.push({
        type: 'balkon', u: e.u ?? 0, breedte: e.breedte ?? 3, vloer: e.vloer ?? 2.85, diepte: e.diepte ?? 1.5,
      })
    }
  }
  // plint: bekleding op de onderste band van alle wanden, automatisch
  // uitgespaard rond de sparingen van elke wand
  if (p.plint) {
    for (const w2 of wanden) {
      const grens = w2.type === 'kop' ? vol.b / 2 : vol.d / 2
      let segmenten = [[-grens, grens]]
      for (const sp of w2.sparingen) {
        const pts = sp.poly || [[sp.rect.u - sp.rect.w / 2, sp.rect.v], [sp.rect.u + sp.rect.w / 2, sp.rect.v + sp.rect.h]]
        const us = pts.map(q => q[0]), vs = pts.map(q => q[1])
        if (Math.min(...vs) < p.plint.h) {
          const a = Math.min(...us) - .02, b2 = Math.max(...us) + .02
          segmenten = segmenten.flatMap(([s0, s1]) =>
            b2 <= s0 || a >= s1 ? [[s0, s1]] : [[s0, Math.min(a, s1)], [Math.max(b2, s0), s1]])
            .filter(([s0, s1]) => s1 - s0 > .05)
        }
      }
      for (const [s0, s1] of segmenten) {
        w2.elementen.push({
          type: 'blok', u: (s0 + s1) / 2, v0: 0, v1: p.plint.h,
          b: s1 - s0, diep: .04, uit: .01, kleur: p.plint.kleur, bekleding: true,
        })
      }
    }
  }

  // randafwerking: automatisch langs alle dakranden, zodat elke rand
  // per constructie gesloten is; de invulling volgt de detailfamilie.
  // boeidelen en windveren worden bij de nok ingekort met de
  // vouwbreedte zodat ze exact tot in de vouw lopen (geen stapeling)
  const nokTrim = STAELDETAILS.nok.vouwBreedte
  const randafwerking = [{
    type: 'nokvouw', volumeId: vol.id,
    profiel: nokProfiel(dakvlakken, STAELDETAILS.nok.vouwBreedte, STAELDETAILS.nok.dikte),
    diepte: vol.d + 2 * vol.overstekKop,
  }]
  if (familie === 'strak') {
    // gevel en dakrand vormen een vlak: doorlopend boeideel, verholen goot
    randafwerking.push(
      { type: 'boeideel', kant: 1, volumeId: vol.id },
      { type: 'boeideel', kant: -1, volumeId: vol.id },
      { type: 'boeikop', richting: 1, volumeId: vol.id, nokTrim },
      { type: 'boeikop', richting: -1, volumeId: vol.id, nokTrim },
    )
  } else {
    randafwerking.push(
      { type: 'randprofiel', kant: 1, volumeId: vol.id },
      { type: 'randprofiel', kant: -1, volumeId: vol.id },
      { type: 'windveer', richting: 1, volumeId: vol.id, nokTrim },
      { type: 'windveer', richting: -1, volumeId: vol.id, nokTrim },
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
