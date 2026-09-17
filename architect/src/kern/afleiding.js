// Geometrie-afleiding: EEN pure functie zet het gebouwmodel om in
// primitieven (boxen en extrusies in wereldcoordinaten). De renderer
// tekent uitsluitend deze lijst en de gesloten-schil-validatie sampelt
// tegen exact dezelfde lijst: zelfde functies, zelfde uitkomst.
//
// Transformconventie (renderer en sampler identiek):
//   wereld = translatie(pos) . rotatieY(ry) . rotatieZ(rz) . lokaal

import { WAND_DIKTE, dakOnderY, vlakRichting } from './model.js'
import { STAELDETAILS } from './staeldetails.js'

// wandtransform: lokaal z = WAND_DIKTE is bij elke gevel het buitenvlak
export function wandTransform(wand, vol) {
  const [px, pz] = vol.pos || [0, 0]
  if (wand.type === 'kop') {
    return {
      pos: [px, 0, pz + wand.richting * (vol.d / 2 - WAND_DIKTE)],
      ry: wand.richting === 1 ? 0 : Math.PI,
    }
  }
  return {
    pos: [px + wand.kant * (vol.b / 2 - WAND_DIKTE), 0, pz],
    ry: wand.kant * Math.PI / 2,
  }
}

function naarWereld(t, p) {
  const [x, y, z] = p
  const c = Math.cos(t.ry), s = Math.sin(t.ry)
  return [t.pos[0] + c * x + s * z, t.pos[1] + y, t.pos[2] - s * x + c * z]
}

const sparingPoly = sp => sp.poly || [
  [sp.rect.u - sp.rect.w / 2, sp.rect.v], [sp.rect.u + sp.rect.w / 2, sp.rect.v],
  [sp.rect.u + sp.rect.w / 2, sp.rect.v + sp.rect.h], [sp.rect.u - sp.rect.w / 2, sp.rect.v + sp.rect.h]]

