// Gebouwmodel-kern (BIM-denkwijze, plan 2.7): eerst een model met
// elementen en relaties, daarna pas geometrie. De renderer rekent niets
// zelf uit; alles wat getekend wordt staat hier als data.
//
// Determinisme is een harde eis: bouwModel is een pure functie van zijn
// parameterset plus seed. In de kern staat geen enkele Math.random.
//
// Assenstelsel: x = breedte (gevelbreedte kop), y = hoogte, z = diepte.
// Elk volume heeft een eigen positie; kopgevels liggen in volume-lokaal
// op z = +d/2 (kop+) en z = -d/2 (kop-). Waar volumes elkaar raken
// krijgen de wanden een contactmasker: daar is geen buitenschil.

import { STAELDETAILS } from './staeldetails.js'

export const WAND_DIKTE = .28

export function kernRng(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0
    let t = Math.imul(a ^ a >>> 15, 1 | a)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}

// de kop-min-gevel is in zijn eigen lokale stelsel gespiegeld ten
// opzichte van de wereld-x-as: van buiten kijkend zit een verschoven
// nok aan de andere kant. Gebruik dit overal waar wand-lokale
// coordinaten tegen het dak worden gehouden.
export function wandVol(wand, vol) {
  if (wand.type === 'kop' && wand.richting === -1 && vol.nokOffset)
    return { ...vol, nokOffset: -vol.nokOffset }
  return vol
}

// hoogte van de onderzijde van het dakpakket op kopgevel-positie u
export function dakOnderY(u, vol) {
  const { b, goot, nok, nokOffset } = vol
  if (vol.plat || nok <= goot) return goot
  if (u <= nokOffset) return goot + (nok - goot) * ((u + b / 2) / (nokOffset + b / 2))
  return goot + (nok - goot) * ((b / 2 - u) / (b / 2 - nokOffset))
}

export function snijd(P, u, Q, v) {
  const det = u[0] * v[1] - u[1] * v[0]
  const t = ((Q[0] - P[0]) * v[1] - (Q[1] - P[1]) * v[0]) / det
  return [P[0] + u[0] * t, P[1] + u[1] * t]
}

export function vlakRichting(vlak) {
  const [gu, gv] = vlak.goot2D, [nu, nv] = vlak.nok2D
  const n0 = Math.hypot(gu - nu, gv - nv)
  const u = [(gu - nu) / n0, (gv - nv) / n0]
  let n = [-u[1], u[0]]
  if (n[1] < 0) n = [-n[0], -n[1]]
  return { u, n, n0, nok: [nu, nv] }
}

// de nok is EEN doorlopende gevouwen afdekking (knikprofiel)
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
  return [FL, S, FR,
    [FR[0] + R.n[0] * dikte, FR[1] + R.n[1] * dikte], Sb,
    [FL[0] + L.n[0] * dikte, FL[1] + L.n[1] * dikte]]
}

export function kopContour(vol) {
  const { b, goot, nok, nokOffset } = vol
  const punten = [[-b / 2, 0], [b / 2, 0], [b / 2, goot]]
  if (!vol.plat && nok > goot) punten.push([nokOffset, nok])
  punten.push([-b / 2, goot])
  return punten
}

export function kopBereik(v, vol, marge = .12) {
  const { b, goot, nok, nokOffset } = vol
  if (vol.plat || v <= goot) return [-b / 2 + marge, b / 2 - marge]
  if (v >= nok) return null
  const f = (v - goot) / (nok - goot)
  const uMin = -b / 2 + f * (nokOffset + b / 2) + marge
  const uMax = b / 2 - f * (b / 2 - nokOffset) - marge
  return uMax - uMin > .1 ? [uMin, uMax] : null
}

function puiContour(vol, cx, breedte, marge, plint = .12) {
  const links = cx - breedte / 2, rechts = cx + breedte / 2
  const punten = [[links, plint], [rechts, plint],
    [rechts, dakOnderY(rechts, vol) - marge]]
  if (!vol.plat && vol.nok > vol.goot && vol.nokOffset > links && vol.nokOffset < rechts)
    punten.push([vol.nokOffset, dakOnderY(vol.nokOffset, vol) - marge])
  punten.push([links, dakOnderY(links, vol) - marge])
  return punten
}

