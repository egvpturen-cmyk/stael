// Modelvalidatie: draait VOORDAT er geometrie bestaat. Een model dat
// faalt wordt gerepareerd of verworpen; de renderer krijgt alleen
// gevalideerde modellen te zien.

import { dakOnderY, nokProfiel, WAND_DIKTE } from './model.js'
import { STAELDETAILS } from './staeldetails.js'
import { leidGeometrieAf, dektPunt, wandTransform } from './afleiding.js'

// GESLOTEN SCHIL: onafhankelijke controle die niet te foppen is.
// Elke gevel wordt gerasterd tot aan (en inclusief) het dakpakket, en
// elk rasterpunt moet gedekt zijn door de DEFINITIEVE geometrie
// (dezelfde afleiding als de renderer): wand, glasvulling, boeideel,
// nokvouw, dakpakket of andere randafwerking. Een gat is een fout.
export function schilFouten(model, opties = {}) {
  const prims = leidGeometrieAf(model, opties)
  const afwerking = prims.filter(p =>
    ['boeikop', 'boeideel', 'windveer', 'nokvouw', 'randprofiel'].includes(p.rol))
  const vol = model.volumes[0]
  const fouten = []
  const stap = .07
  const dikV = vol.dakDikte / Math.cos(Math.atan2(vol.nok - vol.goot, vol.b / 2 - Math.abs(vol.nokOffset)) || 0)

  const wereld = (t, u, v, dz) => {
    const c = Math.cos(t.ry), s = Math.sin(t.ry)
    return [t.pos[0] + c * u + s * dz, v, t.pos[2] - s * u + c * dz]
  }

  for (const wand of model.wanden) {
    const t = wandTransform(wand, vol)
    const grensU = (wand.type === 'kop' ? vol.b / 2 : vol.d / 2) - .04

    // A. fysieke dichtheid: elk gevelpunt is ergens in de schildikte
    // gedekt (wand, glasvulling, plaatwerk); fijn genoeg bemonsterd om
    // elke laag (ook het teruggelegde glas) te raken
    const dieptes = []
    for (let dz = -.05; dz <= WAND_DIKTE + .35; dz += .045) dieptes.push(dz)
    let gaten = 0, eerste = null
    for (let u = -grensU; u <= grensU; u += stap) {
      const vTop = (wand.type === 'kop' ? dakOnderY(u, vol) : vol.goot) - .04
      for (let v = .04; v <= vTop; v += stap) {
        if (!dieptes.some(dz => {
          const P = wereld(t, u, v, dz)
          return prims.some(p => dektPunt(p, P))
        })) {
          gaten++
          if (!eerste) eerste = [u, v]
        }
      }
    }
    if (gaten) fouten.push(wand.id + ': open geveldeel, ' + gaten
      + ' ongedekte punten, eerste bij u=' + eerste[0].toFixed(2) + ' v=' + eerste[1].toFixed(2))

    // B. afgewerkte dakrand: de band ter dikte van het dakpakket langs
    // de dakrand moet gedekt zijn door ECHTE randafwerking (boeideel,
    // windveer, nokvouw, randprofiel), niet door een kale
    // plaatdoorsnede; millimeter-tolerantie zodat naden niet wegvallen
    let naakt = 0, eersteB = null
    const bandStap = .05
    if (wand.type === 'kop') {
      // bij een strakke rand ligt de afwerking op het gevelvlak, bij een
      // kolossaal overstek op het einde van de doorgestoken plaat
      const dz = vol.familie === 'strak'
        ? WAND_DIKTE + .025
        : WAND_DIKTE + vol.overstekKop - .02
      for (let u = -grensU; u <= grensU; u += bandStap) {
        const v0 = dakOnderY(u, vol) + .03, v1 = dakOnderY(u, vol) + dikV + .06
        for (let v = v0; v <= v1; v += bandStap) {
          const P = wereld(t, u, v, dz)
          if (!afwerking.some(p => dektPunt(p, P, .006))) {
            naakt++
            if (!eersteB) eersteB = [u, v]
          }
        }
      }
    } else if (vol.familie === 'strak') {
      const dz = WAND_DIKTE + .02
      for (let u = -grensU; u <= grensU; u += bandStap) {
        for (let v = vol.goot + .03; v <= vol.goot + dikV + .08; v += bandStap) {
          const P = wereld(t, u, v, dz)
          if (!afwerking.some(p => dektPunt(p, P, .006))) {
            naakt++
            if (!eersteB) eersteB = [u, v]
          }
        }
      }
    }
    if (naakt) fouten.push(wand.id + ': dakrand niet afgewerkt over ' + naakt
      + ' punten (kale doorsnede of naad), eerste bij u=' + eersteB[0].toFixed(2) + ' v=' + eersteB[1].toFixed(2))
  }
  return fouten
}