export function leidGeometrieAf(model, opties = {}) {
  const K = model.kleuren
  const prims = []
  const volVan = id => model.volumes.find(v => v.id === id)

  // ---- wanden, vullingen, gevel-elementen ----
  for (const wand of model.wanden) {
    const vol = volVan(wand.volumeId)
    const t = wandTransform(wand, vol)
    prims.push({
      vorm: 'extrude', rol: 'wand', kleur: K.gevel,
      contour: wand.contour, holes: wand.sparingen.map(sparingPoly),
      dikte: WAND_DIKTE, pos: t.pos, ry: t.ry,
    })
    for (const sp of wand.sparingen) {
      const pts = sparingPoly(sp)
      prims.push({
        vorm: 'extrude', rol: 'glas', kleur: K.glas,
        contour: pts, holes: [], dikte: .02,
        pos: naarWereld(t, [0, 0, WAND_DIKTE / 2 - .07]), ry: t.ry,
      })
      for (let i = 0; i < pts.length; i++) {
        const [u1, v1] = pts[i], [u2, v2] = pts[(i + 1) % pts.length]
        prims.push({
          vorm: 'box', rol: 'kozijn', kleur: K.kozijn,
          pos: naarWereld(t, [(u1 + u2) / 2, (v1 + v2) / 2, WAND_DIKTE / 2]),
          ry: t.ry, rz: spiegelRz(t.ry, Math.atan2(v2 - v1, u2 - u1)),
          size: [Math.hypot(u2 - u1, v2 - v1), .09, .18],
        })
      }
      if (sp.type === 'pui') {
        const us = pts.map(p => p[0])
        const u0 = Math.min(...us), u1 = Math.max(...us)
        const stap = sp.stramien === 'grid' ? 1.05 : sp.stramien === 'vlak' ? 1.9 : .85
        const n = Math.max(2, Math.round((u1 - u0) / stap))
        for (let i = 1; i < n; i++) {
          const u = u0 + ((u1 - u0) / n) * i
          const vTop = randVanPoly(pts, u)
          prims.push({
            vorm: 'box', rol: 'kozijn', kleur: K.kozijn,
            pos: naarWereld(t, [u, (vTop + pts[0][1]) / 2, WAND_DIKTE / 2]),
            ry: t.ry, rz: 0, size: [.07, vTop - pts[0][1] - .06, .14],
          })
        }
      }
    }
    for (const el of wand.elementen || []) {
      if (el.type === 'blok') {
        prims.push({
          vorm: 'box', rol: el.bekleding ? 'bekleding' : 'element', kleur: el.kleur || '#8a7a5e',
          pos: naarWereld(t, [el.u, (el.v0 + el.v1) / 2, WAND_DIKTE + (el.uit ?? 0) + el.diep / 2]),
          ry: t.ry, rz: 0, size: [el.b, el.v1 - el.v0, el.diep],
        })
      } else if (el.type === 'strook') {
        const [u1, v1] = el.van, [u2, v2] = el.tot
        prims.push({
          vorm: 'box', rol: 'element', kleur: el.kleur || '#8a7a5e',
          pos: naarWereld(t, [(u1 + u2) / 2, (v1 + v2) / 2, WAND_DIKTE + (el.uit ?? 0) + el.diep / 2]),
          ry: t.ry, rz: spiegelRz(t.ry, Math.atan2(v2 - v1, u2 - u1)),
          size: [Math.hypot(u2 - u1, v2 - v1) + .02, el.b, el.diep],
        })
      } else if (el.type === 'balkon') {
        const z0 = WAND_DIKTE + .02
        prims.push({ vorm: 'box', rol: 'balkon', kleur: K.kozijn, pos: naarWereld(t, [el.u, el.vloer, z0 + el.diepte / 2]), ry: t.ry, rz: 0, size: [el.breedte, .12, el.diepte] })
        prims.push({ vorm: 'box', rol: 'balkon', kleur: K.kozijn, pos: naarWereld(t, [el.u, el.vloer + .62, z0 + el.diepte - .03]), ry: t.ry, rz: 0, size: [el.breedte, .05, .05] })
        const n = Math.max(8, Math.round(el.breedte / .15))
        for (let i = 0; i <= n; i++) {
          prims.push({
            vorm: 'box', rol: 'balkon', kleur: K.kozijn,
            pos: naarWereld(t, [el.u - el.breedte / 2 + (el.breedte / n) * i, el.vloer + .32, z0 + el.diepte - .03]),
            ry: t.ry, rz: 0, size: [.03, .6, .03],
          })
        }
        for (const k of [-1, 1]) {
          prims.push({
            vorm: 'box', rol: 'balkon', kleur: K.kozijn,
            pos: naarWereld(t, [el.u + k * (el.breedte / 2 - .015), el.vloer + .62, z0 + el.diepte / 2]),
            ry: t.ry + Math.PI / 2, rz: 0, size: [el.diepte, .05, .05],
          })
        }
      }
    }
  }

  // ---- dakvlakken ----
  for (const vlak of model.dakvlakken) {
    const vol = volVan(vlak.volumeId)
    const [px, pz] = vol.pos || [0, 0]
    if (vlak.plat) {
      prims.push({
        vorm: 'box', rol: 'dak', kleur: K.dak,
        pos: [px, vol.goot + vlak.dikte / 2, pz], ry: 0, rz: 0,
        size: [vol.b + .02, vlak.dikte, vol.d + .02],
      })
      continue
    }
    const { u, n, n0, nok } = vlakRichting(vlak)
    const extra = vlak.zijLuifel ? vlak.zijLuifel.uit : 0
    const len = n0 - vlak.inzetLangs + vlak.overstekLangs + extra
    const veranda = vlak.verandaKop || 0
    const diepte = vol.d + 2 * vlak.overstekKop + veranda
    prims.push({
      vorm: 'box', rol: 'dak', kleur: K.dak,
      pos: [px + nok[0] + u[0] * (len / 2) + n[0] * (vlak.dikte / 2),
        nok[1] + u[1] * (len / 2) + n[1] * (vlak.dikte / 2),
        pz + veranda / 2],
      ry: 0, rz: Math.atan2(u[1], u[0]), size: [len, vlak.dikte, diepte],
    })
    if (vlak.zijLuifel) {
      // schijfwand onder het einde van het doorgetrokken dakvlak
      const eind = n0 + vlak.overstekLangs + extra
      const ex = nok[0] + u[0] * eind, ey = Math.max(1.1, nok[1] + u[1] * eind)
      prims.push({
        vorm: 'box', rol: 'schijfwand', kleur: vlak.zijLuifel.wandKleur || '#31302c',
        pos: [px + ex, ey / 2, pz + vol.d / 2 - .9], ry: 0, rz: 0,
        size: [.3, ey, 1.5],
      })
    }
  }

  // ---- randafwerking ----
  for (const rand of model.randafwerking) {
    const vol = volVan(rand.volumeId)
    const [px, pz] = vol.pos || [0, 0]
    const dikV = vol.plat ? vol.dakDikte
      : vol.dakDikte / Math.cos(Math.atan2(vol.nok - vol.goot, vol.b / 2 - Math.abs(vol.nokOffset)) || 0)

    if (rand.type === 'daklijst') {
      // plat volume: dun opstaand randje rondom, een vlak met de gevel
      const h = vol.dakDikte + .1
      const y = vol.goot + h / 2 - .02
      if (rand.rand.startsWith('kop')) {
        const ri = rand.rand === 'kop+' ? 1 : -1
        prims.push({ vorm: 'box', rol: 'daklijst', kleur: K.gevel, pos: [px, y, pz + ri * (vol.d / 2 + .005)], ry: 0, rz: 0, size: [vol.b + .06, h, .04] })
      } else {
        const ka = rand.rand === 'langs+' ? 1 : -1
        prims.push({ vorm: 'box', rol: 'daklijst', kleur: K.gevel, pos: [px + ka * (vol.b / 2 + .005), y, pz], ry: 0, rz: 0, size: [.04, h, vol.d + .06] })
      }
    }
    if (rand.type === 'nokvouw') {
      const totaal = rand.diepteVoor + rand.diepteAchter
      prims.push({
        vorm: 'extrude', rol: 'nokvouw', kleur: K.dak,
        contour: rand.profiel.map(([x, y]) => [x + px, y]), holes: [], dikte: totaal,
        pos: [0, 0, pz - rand.diepteAchter], ry: 0,
      })
    }
    if (rand.type === 'boeideel') {
      const h = dikV + .12
      prims.push({
        vorm: 'box', rol: 'boeideel', kleur: K.gevel,
        pos: [px + rand.kant * (vol.b / 2 + .005), vol.goot + h / 2 - .01, pz],
        ry: 0, rz: 0, size: [.04, h, vol.d],
      })
    }
    if (rand.type === 'boeikop' || rand.type === 'windveer') {
      const veranda = vol.verandaKop && rand.richting === 1 ? vol.verandaKop.diepte : 0
      const zPos = pz + rand.richting * (vol.d / 2 + vol.overstekKop + veranda + (rand.type === 'boeikop' ? .005 : -.025))
      const dik = rand.type === 'boeikop' ? .04 : .05
      for (const vlak of model.dakvlakken.filter(v => v.volumeId === vol.id)) {
        const { u, n, n0, nok } = vlakRichting(vlak)
        const hv = (vlak.dikte + .12) / Math.max(.25, Math.abs(n[1]))
        if (opties.oudeBoei) {
          const trim = STAELDETAILS.nok.vouwBreedte
          const len = n0 - vlak.inzetLangs + (rand.type === 'windveer' ? vlak.overstekLangs : 0) - trim + .04
          prims.push({
            vorm: 'box', rol: rand.type, kleur: rand.type === 'boeikop' ? K.gevel : K.kozijn,
            pos: [px + nok[0] + u[0] * (trim + len / 2 - .04) + n[0] * (vlak.dikte / 2),
              nok[1] + u[1] * (trim + len / 2 - .04) + n[1] * (vlak.dikte / 2), zPos],
            ry: 0, rz: Math.atan2(u[1], u[0]), size: [len, vlak.dikte + .12, dik],
          })
        } else {
          // verstek op de verticale lijn door de nok (staeldetails.js)
          const eindLangs = n0 + (rand.type === 'windveer' ? vlak.overstekLangs : 0)
          const eind = [nok[0] + u[0] * eindLangs, nok[1] + u[1] * eindLangs]
          const onder = -.03
          prims.push({
            vorm: 'extrude', rol: rand.type, kleur: rand.type === 'boeikop' ? K.gevel : K.kozijn,
            contour: [
              [px + vol.nokOffset, vol.nok + onder], [px + eind[0], eind[1] + onder],
              [px + eind[0], eind[1] + onder + hv], [px + vol.nokOffset, vol.nok + onder + hv],
            ],
            holes: [], dikte: dik, pos: [0, 0, zPos - dik / 2], ry: 0,
          })
        }
      }
    }
    if (rand.type === 'randprofiel') {
      const vlak = model.dakvlakken.find(v => v.volumeId === vol.id && v.kant === rand.kant)
      const { u, n0, nok } = vlakRichting(vlak)
      const eind = n0 - vlak.inzetLangs + vlak.overstekLangs
      prims.push({
        vorm: 'box', rol: 'randprofiel', kleur: K.kozijn,
        pos: [px + nok[0] + u[0] * eind, nok[1] + u[1] * eind + vlak.dikte / 2 + .01, pz],
        ry: 0, rz: 0, size: [.04, .12, vol.d + 2 * vlak.overstekKop],
      })
    }
    if (rand.type === 'gordingen') {
      const vlak = model.dakvlakken.find(v => v.volumeId === vol.id && v.kant === rand.kant)
      const { u, n, n0, nok } = vlakRichting(vlak)
      const nG = Math.max(2, Math.round(vol.d / STAELDETAILS.kolossaal.gordingHoh))
      const len = vlak.overstekLangs + 1.1
      const sC = n0 - vlak.inzetLangs + vlak.overstekLangs - len / 2
      for (let i = 0; i <= nG; i++) {
        prims.push({
          vorm: 'box', rol: 'gording', kleur: '#26262a',
          pos: [px + nok[0] + u[0] * sC + n[0] * -.08, nok[1] + u[1] * sC + n[1] * -.08, pz - vol.d / 2 + (vol.d / nG) * i],
          ry: 0, rz: Math.atan2(u[1], u[0]), size: [len, .12, .06],
        })
      }
    }
    if (rand.type === 'verandakolommen') {
      const diepte = rand.diepte
      if (rand.portaal) {
        // portaal: stijlen tot de grond plus daklijnstroken in verstek
        for (const kant of [-1, 1]) {
          const x = kant * (vol.b / 2 - .2)
          const h = dakOnderY(x, vol)
          prims.push({ vorm: 'box', rol: 'portaal', kleur: '#d8d4c9', pos: [px + x, h / 2, pz + vol.d / 2 + diepte - .3], ry: 0, rz: 0, size: [.42, h, .5] })
        }
        for (const vlak of model.dakvlakken.filter(v => v.volumeId === vol.id && !v.plat)) {
          const { u, n, n0, nok } = vlakRichting(vlak)
          const eind = [nok[0] + u[0] * n0, nok[1] + u[1] * n0]
          // de kaderhoogte volgt de dakpakketdikte van dit vlak
          const hv = (vlak.dikte + .12) / Math.max(.25, Math.abs(n[1])) + .06
          prims.push({
            vorm: 'extrude', rol: 'portaal', kleur: '#d8d4c9',
            contour: [
              [px + vol.nokOffset, vol.nok - .03], [px + eind[0], eind[1] - .03],
              [px + eind[0], eind[1] - .03 + hv], [px + vol.nokOffset, vol.nok - .03 + hv],
            ],
            holes: [], dikte: .5, pos: [0, 0, pz + vol.d / 2 + diepte - .55], ry: 0,
          })
        }
      } else {
        const nK = Math.max(1, rand.kolommen ?? 2)
        for (const kant of [-1, 1]) {
          for (let i = 0; i < nK; i++) {
            const z = nK === 1 ? vol.d / 2 + diepte - .45
              : vol.d / 2 + .35 + (diepte - .8) * (i / (nK - 1))
            prims.push({
              vorm: 'box', rol: 'kolom', kleur: '#26262a',
              pos: [px + kant * (vol.b / 2 - .25), vol.goot / 2, pz + z],
              ry: 0, rz: 0, size: [.12, vol.goot, .12],
            })
          }
        }
        prims.push({ vorm: 'box', rol: 'terras', kleur: '#6e685d', pos: [px, .02, pz + vol.d / 2 + diepte / 2 - .2], ry: 0, rz: 0, size: [vol.b - .4, .05, diepte + .5] })
      }
    }
  }
  return prims
}