// ---- opbouw van een volume: wanden, dakvlakken, randafwerking ----
function maakVolume(id, rol, v, rand, opties = {}) {
  const plat = !!v.plat
  const helling = plat ? 0 : Math.atan2(
    (v.nok ?? v.goot + Math.tan(v.helling * Math.PI / 180) * (v.b / 2 - Math.abs(v.nokOffset || 0))) - v.goot,
    v.b / 2 - Math.abs(v.nokOffset || 0))
  const nok = plat ? v.goot
    : v.nok ?? v.goot + Math.tan(v.helling * Math.PI / 180) * (v.b / 2 - Math.abs(v.nokOffset || 0))
  const familie = rand?.familie === 'kolossaal' ? 'kolossaal' : 'strak'
  const cosH = Math.cos(helling) || 1
  const overstekHor = familie === 'kolossaal'
    ? Math.min(STAELDETAILS.kolossaal.overstek[1],
        Math.max(STAELDETAILS.kolossaal.overstek[0], rand?.overstek ?? 1.1))
    : STAELDETAILS.strak.overstek

  const vol = {
    id, rol, plat,
    b: v.b, d: v.d, goot: v.goot, nok, nokOffset: v.nokOffset || 0,
    dakDikte: v.dakDikte ?? (plat ? .14 : STAELDETAILS.dak.dikte),
    familie,
    dakInzet: !plat && familie === 'strak' ? STAELDETAILS.strak.dakInzet / cosH : 0,
    overstekLangs: plat ? 0 : overstekHor / cosH,
    overstekKop: !plat && familie === 'kolossaal' ? overstekHor * STAELDETAILS.kolossaal.overstekKopFactor : 0,
    pos: v.pos || [0, 0],   // [x, z]
    verandaKop: opties.verandaKop || 0,   // dakverlenging aan kop+
  }
  // bij een portaal eindigt het dak op het portaalkader: geen extra
  // kop-overstek daarbovenop (het kader is de dakrand)
  if (vol.verandaKop && vol.verandaKop.portaal) vol.overstekKop = 0

  const dakvlakken = plat
    ? [{ id: id + ':dakplat', volumeId: id, plat: true, dikte: vol.dakDikte }]
    : [-1, 1].map(kant => ({
      id: id + ':dak' + (kant === -1 ? 'L' : 'R'), volumeId: id, kant,
      goot2D: [kant * vol.b / 2, vol.goot], nok2D: [vol.nokOffset, vol.nok],
      dikte: vol.dakDikte, inzetLangs: vol.dakInzet,
      overstekLangs: vol.overstekLangs, overstekKop: vol.overstekKop,
      verandaKop: vol.verandaKop ? vol.verandaKop.diepte : 0,
      zijLuifel: opties.zijLuifel && opties.zijLuifel.kant === kant ? opties.zijLuifel : null,
    }))

  const wanden = []
  for (const richting of [1, -1]) {
    const w = {
      id: id + ':kop' + (richting === 1 ? '+' : '-'), volumeId: id, type: 'kop',
      richting, contour: null,
      sparingen: [], elementen: [], maskers: [],
    }
    w.contour = kopContour(wandVol(w, vol))
    wanden.push(w)
  }
  for (const kant of [1, -1]) {
    wanden.push({
      id: id + ':langs' + (kant === 1 ? '+' : '-'), volumeId: id, type: 'langs',
      kant, contour: [[-vol.d / 2, 0], [vol.d / 2, 0], [vol.d / 2, vol.goot], [-vol.d / 2, vol.goot]],
      sparingen: [], elementen: [], maskers: [],
    })
  }

  const randafwerking = []
  if (plat) {
    for (const randNaam of ['kop+', 'kop-', 'langs+', 'langs-']) {
      randafwerking.push({ type: 'daklijst', volumeId: id, rand: randNaam })
    }
  } else {
    randafwerking.push({
      type: 'nokvouw', volumeId: id,
      profiel: nokProfiel(dakvlakken, STAELDETAILS.nok.vouwBreedte, STAELDETAILS.nok.dikte),
      // oversteek per kopse kant; op een contactzijde geen oversteek
      diepteVoor: vol.d / 2 + vol.overstekKop + (vol.verandaKop ? vol.verandaKop.diepte : 0) + STAELDETAILS.nok.kopOverlap,
      diepteAchter: vol.d / 2 + vol.overstekKop + STAELDETAILS.nok.kopOverlap,
    })
    // bij een portaal vervangt het kader de windveer of boeikop aan de
    // portaalzijde
    const portaalVoor = !!(vol.verandaKop && vol.verandaKop.portaal)
    if (familie === 'strak') {
      randafwerking.push(
        { type: 'boeideel', kant: 1, volumeId: id },
        { type: 'boeideel', kant: -1, volumeId: id },
        { type: 'boeikop', richting: -1, volumeId: id },
      )
      if (!portaalVoor) randafwerking.push({ type: 'boeikop', richting: 1, volumeId: id })
    } else {
      randafwerking.push(
        { type: 'randprofiel', kant: 1, volumeId: id },
        { type: 'randprofiel', kant: -1, volumeId: id },
        { type: 'windveer', richting: -1, volumeId: id },
        { type: 'gordingen', kant: 1, volumeId: id },
        { type: 'gordingen', kant: -1, volumeId: id },
      )
      if (!portaalVoor) randafwerking.push({ type: 'windveer', richting: 1, volumeId: id })
    }
    if (vol.verandaKop) {
      randafwerking.push({ type: 'verandakolommen', volumeId: id, ...vol.verandaKop })
    }
  }
  return { vol, wanden, dakvlakken, randafwerking }
}