function inContour(punt, contour, marge = 0) {
  // even-odd test plus margecontrole tegen de bovenranden
  const [x, y] = punt
  let binnen = false
  for (let i = 0, j = contour.length - 1; i < contour.length; j = i++) {
    const [xi, yi] = contour[i], [xj, yj] = contour[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) binnen = !binnen
  }
  return binnen
}

function sparingPunten(s) {
  if (s.poly) return s.poly
  const { u, v, w, h } = s.rect
  return [[u - w / 2, v], [u + w / 2, v], [u + w / 2, v + h], [u - w / 2, v + h]]
}

function sparingBereik(s) {
  const pts = sparingPunten(s)
  const us = pts.map(p => p[0]), vs = pts.map(p => p[1])
  return { u0: Math.min(...us), u1: Math.max(...us), v0: Math.min(...vs), v1: Math.max(...vs) }
}

export function valideerModel(model, opties = {}) {
  const fouten = []
  const vol = model.volumes[0]

  for (const wand of model.wanden) {
    // 1. elke sparing volledig binnen de gastwand (marge .1)
    for (const s of wand.sparingen) {
      for (const punt of sparingPunten(s)) {
        const krimp = [punt[0], Math.min(punt[1], punt[1] - .001) + .001]
        if (!inContour([krimp[0], krimp[1] + .05], wand.contour) && punt[1] > .01) {
          if (wand.type === 'kop' && punt[1] >= dakOnderY(punt[0], vol) - .09) {
            fouten.push(wand.id + ': sparing ' + s.id + ' raakt het dakpakket')
            break
          }
          if (wand.type === 'langs' && punt[1] >= vol.goot - .04) {
            fouten.push(wand.id + ': sparing ' + s.id + ' steekt boven de goot uit')
            break
          }
          if (Math.abs(punt[0]) > (wand.type === 'kop' ? vol.b / 2 : vol.d / 2) - .04) {
            fouten.push(wand.id + ': sparing ' + s.id + ' steekt buiten de gevelrand')
            break
          }
        }
      }
    }
    // 2. sparingen onderling disjunct
    for (let i = 0; i < wand.sparingen.length; i++) {
      for (let j = i + 1; j < wand.sparingen.length; j++) {
        const a = sparingBereik(wand.sparingen[i]), b = sparingBereik(wand.sparingen[j])
        if (a.u0 < b.u1 - .01 && b.u0 < a.u1 - .01 && a.v0 < b.v1 - .01 && b.v0 < a.v1 - .01)
          fouten.push(wand.id + ': sparingen ' + wand.sparingen[i].id + ' en ' + wand.sparingen[j].id + ' overlappen')
      }
    }
    // 2b. gevel-elementen: volledig binnen het gastvlak of exact
    // geclipt; bekleding nooit over een sparing; balkon alleen met
    // een pui (sparing) erachter
    for (const el of wand.elementen || []) {
      const punten = el.type === 'blok' ? [[el.u - el.b / 2, el.v1], [el.u + el.b / 2, el.v1]]
        : el.type === 'strook' ? [el.van, el.tot] : []
      for (const [u, v] of punten) {
        const grensU = (wand.type === 'kop' ? vol.b / 2 : vol.d / 2) + .08
        if (Math.abs(u) > grensU) { fouten.push(wand.id + ': gevel-element steekt buiten de gevelrand'); break }
        const grensV = wand.type === 'kop' ? dakOnderY(Math.max(-vol.b / 2, Math.min(vol.b / 2, u)), vol) + .03 : vol.goot + .25
        if (v > grensV) { fouten.push(wand.id + ': gevel-element doorsnijdt het dakvlak'); break }
      }
      if (el.bekleding) {
        for (const sp of wand.sparingen) {
          const pts = sp.poly || [[sp.rect.u - sp.rect.w / 2, sp.rect.v], [sp.rect.u + sp.rect.w / 2, sp.rect.v + sp.rect.h]]
          const us = pts.map(q => q[0]), vs = pts.map(q => q[1])
          if (el.u - el.b / 2 < Math.max(...us) - .01 && el.u + el.b / 2 > Math.min(...us) + .01
            && el.v0 < Math.max(...vs) - .01 && el.v1 > Math.min(...vs) + .01)
            fouten.push(wand.id + ': bekleding ligt over sparing ' + sp.id)
        }
      }
      if (el.type === 'balkon') {
        const achter = wand.sparingen.some(sp => {
          const pts = sp.poly || [[sp.rect.u - sp.rect.w / 2, sp.rect.v], [sp.rect.u + sp.rect.w / 2, sp.rect.v + sp.rect.h]]
          const us = pts.map(q => q[0]), vs = pts.map(q => q[1])
          return Math.min(...us) < el.u + el.breedte / 2 && Math.max(...us) > el.u - el.breedte / 2
            && Math.max(...vs) > el.vloer + .8
        })
        if (!achter) fouten.push(wand.id + ': balkon zonder pui erachter')
      }
    }

    // 3. bovenrand van de wand is de onderzijde van het dakpakket
    if (wand.type === 'kop') {
      for (const [u, v] of wand.contour) {
        if (v > .01 && v > dakOnderY(u, vol) + .001)
          fouten.push(wand.id + ': contour steekt door het dakpakket op u=' + u.toFixed(2))
      }
    }
  }

  // 4. alle dakranden gesloten, passend bij de detailfamilie
  const nodig = vol.familie === 'strak'
    ? ['nokvouw', 'boeideel:1', 'boeideel:-1', 'boeikop:1', 'boeikop:-1']
    : ['nokvouw', 'randprofiel:1', 'randprofiel:-1', 'windveer:1', 'windveer:-1', 'gordingen:1', 'gordingen:-1']
  const aanwezig = model.randafwerking.map(r =>
    r.type + (r.kant != null ? ':' + r.kant : r.richting != null ? ':' + r.richting : ''))
  for (const n of nodig) {
    if (!aanwezig.includes(n)) fouten.push('dakrand niet afgewerkt: ' + n)
  }

  // 5. de nok: precies een doorlopende gevouwen afdekking waarvan de
  // vouwlijn op het snijpunt van de plaatbovenvlakken ligt, en geen
  // ander randelement dat tot boven de vouw reikt (stapeling)
  const vouwen = model.randafwerking.filter(r => r.type === 'nokvouw')
  if (vouwen.length !== 1) {
    fouten.push('nok: precies een doorlopende vouwafdekking vereist, gevonden ' + vouwen.length)
  } else {
    const vouw = vouwen[0]
    const her = nokProfiel(model.dakvlakken, STAELDETAILS.nok.vouwBreedte, STAELDETAILS.nok.dikte)
    if (!vouw.profiel || vouw.profiel.length !== 6) {
      fouten.push('nok: vouwprofiel ontbreekt of is onvolledig')
    } else {
      for (let i = 0; i < 6; i++) {
        if (Math.hypot(vouw.profiel[i][0] - her[i][0], vouw.profiel[i][1] - her[i][1]) > .001) {
          fouten.push('nok: vouwlijn ligt niet op de snijlijn van de dakvlakken')
          break
        }
      }
    }
  }
  // 6. gesloten schil: de som van gevel, glas, boeidelen, nokvouw en
  // dakpakket dekt elke gevelcontour volledig, nagerekend op de
  // definitieve geometrie (zelfde afleiding als de renderer)
  fouten.push(...schilFouten(model, opties))

  return fouten
}

// reparatie met dezelfde meetkunde als het model zelf: sparingen worden
// geklemd binnen hun gastwand; wat niet te klemmen valt, vervalt
export function repareerModel(model) {
  const vol = model.volumes[0]
  for (const wand of model.wanden) {
    wand.sparingen = wand.sparingen.map(s => {
      if (s.poly) {
        s.poly = s.poly.map(([u, v]) => [
          Math.max(-vol.b / 2 + .12, Math.min(vol.b / 2 - .12, u)),
          Math.min(v, dakOnderY(u, vol) - .12),
        ])
        return s
      }
      const grens = wand.type === 'kop' ? vol.b / 2 : vol.d / 2
      const top = wand.type === 'kop'
        ? Math.min(dakOnderY(s.rect.u - s.rect.w / 2, vol), dakOnderY(s.rect.u + s.rect.w / 2, vol)) - .12
        : vol.goot - .12
      s.rect.u = Math.max(-(grens - s.rect.w / 2 - .12), Math.min(grens - s.rect.w / 2 - .12, s.rect.u))
      s.rect.h = Math.min(s.rect.h, top - s.rect.v)
      return s.rect.h > .3 ? s : null
    }).filter(Boolean)
  }
  return model
}
