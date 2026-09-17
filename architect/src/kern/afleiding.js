// Geometrie-afleiding: EEN pure functie zet het gebouwmodel om in
// primitieven (boxen en extrusies in wereldcoordinaten). De renderer
// tekent uitsluitend deze lijst en de gesloten-schil-validatie sampelt
// tegen exact dezelfde lijst: zelfde functies, zelfde uitkomst.
//
// Primitief: { vorm:'box', pos:[x,y,z], ry, rz, size:[sx,sy,sz], kleur, rol }
//            { vorm:'extrude', contour:[[u,v]..], holes:[[[u,v]..]..],
//              dikte, pos:[x,y,z], ry, kleur, rol }
// Transformconventie (renderer en sampler identiek):
//   wereld = translatie(pos) . rotatieY(ry) . rotatieZ(rz) . lokaal

import { WAND_DIKTE, dakOnderY } from './model.js'
import { STAELDETAILS } from './staeldetails.js'

const vlakRicht = vlak => {
  const [gu, gv] = vlak.goot2D, [nu, nv] = vlak.nok2D
  const n0 = Math.hypot(gu - nu, gv - nv)
  const u = [(gu - nu) / n0, (gv - nv) / n0]
  let n = [-u[1], u[0]]
  if (n[1] < 0) n = [-n[0], -n[1]]
  return { u, n, n0, nok: [nu, nv], hoek: Math.atan2(u[1], u[0]) }
}

// wandtransform: lokaal z = WAND_DIKTE is bij elke gevel het buitenvlak
export function wandTransform(wand, vol) {
  if (wand.type === 'kop') {
    return { pos: [0, 0, wand.richting * (vol.d / 2 - WAND_DIKTE)], ry: wand.richting === 1 ? 0 : Math.PI }
  }
  return { pos: [wand.kant * (vol.b / 2 - WAND_DIKTE), 0, 0], ry: wand.kant * Math.PI / 2 }
}

// zet een lokaal punt (in wandcoordinaten) om naar wereld
function naarWereld(t, p) {
  const [x, y, z] = p
  const c = Math.cos(t.ry), s = Math.sin(t.ry)
  return [t.pos[0] + c * x + s * z, t.pos[1] + y, t.pos[2] - s * x + c * z]
}