function spiegelRz(ry, rz) {
  return Math.abs(Math.abs(ry) - Math.PI) < .01 ? -rz : rz
}

export function randVanPoly(pts, u) {
  let beste = Math.max(...pts.map(p => p[1]))
  for (let i = 2; i < pts.length - 1; i++) {
    const [u1, v1] = pts[i], [u2, v2] = pts[i + 1]
    if (u >= Math.min(u1, u2) && u <= Math.max(u1, u2) && Math.abs(u2 - u1) > .001)
      beste = v1 + (v2 - v1) * ((u - u1) / (u2 - u1))
  }
  return beste
}

// ---- punt-in-primitief met bol-voorfilter ----
export function primBol(prim) {
  if (prim.bol) return prim.bol
  if (prim.vorm === 'box') {
    prim.bol = { c: prim.pos, r: Math.hypot(...prim.size) / 2 + .05 }
  } else {
    const us = prim.contour.map(p => p[0]), vs = prim.contour.map(p => p[1])
    const cu = (Math.min(...us) + Math.max(...us)) / 2
    const cv = (Math.min(...vs) + Math.max(...vs)) / 2
    const ru = (Math.max(...us) - Math.min(...us)) / 2
    const rv = (Math.max(...vs) - Math.min(...vs)) / 2
    const c = Math.cos(prim.ry || 0), s = Math.sin(prim.ry || 0)
    prim.bol = {
      c: [prim.pos[0] + c * cu + s * prim.dikte / 2, prim.pos[1] + cv,
        prim.pos[2] - s * cu + c * prim.dikte / 2],
      r: Math.hypot(ru, rv, prim.dikte / 2) + .05,
    }
  }
  return prim.bol
}

