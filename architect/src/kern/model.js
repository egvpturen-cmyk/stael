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

// Ontmoetingsregister: er zijn geen voorkeurswetten over WELK detail
// gebruikt wordt; elke optie hieronder is geldig. De enige wet is dat
// elke ontmoeting van bouwdelen precies EEN gekozen, volledig
// uitgevoerde detailoplossing heeft. De generator kiest per variant,
// de validatie eist de complete uitvoering.
export const ONTMOETINGSOPTIES = {
  nok: ['nokvouw'],
  kil: ['kilkeper'],
  gootrand: ['verholen', 'randprofiel'],
  koprand: ['boeikop', 'windveer', 'portaal', 'wandcontact'],
  dakwand: ['ingewerkt', 'aansluitprofiel'],
  keperskop: ['zicht', 'afgedekt'],
  platrand: ['daklijst', 'wandcontact'],
}

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

// wand-lokale u voor een wereldcoordinaat langs de gevel: langs+ en
// kop- zijn in hun eigen stelsel gespiegeld
export function wandLokaalU(wand, wereld) {
  if (wand.type === 'langs') return wand.kant === 1 ? -wereld : wereld
  return wand.richting === -1 ? -wereld : wereld
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

// 3D-vlak van een dakvlak (bovenzijde plaat als boven=true): punt+normaal
// in wereldcoordinaten; het hoofdvolume heeft ry 0, een dwarsvolume ry
// +-pi/2 (nok langs de wereld-x-as)
export function dakVlak3D(vlak, vol, boven = false) {
  const { u, n, nok } = vlakRichting(vlak)
  const vry = vol.ry || 0
  const c = Math.cos(vry), s = Math.sin(vry)
  const [px, pz] = vol.pos || [0, 0]
  // lokaal punt op de daklijn (nok) plus eventueel de plaatdikte
  const lp = [nok[0] + (boven ? n[0] * vlak.dikte : 0), nok[1] + (boven ? n[1] * vlak.dikte : 0)]
  const P = [px + c * lp[0], lp[1], pz - s * lp[0]]
  const N = [c * n[0], n[1], -s * n[0]]
  return { P, N }
}

// snijlijn van twee 3D-vlakken: punt + richting
export function snijlijn(A, B) {
  const r = [
    A.N[1] * B.N[2] - A.N[2] * B.N[1],
    A.N[2] * B.N[0] - A.N[0] * B.N[2],
    A.N[0] * B.N[1] - A.N[1] * B.N[0],
  ]
  const len = Math.hypot(...r)
  const richting = r.map(x => x / len)
  // punt op de lijn: los op met de as met de grootste richtingscomponent nul
  const dA = A.N[0] * A.P[0] + A.N[1] * A.P[1] + A.N[2] * A.P[2]
  const dB = B.N[0] * B.P[0] + B.N[1] * B.P[1] + B.N[2] * B.P[2]
  const abs = richting.map(Math.abs)
  const vast = abs[0] >= abs[1] && abs[0] >= abs[2] ? 0 : abs[1] >= abs[2] ? 1 : 2
  const [i, j] = vast === 0 ? [1, 2] : vast === 1 ? [0, 2] : [0, 1]
  const det = A.N[i] * B.N[j] - A.N[j] * B.N[i]
  const punt = [0, 0, 0]
  punt[i] = (dA * B.N[j] - dB * A.N[j]) / det
  punt[j] = (A.N[i] * dB - B.N[i] * dA) / det
  return { punt, richting }
}

// punt op een lijn bij gegeven hoogte y
export function lijnOpY(lijn, y) {
  const t = (y - lijn.punt[1]) / lijn.richting[1]
  return [lijn.punt[0] + lijn.richting[0] * t, y, lijn.punt[2] + lijn.richting[2] * t]
}

export function kopContour(vol) {
  const { b, goot, nok, nokOffset } = vol
  const basis = vol.basis || 0
  const punten = [[-b / 2, basis], [b / 2, basis], [b / 2, goot]]
  if (!vol.plat && nok > goot) punten.push([nokOffset, nok])
  punten.push([-b / 2, goot])
  return punten
}

// wereld-voetafdruk van een volume zonder rotatie (gestapelde dozen)
export function rectVan(vol) {
  const [px, pz] = vol.pos || [0, 0]
  return { x0: px - vol.b / 2, x1: px + vol.b / 2, z0: pz - vol.d / 2, z1: pz + vol.d / 2 }
}

// vrije randsegmenten van een begaanbaar dak: de dakranden minus de
// stukken waar een doos van de volgende laag op de rand staat. Model en
// validatie gebruiken dezelfde meetkunde (zoals bij nokProfiel).
export function terrasSegmenten(model, dakVol) {
  const niveau = dakVol.goot + dakVol.dakDikte
  const R = rectVan(dakVol)
  const occ = model.volumes.filter(o => o.id !== dakVol.id && Math.abs((o.basis || 0) - niveau) < .05)
    .filter(o => { const r = rectVan(o); return r.x0 < R.x1 && r.x1 > R.x0 && r.z0 < R.z1 && r.z1 > R.z0 })
  const uit = {}
  for (const rand of ['kop+', 'kop-', 'langs+', 'langs-']) {
    const langsX = rand.startsWith('kop')
    let segs = [langsX ? [R.x0, R.x1] : [R.z0, R.z1]]
    for (const o of occ) {
      const r = rectVan(o)
      const raakt = rand === 'kop+' ? r.z1 >= R.z1 - .05 : rand === 'kop-' ? r.z0 <= R.z0 + .05
        : rand === 'langs+' ? r.x1 >= R.x1 - .05 : r.x0 <= R.x0 + .05
      if (!raakt) continue
      const [a, b] = langsX ? [r.x0, r.x1] : [r.z0, r.z1]
      segs = segs.flatMap(([s0, s1]) => b <= s0 + .01 || a >= s1 - .01 ? [[s0, s1]]
        : [[s0, Math.min(a, s1)], [Math.max(b, s0), s1]]).filter(([s0, s1]) => s1 - s0 > .3)
    }
    uit[rand] = segs
  }
  return uit
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
    basis: v.basis || 0,
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
      kant, contour: [[-vol.d / 2, vol.basis], [vol.d / 2, vol.basis], [vol.d / 2, vol.goot], [-vol.d / 2, vol.goot]],
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

// doorlopende glasband in een wand, geknipt rond bestaande sparingen,
// maskers en opliggende elementen (een band achter een poort bestaat niet)
function voegGlasband(w2, vol2, v0, v1) {
  if (!w2 || v1 - v0 < .55) return
  const halve = (w2.type === 'kop' ? vol2.b : vol2.d) / 2 - .45
  if (halve < .5) return
  let segs = [[-halve, halve]]
  const knip = (a, b2) => {
    segs = segs.flatMap(([s0, s1]) => b2 <= s0 || a >= s1 ? [[s0, s1]]
      : [[s0, Math.min(a, s1)], [Math.max(b2, s0), s1]]).filter(([s0, s1]) => s1 - s0 > .7)
  }
  for (const sp of w2.sparingen) {
    const pts = sp.poly || [[sp.rect.u - sp.rect.w / 2, 0], [sp.rect.u + sp.rect.w / 2, 0]]
    const us = pts.map(q => q[0])
    knip(Math.min(...us) - .22, Math.max(...us) + .22)
  }
  for (const mk of w2.maskers) {
    const us = mk.poly.map(q => q[0])
    knip(Math.min(...us) - .1, Math.max(...us) + .1)
  }
  for (const el of w2.elementen || []) {
    if (el.type === 'blok') knip(el.u - el.b / 2 - .15, el.u + el.b / 2 + .15)
  }
  let n = 0
  for (const [s0, s1] of segs) {
    w2.sparingen.push({
      id: w2.id + '-band-' + n++, type: 'band',
      rect: { u: (s0 + s1) / 2, v: v0, w: s1 - s0, h: v1 - v0 },
    })
  }
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
  const naSparingen = []

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
  } else if (p.massa?.type === 'stapel') {
    // gestapelde platte dozen: per rand een duidelijke inzet (>= .35) of
    // uitkraging (>= .5); coplanaire gevels boven elkaar bestaan hier
    // niet, die rand is niet te detailleren. Vrije uitkraaghoeken staan
    // op kolommen; een begaanbaar dak bestaat alleen met balustrade en
    // toegang, en een dakopbouw ontsluit het terras waarop hij staat.
    const m = p.massa
    const klem = (x, lo, hi) => Math.max(lo, Math.min(hi, x))
    const b1 = p.volume.b, d1 = p.volume.d
    const h1 = klem(m.h1 ?? 3.1, 2.7, 4)
    const onder = maakVolume('onder', 'onder', { b: b1, d: d1, goot: h1, plat: true }, null)
    voeg(onder)
    const basis = h1 + onder.vol.dakDikte
    const h2 = klem(m.h2 ?? 2.9, 2.6, 3.6)
    // de bovendoos deelt altijd een kern met de onderdoos (trapzone)
    const schuif = (c, half1, half2) => {
      const T = Math.min(2.2, 2 * half1 - .1, 2 * half2)
      return Math.max(-(half1 + half2 - T), Math.min(half1 + half2 - T, c))
    }
    const fixAs = (c, half1, half2) => {
      let xL = c - half2, xR = c + half2
      const f = o => (o > -.35 && o < .5) ? (o < .1 ? -.35 : .5) : o
      xL = -half1 - f(-half1 - xL)
      xR = half1 + f(xR - half1)
      if (xR - xL < 2.6) xR = xL + 2.6
      return [(xL + xR) / 2, xR - xL]
    }
    const [cx, b2] = fixAs(schuif(m.dx ?? 0, b1 / 2, (m.b2 ?? b1 * .85) / 2), b1 / 2,
      klem(m.b2 ?? b1 * .85, 2.6, b1 + 3.2) / 2)
    const [cz, d2] = fixAs(schuif(m.dz ?? 0, d1 / 2, (m.d2 ?? d1 * .7) / 2), d1 / 2,
      klem(m.d2 ?? d1 * .7, 2.6, d1 + 3.2) / 2)
    const boven = maakVolume('boven', 'boven', {
      b: b2, d: d2, goot: basis + h2, plat: true, basis, pos: [cx, cz],
    }, null)
    voeg(boven)
    const rOnder = rectVan(onder.vol), rBoven = rectVan(boven.vol)
    // kolommen onder elke hoek die meer dan .9 buiten de onderdoos ligt
    const buitenRect = (x, z, r) => Math.max(r.x0 - x, x - r.x1, r.z0 - z, z - r.z1, 0)
    const posities = []
    for (const [hx, hz] of [[rBoven.x0, rBoven.z0], [rBoven.x0, rBoven.z1], [rBoven.x1, rBoven.z0], [rBoven.x1, rBoven.z1]]) {
      if (buitenRect(hx, hz, rOnder) > .9)
        posities.push([hx - Math.sign(hx - cx || 1) * .15, hz - Math.sign(hz - cz || 1) * .15])
    }
    if (posities.length) model.randafwerking.push({ type: 'stapelkolommen', volumeId: 'boven', posities, h: basis })
    // dakopbouw op de bovendoos, met zijn deur als terrastoegang
    if (m.opbouw) {
      const basis2 = basis + h2 + boven.vol.dakDikte
      const b3 = klem(m.opbouw.b ?? 2.5, 1.8, b2 - .9)
      const d3 = klem(m.opbouw.d ?? 2.2, 1.6, d2 - .9)
      const h3 = klem(m.opbouw.h ?? 2.6, 2.4, 3)
      const op = maakVolume('opbouw', 'opbouw', {
        b: b3, d: d3, goot: basis2 + h3, plat: true, basis: basis2, pos: [cx, cz],
      }, null)
      voeg(op)
      const dOp = wand('opbouw:kop+')
      dOp.sparingen.push({
        id: dOp.id + '-deur', type: 'deur',
        rect: { u: 0, v: basis2 + .1, w: .9, h: Math.min(2.2, h3 - .3) },
      })
    }
    const maakTerras = vol2 => {
      vol2.terras = true
      const segs = terrasSegmenten(model, vol2)
      for (const rand2 of ['kop+', 'kop-', 'langs+', 'langs-']) {
        if (segs[rand2].length) model.randafwerking.push({
          type: 'balustrade', volumeId: vol2.id, rand: rand2, bereiken: segs[rand2], h: 1.05,
        })
      }
    }
    // onderdak begaanbaar: alleen bij een begaanbare inzet van minstens
    // 1,2 m, met een deur op terrasniveau; een kleinere inzet is een
    // plat dak zonder balustrade en zonder deur
    if (m.terras !== false) {
      const kandidaten = [
        ['boven:langs-', rBoven.x0 - rOnder.x0], ['boven:langs+', rOnder.x1 - rBoven.x1],
        ['boven:kop-', rBoven.z0 - rOnder.z0], ['boven:kop+', rOnder.z1 - rBoven.z1],
      ].filter(k => k[1] >= 1.2).sort((a, b) => b[1] - a[1])
      if (kandidaten.length) {
        const dw = wand(kandidaten[0][0])
        dw.sparingen.push({
          id: dw.id + '-terrasdeur', type: 'deur',
          rect: { u: 0, v: basis + .1, w: .95, h: Math.min(2.3, h2 - .32) },
        })
        maakTerras(onder.vol)
        // pergola-lamellendak op het terras, tegen de bovendoosgevel,
        // met de kolommen op het terras zelf
        if (m.pergola) {
          const pk = m.pergola.kant === -1 ? -1 : 1
          const inzet = pk === 1 ? rOnder.x1 - rBoven.x1 : rBoven.x0 - rOnder.x0
          if (inzet >= 1.3) {
            const pDiepte = Math.max(1, Math.min(m.pergola.diepte ?? inzet - .3, inzet - .25))
            const pBreedte = Math.max(2, Math.min(m.pergola.breedte ?? d2 - .4, d2 - .3))
            const pz = Math.max(-d2 / 2 + pBreedte / 2 + .1, Math.min(d2 / 2 - pBreedte / 2 - .1, m.pergola.z ?? 0))
            model.randafwerking.push({
              type: 'pergola', volumeId: 'boven', kant: pk,
              z0: pz - pBreedte / 2, z1: pz + pBreedte / 2,
              diepte: pDiepte, h: basis + Math.min(2.6, h2 - .3), basis, hoh: .45,
            })
          }
        }
      }
    }
    if (m.opbouw) maakTerras(boven.vol)
    // glasbanden per laag, geknipt rond deuren en elementen; ze worden
    // pas gelegd als alle sparingen en gevel-elementen bekend zijn
    naSparingen.push(() => {
      for (const [vol2, v0, v1] of [
        [onder.vol, .95, h1 - .3],
        [boven.vol, basis + .95, basis + h2 - .3],
      ]) {
        for (const wnaam of ['kop+', 'kop-', 'langs+', 'langs-']) {
          voegGlasband(wand(vol2.id + ':' + wnaam), vol2, v0, v1)
        }
      }
    })
    hoofdWandId = w => 'onder:' + w
  } else {
    voeg(maakVolume('hoofd', 'hoofd', p.volume, p.rand, hoofdOpties))
  }

  if (p.massa?.type === 'dwarskap') {
    const hoofd = model.volumes[0]
    if (!hoofd.plat && hoofd.nok > hoofd.goot) {
      const m = p.massa
      const kant = m.kant === -1 ? -1 : 1
      // klemregels in het model: de dwarsnok blijft ruim onder de
      // hoofdnok en komt boven de hoofddaklijn op de gevel uit
      const b2 = Math.max(3, Math.min(m.b2 ?? hoofd.b * .55, hoofd.d * .55))
      let goot2 = Math.max(2.1, Math.min(m.goot2 ?? hoofd.goot, hoofd.goot + .8))
      const helling2 = Math.max(30, Math.min(m.helling2 ?? 46, 60))
      let nok2 = goot2 + Math.tan(helling2 * Math.PI / 180) * b2 / 2
      nok2 = Math.max(hoofd.goot + .6, Math.min(nok2, hoofd.nok - .45))
      if (nok2 - goot2 < .45) goot2 = nok2 - .5
      const uitsteek = Math.max(1.2, Math.min(m.uitsteek ?? 2, 4))
      const z0 = Math.max(-(hoofd.d / 2 - b2 / 2 - .5), Math.min(hoofd.d / 2 - b2 / 2 - .5, m.z ?? 0))
      // penetratie: het dwarsvolume loopt naar binnen tot waar het
      // hoofddak ruim boven de dwarsnok ligt
      const halveK = kant === 1 ? hoofd.b / 2 - hoofd.nokOffset : hoofd.nokOffset + hoofd.b / 2
      const tanK = (hoofd.nok - hoofd.goot) / halveK
      const dx = (nok2 + .4 - hoofd.goot) / tanK
      const xBinnen = kant * (hoofd.b / 2 - Math.min(dx, hoofd.b / 2 - .4))
      const xBuiten = kant * (hoofd.b / 2 + uitsteek)
      const d2 = Math.abs(xBuiten - xBinnen)
      const posX = (xBuiten + xBinnen) / 2
      const dwars = maakVolume('dwars', 'dwars', {
        b: b2, d: d2, goot: goot2, nok: nok2, pos: [posX, z0],
      }, p.rand)
      dwars.vol.ry = kant * Math.PI / 2
      // dakplaten: geen kopoverstek naar binnen; buiten volgens familie;
      // en gesneden op het bovenvlak van het hoofddak (kilkeperlijn)
      const hoofdVlak = model.dakvlakken.find(v => v.volumeId === 'hoofd' && v.kant === kant)
      const snijBoven = dakVlak3D(hoofdVlak, hoofd, true)
      dwars.vol.overstekKop = 0
      dwars.dakvlakken.forEach(dv => {
        dv.overstekKop = 0
        dv.verandaKop = dwars.vol.familie === 'kolossaal'
          ? (dwars.vol.overstekLangs * Math.cos(Math.atan2(nok2 - goot2, b2 / 2)) || .6) * .75 : 0
        dv.snijvlakken = [{ p: snijBoven.P, n: snijBoven.N }]
      })
      voeg(dwars)
      // nokvouw van de dwars: buiten met overlap, binnen tot in het
      // hoofddak, en gesneden op hetzelfde vlak
      const dVouw = model.randafwerking.find(r => r.volumeId === 'dwars' && r.type === 'nokvouw')
      dVouw.diepteVoor = d2 / 2 + (dwars.dakvlakken[0].verandaKop || 0) + STAELDETAILS.nok.kopOverlap
      dVouw.diepteAchter = d2 / 2 + .05
      dVouw.snijvlakken = [{ p: snijBoven.P, n: snijBoven.N }]
      // binnenzijde: geen boeikop en geen gootafwerking binnen het hoofd
      verwijderRand(model, 'dwars', r => (r.type === 'boeikop' || r.type === 'windveer') && r.richting === -1)
      for (const r of model.randafwerking.filter(x => x.volumeId === 'dwars'
        && ['boeideel', 'randprofiel', 'gordingen'].includes(x.type))) {
        // gootafwerking alleen op het stuk buiten de hoofdgevel
        r.bereik = [-(d2 / 2) + (Math.abs(kant * hoofd.b / 2 - xBinnen)), d2 / 2]
      }
      // maskers: dwars-kop- volledig binnen; dwars-langsgevels binnen de
      // hoofdgevel; hoofd-langsgevel achter de dwarsdoorsnede
      wand('dwars:kop-').maskers.push({ poly: kopContour(dwars.vol), reden: 'binnen hoofdvolume' })
      const binnenLen = Math.abs(kant * hoofd.b / 2 - xBinnen)
      for (const lk of [1, -1]) {
        const w2 = wand('dwars:langs' + (lk === 1 ? '+' : '-'))
        const u0 = wandLokaalU(w2, -d2 / 2), u1 = wandLokaalU(w2, -d2 / 2 + binnenLen)
        w2.maskers.push({
          poly: [[Math.min(u0, u1), 0], [Math.max(u0, u1), 0], [Math.max(u0, u1), goot2 + .05], [Math.min(u0, u1), goot2 + .05]],
          reden: 'binnen hoofdvolume',
        })
      }
      const hw = wand('hoofd:langs' + (kant === 1 ? '+' : '-'))
      const uc = wandLokaalU(hw, z0)
      hw.maskers.push({
        poly: [[uc - b2 / 2, 0], [uc + b2 / 2, 0], [uc + b2 / 2, goot2], [uc, nok2], [uc - b2 / 2, goot2]],
        reden: 'contact met dwarskap',
      })
      // het hoofdboeideel wijkt voor de dwarskap, maar alleen waar het
      // dwarsdak echt boven de gootband uitkomt: het loopt door tot het
      // het dwarsdakvlak raakt (ook als de dwarsgoot lager ligt dan de
      // hoofdgoot), anders blijft een stuk dakranddoorsnede kaal
      const tan2 = (nok2 - goot2) / (b2 / 2)
      const dikte2v = dwars.vol.dakDikte / Math.cos(Math.atan2(nok2 - goot2, b2 / 2))
      const dikVH = hoofd.dakDikte / Math.cos(Math.atan2(hoofd.nok - hoofd.goot,
        Math.max(.3, Math.min(hoofd.nokOffset + hoofd.b / 2, hoofd.b / 2 - hoofd.nokOffset))))
      const sSter = Math.max(.1, Math.min(b2 / 2 + .02, (nok2 + dikte2v - (hoofd.goot + dikVH + .1)) / tan2))
      for (const r of model.randafwerking.filter(x => x.volumeId === 'hoofd'
        && (x.type === 'boeideel' || x.type === 'randprofiel' || x.type === 'gordingen') && x.kant === kant)) {
        r.bereiken = [[-hoofd.d / 2, z0 - sSter], [z0 + sSter, hoofd.d / 2]]
      }
      // kilkeper: per dwars-dakvlak een doorlopend gevouwen profiel in
      // het dal, afgeleid uit de twee plaatbovenvlakken
      for (const dv of dwars.dakvlakken) {
        const dwarsBoven = dakVlak3D(dv, dwars.vol, true)
        const lijn = snijlijn(snijBoven, dwarsBoven)
        // het dal eindigt exact op de dakrand: de kruising van de
        // killijn met het gevelvlak (strak) of de overstekrand
        // (kolossaal), en nooit onder de dwarsgoot
        const xRand = kant * (hoofd.b / 2 + (hoofd.familie === 'kolossaal'
          ? (hoofd.overstekLangs || 0) * Math.cos(Math.atan2(hoofd.nok - hoofd.goot, halveK)) : 0))
        const yRand = Math.abs(lijn.richting[0]) > 1e-6
          ? lijn.punt[1] + lijn.richting[1] * ((xRand - lijn.punt[0]) / lijn.richting[0])
          : hoofd.goot
        const yLaag = Math.max(goot2 + .02, yRand + .01)
        const yHoog = nok2 + dwars.vol.dakDikte * 1.1
        model.randafwerking.push({
          type: 'kilkeper', volumeId: 'dwars', zijde: dv.kant,
          van: lijnOpY(lijn, yLaag), tot: lijnOpY(lijn, yHoog),
          vlakH: { P: snijBoven.P, N: snijBoven.N },
          vlakD: { P: dwarsBoven.P, N: dwarsBoven.N },
          flank: .28, dikte: .03,
        })
      }
    }
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
      // masker in wand-lokale coordinaten (langs+ is gespiegeld)
      const uA = wandLokaalU(wz, zA)
      wz.maskers.push({
        poly: [[uA - dA / 2, 0], [uA + dA / 2, 0], [uA + dA / 2, hA], [uA - dA / 2, hA]],
        reden: 'contact met aanbouw',
      })
    }
    verwijderRand(model, 'aanbouw', r => r.type === 'daklijst' && r.rand === (m.kant === 1 ? 'langs-' : 'langs+'))
  }

  // ---- pergola: open lamellendak tegen een langsgevel op maaiveld ----
  if (uitbouw?.type === 'pergola') {
    const doel = model.volumes.find(v => v.rol === 'onder')
      || model.volumes.find(v => v.rol === 'staart') || model.volumes[0]
    const kant = uitbouw.kant === -1 ? -1 : 1
    const diepte = Math.max(1.4, Math.min(uitbouw.diepte ?? 2.4, 3.6))
    const breedte = Math.max(2, Math.min(uitbouw.breedte ?? doel.d * .45, doel.d - .6))
    const zc = Math.max(-doel.d / 2 + breedte / 2 + .2, Math.min(doel.d / 2 - breedte / 2 - .2, uitbouw.z ?? 0))
    const h = Math.min(2.7, doel.goot - .15)
    const w2 = model.wanden.find(w3 => w3.id === doel.id + ':langs' + (kant === 1 ? '+' : '-'))
    const u0 = wandLokaalU(w2, zc - breedte / 2), u1 = wandLokaalU(w2, zc + breedte / 2)
    const overlapt = w2.maskers.some(mk => {
      const us = mk.poly.map(q => q[0])
      return Math.min(u0, u1) < Math.max(...us) && Math.max(u0, u1) > Math.min(...us)
    })
    // tegen een contactzone (aanbouw, dwarskap) bestaat de pergola niet
    if (h >= 2.2 && !overlapt) model.randafwerking.push({
      type: 'pergola', volumeId: doel.id, kant,
      z0: zc - breedte / 2, z1: zc + breedte / 2, diepte, h, hoh: .42,
    })
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
      gast.ritmeUs = []
      for (let i = 0; i < r.n; i++) {
        const u = -doelVol.d / 2 + doelVol.d * ((i + .5) / r.n)
        // niet in een contactzone (aanbouw) plaatsen
        const inMasker = gast.maskers.some(mk => {
          const us = mk.poly.map(q => q[0])
          return u > Math.min(...us) - .6 && u < Math.max(...us) + .6
        })
        if (inMasker) continue
        gast.ritmeUs.push(u)
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
      // het kader is een keten: hartlijn-polyline van maaiveld over de
      // daklijn naar maaiveld, met gedeelde knooppunten (element-afheid)
      const dik = e.dik ?? .28, uitst = .05
      const x0 = gv.b / 2 - dik / 2
      // knopen op de hoogte van de BUITENrand van de stijl, zodat geen
      // enkele hoek van de keten door de daklijn steekt
      const overhang = Math.max(dakY(-x0) - dakY(-gv.b / 2), dakY(x0) - dakY(gv.b / 2), 0)
      const knopen = [[-x0, 0], [-x0, dakY(-gv.b / 2) - .12]]
      if (gv.nok > gv.goot) knopen.push([gv.nokOffset, dakY(gv.nokOffset) - .12 - overhang])
      knopen.push([x0, dakY(gv.b / 2) - .12], [x0, 0])
      const keten = gast.id + '-kader'
      for (let i = 0; i < knopen.length - 1; i++) {
        const [u1, v1] = knopen[i], [u2, v2] = knopen[i + 1]
        const verticaal = Math.abs(u2 - u1) < .01
        gast.elementen.push(verticaal
          ? {
            type: 'blok', rol: 'kader', keten, knoopIndex: i,
            van: [u1, Math.min(v1, v2) === 0 && i === 0 ? 0 : v1], tot: [u2, v2],
            u: u1, v0: Math.min(v1, v2), v1: Math.max(v1, v2), b: dik, diep: .22, uit: uitst, kleur,
          }
          : {
            type: 'strook', rol: 'kader', keten, knoopIndex: i,
            van: [u1, v1], tot: [u2, v2], b: .24, diep: .22, uit: uitst, kleur,
          })
      }
    }
    if (e.type === 'penanten') {
      const n = e.n ?? 3
      const span = Math.min(e.span ?? gv.b * .5, gv.b - .8)
      for (let i = 1; i <= n; i++) {
        const u = (e.u ?? 0) - span / 2 + (span / (n + 1)) * i
        const v1 = Math.min(e.hMax ?? 1e9, dakY(u) - .15)
        if (v1 > .4) gast.elementen.push({ type: 'blok', rol: 'penant', u, v0: .05, v1, b: e.b ?? .4, diep: .24, uit: .04, kleur })
      }
    }
    if (e.type === 'lamellenveld') {
      // elke lat loopt individueel door tot de veldgrens: de dakcontour,
      // het kader of de puirand (element-afheid, geen zwevende einden)
      const grens = e.grens || (kop && !gv.plat ? 'dakcontour' : 'pui')
      const kaderDik = .28
      for (let v = e.v0; v <= e.v1; v += e.stap ?? .3) {
        let u0, u1
        if (grens === 'dakcontour' && kop && !gv.plat) {
          const ber = kopBereik(v, gv, .12)
          if (!ber) continue
          u0 = ber[0]; u1 = ber[1]
        } else if (grens === 'kader') {
          const rand = gv.b / 2 - kaderDik + .02
          const ber = !gv.plat ? kopBereik(v, gv, kaderDik - .02) : [-rand, rand]
          if (!ber) continue
          u0 = Math.max(-rand, ber[0]); u1 = Math.min(rand, ber[1])
        } else {
          // puirand tot puirand
          const pui = gast.sparingen.find(sp => sp.poly)
          if (!pui || v > gv.goot + 2.5) continue
          const us = pui.poly.map(q => q[0])
          u0 = Math.min(...us); u1 = Math.max(...us)
        }
        if (u1 - u0 > .25) gast.elementen.push({
          type: 'strook', rol: 'lamel', grens, van: [u0, v], tot: [u1, v],
          b: .07, diep: .16, uit: e.uit ?? .12, kleur,
        })
      }
    }
    if (e.type === 'paneel') {
      // een paneel heeft een functie: een dichtgezet vak in het
      // raamstramien, of een poort op maaiveld; kale platen bestaan niet
      const functie = e.functie || 'ritmevak'
      if (functie === 'ritmevak') {
        const ritme = gast.ritmeUs || []
        if (ritme.length) {
          const u = ritme.reduce((a, b2) => Math.abs(b2 - e.u) < Math.abs(a - e.u) ? b2 : a)
          const raam = gast.sparingen.find(sp => sp.rect && Math.abs(sp.rect.u - u) < .05)
          if (raam) {
            gast.sparingen = gast.sparingen.filter(sp => sp !== raam)
            gast.elementen.push({
              type: 'blok', rol: 'paneel', functie, u,
              v0: raam.rect.v, v1: raam.rect.v + raam.rect.h,
              b: raam.rect.w, diep: .06, uit: .03, kleur,
            })
          }
        }
      } else {
        const grens = (kop ? gv.b : gv.d) / 2 - .8
        const u = Math.max(-grens, Math.min(grens, e.u))
        const h = Math.max(2.2, Math.min(e.h ?? 2.3, (kop ? dakY(u) : gv.goot) - .3))
        gast.elementen.push({
          type: 'blok', rol: 'paneel', functie: 'poort', u, v0: 0, v1: h,
          b: Math.max(.9, e.b ?? 1), diep: .06, uit: .03, kleur,
        })
      }
    }
    if (e.type === 'balkon') {
      // een balkon is alleen bereikbaar met een deur in de pui erachter:
      // het model zet het deurvak, of laat het balkon vervallen
      const vloer = e.vloer ?? 2.85
      const u = e.u ?? 0
      const breedte = Math.min(e.breedte ?? 3, gv.b - 1)
      const pui = gast.sparingen.find(sp => sp.poly)
      if (pui) {
        const us = pui.poly.map(q => q[0])
        const deurU = Math.max(Math.min(...us) + .55, Math.min(Math.max(...us) - .55, u))
        // puihoogte op de deurpositie zelf (de pui volgt de dakcontour)
        let top = Math.max(...pui.poly.map(q => q[1]))
        for (let i = 2; i < pui.poly.length - 1; i++) {
          const [u1, v1] = pui.poly[i], [u2, v2] = pui.poly[i + 1]
          if (deurU >= Math.min(u1, u2) && deurU <= Math.max(u1, u2) && Math.abs(u2 - u1) > .001)
            top = v1 + (v2 - v1) * ((deurU - u1) / (u2 - u1))
        }
        if (top > vloer + 2.45) {
          pui.deur = { u: deurU, b: .95, dorpel: vloer, h: 2.3 }
          gast.elementen.push({ type: 'balkon', rol: 'balkon', u, breedte, vloer, diepte: e.diepte ?? 1.5 })
        }
      }
    }
  }

  // uitgestelde stappen (glasbanden) nu alle sparingen en elementen er zijn
  for (const f of naSparingen) f()

  // ---- plint: bekleding, automatisch uitgespaard rond sparingen ----
  if (p.plint) {
    for (const w2 of model.wanden) {
      const gv = volVan(w2)
      if (gv.basis) continue // plint hoort bij maaiveld
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

  // materialen (fase 2): per gevelvlak/volume, dak, daklijnen en accent;
  // een kale kleurenset uit oudere parameters wordt een tint op de
  // standaardmaterialen, zodat elk model materialen heeft
  const matIn = p.materialen || {}
  model.materialen = {
    gevels: {
      standaard: matIn.gevel
        || (p.kleuren?.gevel ? { mat: 'houtVerticaal', hex: p.kleuren.gevel } : { mat: 'houtVerticaal', kleur: 'warmbruin' }),
      ...(matIn.gevels || {}),
    },
    dak: matIn.dak
      || (p.kleuren?.dak ? { mat: 'felsDak', hex: p.kleuren.dak } : { mat: 'felsDak', kleur: 'antraciet' }),
    daklijnen: matIn.daklijnen || null,
    accent: matIn.accent || { mat: 'houtAccent', kleur: 'blank' },
  }
  return model
}