export function leidGeometrieAf(model, opties = {}) {
  const vol = model.volumes[0]
  const K = model.kleuren
  const prims = []
  const dikV = vol.dakDikte / Math.cos(Math.atan2(vol.nok - vol.goot, vol.b / 2 - Math.abs(vol.nokOffset)) || 0)

  // ---- wanden met sparingen als echte gaten ----
  for (const wand of model.wanden) {
    const t = wandTransform(wand, vol)
    prims.push({
      vorm: 'extrude', rol: 'wand', kleur: K.gevel,
      contour: wand.contour,
      holes: wand.sparingen.map(sp => sp.poly || [
        [sp.rect.u - sp.rect.w / 2, sp.rect.v], [sp.rect.u + sp.rect.w / 2, sp.rect.v],
        [sp.rect.u + sp.rect.w / 2, sp.rect.v + sp.rect.h], [sp.rect.u - sp.rect.w / 2, sp.rect.v + sp.rect.h]]),
      dikte: WAND_DIKTE, pos: t.pos, ry: t.ry,
    })

    // vullingen: glas (dicht vlak) plus kozijnprofielen midden in de sparing
    for (const sp of wand.sparingen) {
      const pts = sp.poly || [
        [sp.rect.u - sp.rect.w / 2, sp.rect.v], [sp.rect.u + sp.rect.w / 2, sp.rect.v],
        [sp.rect.u + sp.rect.w / 2, sp.rect.v + sp.rect.h], [sp.rect.u - sp.rect.w / 2, sp.rect.v + sp.rect.h]]
      prims.push({
        vorm: 'extrude', rol: 'glas', kleur: K.glas,
        contour: pts, holes: [], dikte: .02,
        pos: naarWereld(t, [0, 0, WAND_DIKTE / 2 - .07]), ry: t.ry,
      })
      for (let i = 0; i < pts.length; i++) {
        const [u1, v1] = pts[i], [u2, v2] = pts[(i + 1) % pts.length]
        const len = Math.hypot(u2 - u1, v2 - v1)
        prims.push({
          vorm: 'box', rol: 'kozijn', kleur: K.kozijn,
          pos: naarWereld(t, [(u1 + u2) / 2, (v1 + v2) / 2, WAND_DIKTE / 2]),
          ry: t.ry, rz: sinHoek(t.ry, Math.atan2(v2 - v1, u2 - u1)),
          size: [len, .09, .18],
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

    // gevel-elementen (uit het model, al geclipt)
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
          ry: t.ry, rz: sinHoek(t.ry, Math.atan2(v2 - v1, u2 - u1)),
          size: [Math.hypot(u2 - u1, v2 - v1) + .02, el.b, el.diep],
        })
      } else if (el.type === 'balkon') {
        const z0 = WAND_DIKTE + .02
        const dl = [[0, 0, el.diepte / 2, el.breedte, .12, el.diepte],
          [0, .62, el.diepte - .03, el.breedte, .05, .05]]
        for (const [u, v, z, sx, sy, sz] of dl) {
          prims.push({ vorm: 'box', rol: 'balkon', kleur: K.kozijn, pos: naarWereld(t, [el.u + u, el.vloer + v, z0 + z]), ry: t.ry, rz: 0, size: [sx, sy, sz] })
        }
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
    const { u, n, n0, nok, hoek } = vlakRicht(vlak)
    const len = n0 - vlak.inzetLangs + vlak.overstekLangs
    prims.push({
      vorm: 'box', rol: 'dak', kleur: K.dak,
      pos: [nok[0] + u[0] * (len / 2) + n[0] * (vlak.dikte / 2), nok[1] + u[1] * (len / 2) + n[1] * (vlak.dikte / 2), 0],
      ry: 0, rz: hoek, size: [len, vlak.dikte, vol.d + 2 * vlak.overstekKop],
    })
  }

  // ---- randafwerking ----
  for (const rand of model.randafwerking) {
    if (rand.type === 'nokvouw') {
      prims.push({
        vorm: 'extrude', rol: 'nokvouw', kleur: K.dak,
        contour: rand.profiel, holes: [], dikte: rand.diepte,
        pos: [0, 0, -rand.diepte / 2], ry: 0,
      })
    }
    if (rand.type === 'boeideel') {
      const h = dikV + .12
      prims.push({
        vorm: 'box', rol: 'boeideel', kleur: K.gevel,
        pos: [rand.kant * (vol.b / 2 + .005), vol.goot + h / 2 - .01, 0],
        ry: 0, rz: 0, size: [.04, h, vol.d],
      })
    }
    if (rand.type === 'boeikop' || rand.type === 'windveer') {
      // detail vastgelegd in staeldetails.js: boeidelen komen in VERSTEK
      // samen op de verticale lijn door de nok, de nokvouw overlapt de
      // naad. De oude (foute) uitvoering met ingekorte einden blijft
      // beschikbaar als bewijs- en regressiepad voor de schilcheck.
      const zPos = rand.type === 'boeikop'
        ? rand.richting * (vol.d / 2 + .005)
        : rand.richting * (vol.d / 2 + (model.dakvlakken[0].overstekKop || 0) - .025)
      const dik = rand.type === 'boeikop' ? .04 : .05
      for (const vlak of model.dakvlakken) {
        const { u, n, n0, nok } = vlakRicht(vlak)
        const hv = (vlak.dikte + .12) / Math.max(.25, Math.abs(n[1]))
        if (opties.oudeBoei) {
          const trim = rand.nokTrim ?? 0
          const len = n0 - vlak.inzetLangs + (rand.type === 'windveer' ? vlak.overstekLangs : 0) - trim + .04
          prims.push({
            vorm: 'box', rol: rand.type, kleur: rand.type === 'boeikop' ? K.gevel : K.kozijn,
            pos: [nok[0] + u[0] * (trim + len / 2 - .04) + n[0] * (vlak.dikte / 2),
              nok[1] + u[1] * (trim + len / 2 - .04) + n[1] * (vlak.dikte / 2), zPos],
            ry: 0, rz: Math.atan2(u[1], u[0]), size: [len, vlak.dikte + .12, dik],
          })
        } else {
          // het boeideel loopt door tot de gevelrand (of het einde van
          // het overstek); de plaat-inzet geldt voor de plaat, niet
          // voor de afwerking
          const eindLangs = n0 + (rand.type === 'windveer' ? vlak.overstekLangs : 0)
          const eind = [nok[0] + u[0] * eindLangs, nok[1] + u[1] * eindLangs]
          const onder = -.03 // net onder de daklijn beginnen: overlap met de wand
          prims.push({
            vorm: 'extrude', rol: rand.type, kleur: rand.type === 'boeikop' ? K.gevel : K.kozijn,
            contour: [
              [vol.nokOffset, vol.nok + onder], [eind[0], eind[1] + onder],
              [eind[0], eind[1] + onder + hv], [vol.nokOffset, vol.nok + onder + hv],
            ],
            holes: [], dikte: dik, pos: [0, 0, zPos - dik / 2], ry: 0,
          })
        }
      }
    }
    if (rand.type === 'randprofiel') {
      const vlak = model.dakvlakken.find(v => v.kant === rand.kant)
      const { u, n0, nok } = vlakRicht(vlak)
      const eind = n0 - vlak.inzetLangs + vlak.overstekLangs
      prims.push({
        vorm: 'box', rol: 'randprofiel', kleur: K.kozijn,
        pos: [nok[0] + u[0] * eind, nok[1] + u[1] * eind + vlak.dikte / 2 + .01, 0],
        ry: 0, rz: 0, size: [.04, .12, vol.d + 2 * vlak.overstekKop],
      })
    }
    if (rand.type === 'gordingen') {
      const vlak = model.dakvlakken.find(v => v.kant === rand.kant)
      const { u, n, n0, nok } = vlakRicht(vlak)
      const nG = Math.max(2, Math.round(vol.d / STAELDETAILS.kolossaal.gordingHoh))
      const len = vlak.overstekLangs + 1.1
      const sC = n0 - vlak.inzetLangs + vlak.overstekLangs - len / 2
      for (let i = 0; i <= nG; i++) {
        prims.push({
          vorm: 'box', rol: 'gording', kleur: '#26262a',
          pos: [nok[0] + u[0] * sC + n[0] * -.08, nok[1] + u[1] * sC + n[1] * -.08, -vol.d / 2 + (vol.d / nG) * i],
          ry: 0, rz: Math.atan2(u[1], u[0]), size: [len, .12, .06],
        })
      }
    }
  }
  return prims
}

// hulpfuncties gedeeld met het model
function sinHoek(ry, rz) {
  // op gespiegelde wanden (ry = pi) spiegelt een rotatie in het vlak
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

// ---- punt-in-primitief, voor de gesloten-schil-sampling ----
export function dektPunt(prim, P, tol = .03) {
  // wereld -> lokaal: eerst translatie, dan -ry, dan -rz
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
  if (!inPoly([x, y], prim.contour, tol)) return false
  for (const gat of prim.holes) {
    if (inPoly([x, y], gat, -tol)) return false
  }
  return true
}

function inPoly([x, y], poly, groei = 0) {
  // even-odd met een kleine groeimarge via afstand tot de rand
  let binnen = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) binnen = !binnen
  }
  if (binnen) return true
  if (groei <= 0) return false
  // punt vlak buiten de rand telt mee binnen de tolerantie
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
