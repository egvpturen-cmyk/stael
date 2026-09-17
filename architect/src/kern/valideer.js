// Modelvalidatie: draait VOORDAT er geometrie bestaat, plus een
// gesloten-schil-controle op de definitieve geometrie (exact dezelfde
// afleiding als de renderer). Een model dat faalt wordt gerepareerd of
// verworpen; de renderer krijgt alleen gevalideerde modellen te zien.

import { dakOnderY, nokProfiel, wandVol, WAND_DIKTE } from './model.js'
import { STAELDETAILS } from './staeldetails.js'
import { leidGeometrieAf, dektPunt, wandTransform, inPolyMetGroei } from './afleiding.js'

const sparingPunten = s => s.poly || [
  [s.rect.u - s.rect.w / 2, s.rect.v], [s.rect.u + s.rect.w / 2, s.rect.v],
  [s.rect.u + s.rect.w / 2, s.rect.v + s.rect.h], [s.rect.u - s.rect.w / 2, s.rect.v + s.rect.h]]

function sparingBereik(s) {
  const pts = sparingPunten(s)
  const us = pts.map(p => p[0]), vs = pts.map(p => p[1])
  return { u0: Math.min(...us), u1: Math.max(...us), v0: Math.min(...vs), v1: Math.max(...vs) }
}

const inMasker = (wand, u, v) =>
  wand.maskers.some(mk => inPolyMetGroei([u, v], mk.poly, .02))