export function dektPunt(prim, P, tol = .03) {
  const bol = primBol(prim)
  const dx = P[0] - bol.c[0], dy = P[1] - bol.c[1], dz2 = P[2] - bol.c[2]
  if (dx * dx + dy * dy + dz2 * dz2 > bol.r * bol.r) return false
  let [x, y, z] = [P[0] - prim.pos[0], P[1] - prim.pos[1], P[2] - prim.pos[2]]
  if (prim.ry) {
    const c = Math.cos(-prim.ry), s = Math.sin(-prim.ry)
    ;[x, z] = [c * x + s * z, -s * x + c * z]
  }
  if (prim.rz) {
    const c = Math.cos(-prim.rz), s = Math.sin(-prim.rz)
    ;[x, y] = [c * x - s * y, s * x + c * y]
  }
  if (prim.vorm === 'box') {
    return Math.abs(x) <= prim.size[0] / 2 + tol
      && Math.abs(y) <= prim.size[1] / 2 + tol
      && Math.abs(z) <= prim.size[2] / 2 + tol
  }
  if (z < -tol || z > prim.dikte + tol) return false
  if (!inPolyMetGroei([x, y], prim.contour, tol)) return false
  for (const gat of prim.holes) {
    if (inPolyMetGroei([x, y], gat, -tol)) return false
  }
  return true
}

export function inPolyMetGroei([x, y], poly, groei = 0) {
  let binnen = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) binnen = !binnen
  }
  if (binnen) return true
  if (groei <= 0) return false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    if (afstandTotSegment([x, y], poly[j], poly[i]) <= groei) return true
  }
  return false
}

function afstandTotSegment(p, a, b) {
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const l2 = dx * dx + dy * dy
  const t = l2 ? Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2)) : 0
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy)
}