function verwijderRand(model, volumeId, test) {
  model.randafwerking = model.randafwerking.filter(r => !(r.volumeId === volumeId && test(r)))
}

// ---- bouwModel: parameterset -> gebouwmodel met relaties ----
export function bouwModel(p) {
  const model = { seed: p.seed ?? 1, volumes: [], wanden: [], dakvlakken: [], randafwerking: [] }
  const voeg = deel => {
    model.volumes.push(deel.vol)
    model.wanden.push(...deel.wanden)
    model.dakvlakken.push(...deel.dakvlakken)
    model.randafwerking.push(...deel.randafwerking)
  }
  const wand = id => model.wanden.find(w => w.id === id)
  const volVan = w => model.volumes.find(v => v.id === w.volumeId)

  const uitbouw = p.uitbouw || null
  const hoofdOpties = {}
  if (uitbouw?.type === 'veranda') hoofdOpties.verandaKop = { diepte: uitbouw.diepte, kolommen: uitbouw.kolommen ?? 2 }
  if (uitbouw?.type === 'portaal') hoofdOpties.verandaKop = { diepte: uitbouw.uit, kolommen: 0, portaal: true }
  if (uitbouw?.type === 'zijluifel') hoofdOpties.zijLuifel = { kant: uitbouw.kant, uit: uitbouw.uit, wandKleur: uitbouw.wandKleur || '#31302c' }

  let hoofdWandId = w => 'hoofd:' + w

  if (p.massa?.type === 'kopstaart') {
    // kopgebouw voor, langere lagere staart erachter; de staart steekt
    // 5 cm in het kopvolume zodat de aansluiting per constructie dicht is
    const m = p.massa
    const dKop = Math.min(m.dKop, p.volume.d - 3)
    const dStaart = p.volume.d - dKop + .05
    const bS = p.volume.b * (m.krimp ?? .8)
    const kop = maakVolume('kop', 'kop', {
      ...p.volume, d: dKop,
      goot: Math.min(m.gootK ?? p.volume.goot + 1, (m.gootK ?? p.volume.goot + 1)),
      pos: [0, (p.volume.d - dKop) / 2],
    }, p.rand, hoofdOpties)
    const staart = maakVolume('staart', 'staart', {
      ...p.volume, b: bS, d: dStaart,
      nok: undefined, nokOffset: (p.volume.nokOffset || 0) * (bS / p.volume.b),
      pos: [0, -(p.volume.d - dStaart) / 2 + .025],
    }, p.rand)
    // de staartnok moet onder de kopnok blijven: anders is het geen
    // kop-en-staart; regel in het model, niet in de reparatie
    if (staart.vol.nok > kop.vol.nok - .4) {
      const doel = kop.vol.nok - .5
      staart.vol.nok = Math.max(staart.vol.goot + .6, doel)
      staart.dakvlakken.forEach(dv => { dv.nok2D = [staart.vol.nokOffset, staart.vol.nok] })
      const her = nokProfiel(staart.dakvlakken, STAELDETAILS.nok.vouwBreedte, STAELDETAILS.nok.dikte)
      staart.randafwerking.find(r => r.type === 'nokvouw').profiel = her
      staart.wanden.filter(w => w.type === 'kop').forEach(w => { w.contour = kopContour(wandVol(w, staart.vol)) })
    }
    voeg(kop); voeg(staart)
    // contact: de staart-voorgevel staat tegen de kop-achtergevel
    // (maskers in wand-lokale coordinaten, dus gespiegeld op kop-)
    wand('staart:kop+').maskers.push({ poly: kopContour(kop.vol), reden: 'contact met kop' })
    wand('kop:kop-').maskers.push({
      poly: kopContour({ ...staart.vol, nokOffset: -staart.vol.nokOffset }), reden: 'contact met staart',
    })
    // geen boeikop of windveer op de contactzijden; de nokvouw steekt
    // daar ook niet over
    verwijderRand(model, 'staart', r => (r.type === 'boeikop' || r.type === 'windveer') && r.richting === 1)
    // de staartnokvouw loopt tot in de kopwand: geen reepje kale nok
    model.randafwerking.find(r => r.volumeId === 'staart' && r.type === 'nokvouw').diepteVoor = staart.vol.d / 2 + .02
    hoofdWandId = w => (w === 'kop+' ? 'kop:kop+' : w.startsWith('langs') ? 'staart:' + w : 'kop:' + w)
    // raamritme hoort bij de staart, pui en kopelementen bij de kop
  } else {
    voeg(maakVolume('hoofd', 'hoofd', p.volume, p.rand, hoofdOpties))
  }

  if (p.massa?.type === 'aanbouw') {
    const m = p.massa
    const hoofd = model.volumes[0]
    const dA = Math.min(m.d, hoofd.d * .7)
    const hA = Math.min(m.h, hoofd.goot - .12)
    const zA = Math.max(-hoofd.d / 2 + dA / 2 + .2, Math.min(hoofd.d / 2 - dA / 2 - .2, m.z ?? 0))
    const aan = maakVolume('aanbouw', 'aanbouw', {
      b: m.b + .05, d: dA, goot: hA, plat: true,
      pos: [m.kant * (hoofd.b / 2 + m.b / 2 - .05), zA],
    }, null)
    voeg(aan)
    // contact: de aanbouw staat met zijn binnenlangsgevel tegen het hoofd
    const binnen = m.kant === 1 ? 'aanbouw:langs-' : 'aanbouw:langs+'
    wand(binnen).maskers.push({
      poly: [[-dA / 2, 0], [dA / 2, 0], [dA / 2, hA], [-dA / 2, hA]], reden: 'contact met hoofd',
    })
    const hoofdLangs = m.kant === 1 ? 'hoofd:langs+' : 'hoofd:langs-'
    const wz = wand(hoofdLangs) || wand('staart:langs' + (m.kant === 1 ? '+' : '-'))
    if (wz) {
      // masker in langs-lokaal (u = z): aanbouwzone tot aanbouwhoogte
      wz.maskers.push({ poly: [[zA - dA / 2, 0], [zA + dA / 2, 0], [zA + dA / 2, hA], [zA - dA / 2, hA]], reden: 'contact met aanbouw' })
    }
    verwijderRand(model, 'aanbouw', r => r.type === 'daklijst' && r.rand === (m.kant === 1 ? 'langs-' : 'langs+'))
  }

  // ---- sparingen ----
  for (const s of p.sparingen || []) {
    const gast = wand(hoofdWandId(s.wand)) || wand(s.wand)
    if (!gast) continue
    const gv = volVan(gast)
    if (s.vorm === 'contour' && gast.type === 'kop') {
      gast.sparingen.push({
        id: gast.id + '-pui', type: 'pui',
        poly: puiContour(wandVol(gast, gv), s.x || 0, Math.min(s.breedte, gv.b - .8), s.marge ?? .2),
        stramien: s.stramien || 'stroken',
      })
    } else if (s.w) {
      gast.sparingen.push({
        id: gast.id + '-' + (s.type || 'raam') + '-' + gast.sparingen.length,
        type: s.type || 'raam',
        rect: { u: s.u, v: s.v ?? .3, w: s.w, h: s.h },
      })
    }
  }
  if (p.raamRitme) {
    const r = p.raamRitme
    const doelVol = model.volumes.find(v => v.rol === 'staart') || model.volumes[0]
    const plintH = r.plint ?? .3
    for (const kant of [1, -1]) {
      const gast = wand(doelVol.id + ':langs' + (kant === 1 ? '+' : '-'))
      const top = doelVol.goot - .35
      if (top - plintH < .5) continue
      for (let i = 0; i < r.n; i++) {
        const u = -doelVol.d / 2 + doelVol.d * ((i + .5) / r.n)
        // niet in een contactzone (aanbouw) plaatsen
        const inMasker = gast.maskers.some(mk => {
          const us = mk.poly.map(q => q[0])
          return u > Math.min(...us) - .6 && u < Math.max(...us) + .6
        })
        if (inMasker) continue
        gast.sparingen.push({
          id: gast.id + '-raam-' + i, type: 'raam',
          rect: { u, v: plintH, w: r.w ?? .9, h: top - plintH },
        })
      }
    }
  }

  // ---- gevel-elementen ----
  for (const e of p.gevelElementen || []) {
    const gast = wand(hoofdWandId(e.wand)) || wand(e.wand)
    if (!gast) continue
    const gvEcht = volVan(gast)
    const gv = wandVol(gast, gvEcht)
    const kop = gast.type === 'kop'
    const dakY = u => dakOnderY(u, gv)
    const kleur = e.kleur || null
    if (e.type === 'kader' && !gv.plat) {
      const dik = e.dik ?? .28, uitst = .05
      for (const kant of [1, -1]) {
        const u = kant * (gv.b / 2 - dik / 2)
        gast.elementen.push({ type: 'blok', u, v0: 0, v1: dakY(kant * gv.b / 2) - .02, b: dik, diep: .22, uit: uitst, kleur })
      }
      const stukken = gv.nok > gv.goot
        ? [[-gv.b / 2 + dik, gv.nokOffset], [gv.nokOffset, gv.b / 2 - dik]] : []
      for (const [u1, u2] of stukken) {
        gast.elementen.push({
          type: 'strook', van: [u1, dakY(u1) - .13], tot: [u2, dakY(u2) - .13],
          b: .24, diep: .22, uit: uitst, kleur,
        })
      }
    }
    if (e.type === 'penanten') {
      const n = e.n ?? 3
      const span = Math.min(e.span ?? gv.b * .5, gv.b - .8)
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
          const ber = kopBereik(v, gv, .15)
          if (!ber) continue
          u0 = Math.max(u0, ber[0]); u1 = Math.min(u1, ber[1])
        } else if (v > gv.goot - .15) continue
        if (u1 - u0 > .25) gast.elementen.push({
          type: 'strook', van: [u0, v], tot: [u1, v], b: .07, diep: .16, uit: e.uit ?? .12, kleur,
        })
      }
    }
    if (e.type === 'paneel') {
      let v1 = e.v + e.h
      if (kop) v1 = Math.min(v1, Math.min(dakY(e.u - e.b / 2), dakY(e.u + e.b / 2)) - .12)
      else v1 = Math.min(v1, gv.goot - .1)
      const grens = (kop ? gv.b : gv.d) / 2 - .1
      const u = Math.max(-(grens - e.b / 2), Math.min(grens - e.b / 2, e.u))
      if (v1 - e.v > .25) gast.elementen.push({ type: 'blok', u, v0: e.v, v1, b: e.b, diep: .06, uit: e.uit ?? .05, kleur })
    }
    if (e.type === 'balkon') {
      gast.elementen.push({
        type: 'balkon', u: e.u ?? 0, breedte: Math.min(e.breedte ?? 3, gv.b - 1),
        vloer: e.vloer ?? 2.85, diepte: e.diepte ?? 1.5,
      })
    }
  }

  // ---- plint: bekleding, automatisch uitgespaard rond sparingen ----
  if (p.plint) {
    for (const w2 of model.wanden) {
      const gv = volVan(w2)
      const grens = w2.type === 'kop' ? gv.b / 2 : gv.d / 2
      const h = Math.min(p.plint.h, gv.goot - .15)
      if (h < .2) continue
      let segmenten = [[-grens, grens]]
      const knip = (a, b2) => {
        segmenten = segmenten.flatMap(([s0, s1]) =>
          b2 <= s0 || a >= s1 ? [[s0, s1]] : [[s0, Math.min(a, s1)], [Math.max(b2, s0), s1]])
          .filter(([s0, s1]) => s1 - s0 > .05)
      }
      for (const sp of w2.sparingen) {
        const pts = sp.poly || [[sp.rect.u - sp.rect.w / 2, sp.rect.v], [sp.rect.u + sp.rect.w / 2, sp.rect.v + sp.rect.h]]
        const us = pts.map(q => q[0]), vs = pts.map(q => q[1])
        if (Math.min(...vs) < h) knip(Math.min(...us) - .02, Math.max(...us) + .02)
      }
      for (const mk of w2.maskers) {
        const us = mk.poly.map(q => q[0]), vs = mk.poly.map(q => q[1])
        if (Math.min(...vs) < h) knip(Math.min(...us) - .01, Math.max(...us) + .01)
      }
      for (const [s0, s1] of segmenten) {
        w2.elementen.push({
          type: 'blok', u: (s0 + s1) / 2, v0: 0, v1: h,
          b: s1 - s0, diep: .04, uit: .01, kleur: p.plint.kleur, bekleding: true,
        })
      }
    }
  }

  model.kleuren = {
    gevel: p.kleuren?.gevel || '#77644c',
    dak: p.kleuren?.dak || '#232327',
    kozijn: p.kleuren?.kozijn || '#1b1b1e',
    glas: p.kleuren?.glas || '#4c5c6b',
  }
  return model
}