// GESLOTEN SCHIL: rasterpunten over elke gevel, gedekt door de
// definitieve geometrie; contactvlakken tussen volumes zijn geen
// buitenschil en tellen niet mee
export function schilFouten(model, opties = {}) {
  const prims = leidGeometrieAf(model, opties)
  const afwerking = prims.filter(p =>
    ['boeikop', 'boeideel', 'windveer', 'nokvouw', 'randprofiel', 'daklijst', 'portaal'].includes(p.rol))
  const fouten = []
  const stap = .07

  const wereld = (t, u, v, dz) => {
    const c = Math.cos(t.ry), s = Math.sin(t.ry)
    return [t.pos[0] + c * u + s * dz, v, t.pos[2] - s * u + c * dz]
  }

  for (const wand of model.wanden) {
    const volEcht = model.volumes.find(v => v.id === wand.volumeId)
    const vol = wandVol(wand, volEcht)
    const t = wandTransform(wand, volEcht)
    const grensU = (wand.type === 'kop' ? vol.b / 2 : vol.d / 2) - .04
    // verticale dakpakketdikte per positie: bij een verschoven nok
    // hebben de twee dakvlakken verschillende hellingen
    const dikVOp = u => {
      if (vol.plat) return vol.dakDikte
      const halve = u <= vol.nokOffset ? vol.nokOffset + vol.b / 2 : vol.b / 2 - vol.nokOffset
      return vol.dakDikte / Math.cos(Math.atan2(vol.nok - vol.goot, Math.max(.3, halve)))
    }
    const dikV = Math.max(dikVOp(-vol.b / 2), dikVOp(vol.b / 2))

    // A. fysieke dichtheid door de schildikte
    const dieptes = []
    for (let dz = -.05; dz <= WAND_DIKTE + .35; dz += .045) dieptes.push(dz)
    let gaten = 0, eerste = null
    for (let u = -grensU; u <= grensU; u += stap) {
      const vTop = (wand.type === 'kop' ? dakOnderY(u, vol) : vol.goot) - .04
      for (let v = .04; v <= vTop; v += stap) {
        if (inMasker(wand, u, v)) continue
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

    // B. afgewerkte dakrand: gedekt door echte randafwerking, met
    // millimeter-tolerantie; op contactzijden niet vereist
    let naakt = 0, eersteB = null
    const bandStap = .05
    const veranda = vol.verandaKop && wand.type === 'kop' && wand.richting === 1 ? vol.verandaKop.diepte : 0
    // de afwerking zit rond het rand-einde: op het gevelvlak (strak,
    // plat) of op het einde van de doorgestoken plaat (kolossaal,
    // veranda, portaal); bemonster een reeks dieptes rond dat einde
    const bandDz = einde => [einde - .07, einde - .04, einde - .015, einde + .01, einde + .03]
      .map(e => e + WAND_DIKTE)
    if (wand.type === 'kop') {
      const einde = (vol.plat || (vol.familie === 'strak' && !veranda)) ? 0
        : vol.overstekKop + veranda - (veranda && vol.verandaKop.portaal ? .3 : 0)
      const dzs = bandDz(einde)
      for (let u = -grensU; u <= grensU; u += bandStap) {
        const v0 = dakOnderY(u, vol) + .03, v1 = dakOnderY(u, vol) + dikVOp(u) + .06
        for (let v = v0; v <= v1; v += bandStap) {
          if (inMasker(wand, u, Math.min(v, dakOnderY(u, vol) - .01))) continue
          if (!dzs.some(dz => afwerking.some(p => dektPunt(p, wereld(t, u, v, dz), .006)))) {
            naakt++
            if (!eersteB) eersteB = [u, v]
          }
        }
      }
    } else if (vol.familie === 'strak' || vol.plat) {
      const dzs = bandDz(0)
      for (let u = -grensU; u <= grensU; u += bandStap) {
        if (inMasker(wand, u, vol.goot - .05)) continue
        for (let v = vol.goot + .03; v <= vol.goot + dikV + .08; v += bandStap) {
          if (!dzs.some(dz => afwerking.some(p => dektPunt(p, wereld(t, u, v, dz), .006)))) {
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

// ELEMENT-AFHEID: elk element heeft logische einden (dakcontour, kader,
// pui, plint, maaiveld of een ander element), lineaire elementen komen
// in knooppunten samen, een balkon is bereikbaar (deur in de pui) en
// een paneel heeft een functie. Niet-af is nooit een optie.
export function elementFouten(model) {
  const fouten = []
  for (const wand of model.wanden) {
    const vol = wandVol(wand, model.volumes.find(v => v.id === wand.volumeId))
    const ketens = new Map()
    for (const el of wand.elementen || []) {
      if (el.bekleding) continue
      // 1. elk element declareert zijn rol en zijn grenzen; een element
      // zonder gedefinieerde functie of einden is per definitie niet af
      if (!el.rol) {
        fouten.push(wand.id + ': element zonder gedefinieerde rol of einden (niet af)')
        continue
      }
      if (el.rol === 'lamel') {
        // latten lopen individueel door tot hun veldgrens
        for (const [u, v] of [el.van, el.tot]) {
          let ok = false
          if (el.grens === 'dakcontour') {
            // de modelmarge is .12 vanaf de contour; toets ruimer zodat
            // een correct geclipte lat nooit op afronding faalt
            const ber = kopBereikVan(v, vol)
            ok = ber && (Math.abs(u - ber[0]) < .17 || Math.abs(u - ber[1]) < .17)
          }
          if (!ok && el.grens === 'kader') {
            // geometrisch: het lat-einde raakt een kaderstijl of de
            // dakcontour binnen het kader
            ok = (wand.elementen || []).some(k => k.rol === 'kader' && k.type === 'blok'
              && Math.abs(k.u - u) < (k.b / 2) + .12)
            if (!ok) {
              const ber = kopBereikVan(v, vol)
              ok = ber && (Math.abs(u - ber[0]) < .4 || Math.abs(u - ber[1]) < .4)
            }
          }
          if (!ok && el.grens === 'pui') {
            ok = wand.sparingen.some(sp => {
              const pts = sp.poly || []
              const us = pts.map(q => q[0])
              return pts.length && (Math.abs(u - Math.min(...us)) < .15 || Math.abs(u - Math.max(...us)) < .15)
            })
          }
          if (!ok) fouten.push(wand.id + ': lamel eindigt zwevend op u=' + u.toFixed(2) + ' v=' + v.toFixed(2))
        }
      }
      if (el.keten != null) {
        if (!ketens.has(el.keten)) ketens.set(el.keten, [])
        ketens.get(el.keten).push(el)
      }
      if (el.rol === 'paneel') {
        const okPoort = el.functie === 'poort' && el.v0 <= .03 && el.v1 - el.v0 >= 2.0 && el.b >= .85
        const okRitme = el.functie === 'ritmevak' && (wand.ritmeUs || []).some(ru => Math.abs(ru - el.u) < .08)
        if (!okPoort && !okRitme)
          fouten.push(wand.id + ': paneel zonder functie (geen poort en niet in het stramien)')
      }
      if (el.type === 'balkon') {
        const deur = wand.sparingen.some(sp => sp.deur
          && sp.deur.b >= .8
          && Math.abs(sp.deur.dorpel - el.vloer) <= .08
          && sp.deur.u > el.u - el.breedte / 2 - .1 && sp.deur.u < el.u + el.breedte / 2 + .1)
        if (!deur) fouten.push(wand.id + ': balkon zonder deur in de pui erachter (onbereikbaar)')
      }
    }
    // 2. lineaire ketens: opeenvolgende segmenten delen hun knooppunt,
    // keteneinden liggen op maaiveld of een gedeclareerde grens
    for (const [ketenId, delen] of ketens) {
      const gesorteerd = delen.slice().sort((a, b) => a.knoopIndex - b.knoopIndex)
      for (let i = 0; i < gesorteerd.length - 1; i++) {
        const a = gesorteerd[i], b = gesorteerd[i + 1]
        const eindA = a.tot || [a.u, a.v1]
        const beginB = b.van || [b.u, b.v0]
        if (Math.hypot(eindA[0] - beginB[0], eindA[1] - beginB[1]) > .03)
          fouten.push(wand.id + ': keten ' + ketenId + ' heeft een open knoop tussen deel ' + i + ' en ' + (i + 1))
      }
      const eerste = gesorteerd[0], laatste = gesorteerd[gesorteerd.length - 1]
      const begin = eerste.van || [eerste.u, eerste.v0]
      const eind = laatste.tot || [laatste.u, laatste.v1]
      for (const p of [begin, eind]) {
        if (p[1] > .03) fouten.push(wand.id + ': keten ' + ketenId + ' eindigt zwevend op v=' + p[1].toFixed(2))
      }
    }
  }
  return fouten
}

function kopBereikVan(v, vol) {
  const { b, goot, nok, nokOffset } = vol
  if (vol.plat || v <= goot) return [-b / 2, b / 2]
  if (v >= nok) return null
  const f = (v - goot) / (nok - goot)
  return [-b / 2 + f * (nokOffset + b / 2), b / 2 - f * (b / 2 - nokOffset)]
}

export function valideerModel(model, opties = {}) {
  const fouten = []
  const volVan = w => model.volumes.find(v => v.id === w.volumeId)

  for (const wand of model.wanden) {
    const vol = wandVol(wand, volVan(wand))
    // 1. elke sparing volledig binnen de gastwand
    for (const s of wand.sparingen) {
      for (const punt of sparingPunten(s)) {
        if (punt[1] <= .01) continue
        if (wand.type === 'kop' && punt[1] >= dakOnderY(punt[0], vol) - .09) {
          fouten.push(wand.id + ': sparing ' + s.id + ' raakt het dakpakket'); break
        }
        if (wand.type === 'langs' && punt[1] >= vol.goot - .04) {
          fouten.push(wand.id + ': sparing ' + s.id + ' steekt boven de goot uit'); break
        }
        if (Math.abs(punt[0]) > (wand.type === 'kop' ? vol.b / 2 : vol.d / 2) - .04) {
          fouten.push(wand.id + ': sparing ' + s.id + ' steekt buiten de gevelrand'); break
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
    // 2b. gevel-elementen binnen het gastvlak; bekleding niet over een
    // sparing; balkon alleen met een pui erachter
    for (const el of wand.elementen || []) {
      const punten = el.type === 'blok' ? [[el.u - el.b / 2, el.v1], [el.u + el.b / 2, el.v1]]
        : el.type === 'strook' ? [el.van, el.tot] : []
      for (const [u, v] of punten) {
        const grensU = (wand.type === 'kop' ? vol.b / 2 : vol.d / 2) + .08
        if (Math.abs(u) > grensU) { fouten.push(wand.id + ': gevel-element steekt buiten de gevelrand'); break }
        const grensV = wand.type === 'kop'
          ? dakOnderY(Math.max(-vol.b / 2, Math.min(vol.b / 2, u)), vol) + .03
          : vol.goot + .25
        if (v > grensV) { fouten.push(wand.id + ': gevel-element doorsnijdt het dakvlak'); break }
      }
      if (el.bekleding) {
        for (const sp of wand.sparingen) {
          const r = sparingBereik(sp)
          if (el.u - el.b / 2 < r.u1 - .01 && el.u + el.b / 2 > r.u0 + .01
            && el.v0 < r.v1 - .01 && el.v1 > r.v0 + .01)
            fouten.push(wand.id + ': bekleding ligt over sparing ' + sp.id)
        }
      }
      if (el.type === 'balkon') {
        const achter = wand.sparingen.some(sp => {
          const r = sparingBereik(sp)
          return r.u0 < el.u + el.breedte / 2 && r.u1 > el.u - el.breedte / 2 && r.v1 > el.vloer + .8
        })
        if (!achter) fouten.push(wand.id + ': balkon zonder pui erachter')
      }
    }
    // 3. wandcontour nooit door het dakpakket
    if (wand.type === 'kop' && !vol.plat) {
      for (const [u, v] of wand.contour) {
        if (v > .01 && v > dakOnderY(u, vol) + .001)
          fouten.push(wand.id + ': contour steekt door het dakpakket op u=' + u.toFixed(2))
      }
    }
  }

  // 4. alle dakranden afgewerkt, passend bij familie en dakvorm
  for (const vol of model.volumes) {
    const randen = model.randafwerking.filter(r => r.volumeId === vol.id)
    const heeft = naam => randen.some(r =>
      r.type + (r.kant != null ? ':' + r.kant : r.richting != null ? ':' + r.richting : r.rand ? ':' + r.rand : '') === naam)
    let nodig
    if (vol.plat) {
      nodig = []
      for (const rd of ['kop+', 'kop-', 'langs+', 'langs-']) {
        const w = model.wanden.find(x => x.id === vol.id + ':' + rd)
        const contact = w && w.maskers.length > 0
        if (!contact) nodig.push('daklijst:' + rd)
      }
    } else {
      const kopAf = ri => {
        const w = model.wanden.find(x => x.id === vol.id + ':kop' + (ri === 1 ? '+' : '-'))
        if (w && w.maskers.length > 0) return null // contactzijde
        if (ri === 1 && vol.verandaKop && vol.verandaKop.portaal) return 'verandakolommen'
        return (vol.familie === 'strak' ? 'boeikop:' : 'windveer:') + ri
      }
      nodig = vol.familie === 'strak'
        ? ['nokvouw', 'boeideel:1', 'boeideel:-1']
        : ['nokvouw', 'randprofiel:1', 'randprofiel:-1', 'gordingen:1', 'gordingen:-1']
      for (const ri of [1, -1]) {
        const eis = kopAf(ri)
        if (eis === 'verandakolommen') {
          if (!randen.some(r => r.type === 'verandakolommen')) nodig.push('verandakolommen')
        } else if (eis) nodig.push(eis)
      }
    }
    for (const n of nodig) {
      if (!heeft(n)) fouten.push(vol.id + ': dakrand niet afgewerkt: ' + n)
    }

    // 5. nok: een doorlopende vouw op de snijlijn van de dakvlakken
    if (!vol.plat) {
      const vouwen = randen.filter(r => r.type === 'nokvouw')
      if (vouwen.length !== 1) {
        fouten.push(vol.id + ': precies een doorlopende nokvouw vereist, gevonden ' + vouwen.length)
      } else {
        const vlakken = model.dakvlakken.filter(v => v.volumeId === vol.id)
        const her = nokProfiel(vlakken, STAELDETAILS.nok.vouwBreedte, STAELDETAILS.nok.dikte)
        const vouw = vouwen[0]
        if (!vouw.profiel || vouw.profiel.length !== 6) {
          fouten.push(vol.id + ': nokvouwprofiel ontbreekt of is onvolledig')
        } else if (her.some((p, i) => Math.hypot(vouw.profiel[i][0] - p[0], vouw.profiel[i][1] - p[1]) > .001)) {
          fouten.push(vol.id + ': nokvouw ligt niet op de snijlijn van de dakvlakken')
        }
      }
    }
  }

  // 5b. samengestelde massa: de staartnok blijft onder de kopnok
  const kop = model.volumes.find(v => v.rol === 'kop')
  const staart = model.volumes.find(v => v.rol === 'staart')
  if (kop && staart && staart.nok > kop.nok - .35)
    fouten.push('kop-en-staart: staartnok (' + staart.nok.toFixed(2) + ') komt te dicht bij de kopnok (' + kop.nok.toFixed(2) + ')')

  // 6. element-afheid
  fouten.push(...elementFouten(model))

  // 7. gesloten schil op de definitieve geometrie
  fouten.push(...schilFouten(model, opties))

  return fouten
}

// reparatie: klemmen met dezelfde meetkunde; wat niet te klemmen valt,
// vervalt en de generator probeert een nieuwe variant
export function repareerModel(model) {
  for (const wand of model.wanden) {
    const vol = wandVol(wand, model.volumes.find(v => v.id === wand.volumeId))
    wand.sparingen = wand.sparingen.map(s => {
      if (s.poly) {
        s.poly = s.poly.map(([u, v]) => [
          Math.max(-vol.b / 2 + .12, Math.min(vol.b / 2 - .12, u)),
          Math.min(v, dakOnderY(u, vol) - .12),
        ])
        return s
      }
      const grens = (wand.type === 'kop' ? vol.b / 2 : vol.d / 2)
      const top = wand.type === 'kop'
        ? Math.min(dakOnderY(s.rect.u - s.rect.w / 2, vol), dakOnderY(s.rect.u + s.rect.w / 2, vol)) - .12
        : vol.goot - .12
      s.rect.u = Math.max(-(grens - s.rect.w / 2 - .12), Math.min(grens - s.rect.w / 2 - .12, s.rect.u))
      s.rect.h = Math.min(s.rect.h, top - s.rect.v)
      return s.rect.h > .3 ? s : null
    }).filter(Boolean)
    wand.elementen = (wand.elementen || []).filter(el => {
      if (el.type === 'blok') {
        const grensV = wand.type === 'kop'
          ? Math.min(dakOnderY(el.u - el.b / 2, vol), dakOnderY(el.u + el.b / 2, vol)) - .05
          : vol.goot + .2
        el.v1 = Math.min(el.v1, grensV)
        return el.v1 - el.v0 > .2
      }
      return true
    })
  }
  return model
}
