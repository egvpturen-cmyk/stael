// Modelvalidatie: draait VOORDAT er geometrie bestaat. Een model dat
// faalt wordt gerepareerd of verworpen; de renderer krijgt alleen
// gevalideerde modellen te zien.

import { dakOnderY } from './model.js'

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

export function valideerModel(model) {
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
