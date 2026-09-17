// Geometrie-validatie: elke gegenereerde variant (en elke kalibratiepreset)
// wordt gecontroleerd op botsingen die in echte bouw niet bestaan:
// elementen die een dakvlak doorsnijden, elementen die onbedoeld buiten het
// volume uitsteken, en onlogische aansluitingen. Een variant die faalt
// wordt gerepareerd of verworpen en komt nooit bij de klant of op de
// kalibratiepagina.

import { gevelBereik, clipLat, clipVlak, randYOp } from './geometrie.js'

const prof = spec => ({ b: spec.b, goot: spec.goot, nok: spec.nok, off: spec.nokOffset || 0 })

export function valideerSpec(spec) {
  const fouten = []
  const p = prof(spec)
  const zadel = !spec.plat && spec.nok > spec.goot

  // (a) elementen die het dakvlak doorsnijden
  if (spec.kop?.lamellen && zadel) {
    const top = randYOp(p.off, spec.b, spec.goot, spec.nok, p.off, .3)
    for (let y = spec.goot + .25; y < top; y += .3) {
      if (!gevelBereik(y, spec.b, spec.goot, spec.nok, p.off, .1)) {
        fouten.push('lamellen steken door het dakvlak op y=' + y.toFixed(2)); break
      }
    }
  }
  for (const v of spec.lamellenVelden || []) {
    if (zadel && v.y1 > randYOp(v.x || 0, spec.b, spec.goot, spec.nok, p.off, .1)) {
      if (!clipLat(v.x || 0, v.w, v.y1, p)) fouten.push('lamellenveld steekt door het dakvlak')
    }
  }
  for (const pa of spec.panelen || []) {
    if (pa.vlak === 'kop' && zadel) {
      const geclipt = clipVlak(pa.x || 0, pa.y, pa.w, pa.h, p)
      if (!geclipt) fouten.push('gevelpaneel valt volledig buiten de contour')
      else if (geclipt.h < pa.h - .01) fouten.push('gevelpaneel steekt door het dakvlak')
    }
  }
  for (const g of spec.glasPanelen || []) {
    if (g.vlak === 'kop' && zadel && (g.z == null || Math.abs(g.z - spec.d / 2) < .5)) {
      if (g.y + g.h / 2 > randYOp(g.x || 0, spec.b, spec.goot, spec.nok, p.off, .1))
        fouten.push('glaspaneel steekt door het dakvlak')
    }
  }
  if (spec.elementen?.includes('dakkapel') && zadel) {
    const x = (p.off + spec.b / 2) / 2
    const top = randYOp(x, spec.b, spec.goot, spec.nok, p.off, 0) - .55 + .75
    if (top > spec.nok - .15) fouten.push('dakkapel steekt boven de nok uit')
  }
  if (spec.dakOpbouw) {
    const o = spec.dakOpbouw
    const bMax = spec.massa === 'stapel' ? (spec.stapel?.boven.b ?? spec.b) : spec.b
    const dMax = spec.massa === 'stapel' ? (spec.stapel?.boven.d ?? spec.d) : spec.d
    if (Math.abs(o.x || 0) + o.b / 2 > bMax / 2 || Math.abs(o.z || 0) + o.d / 2 > dMax / 2)
      fouten.push('dakopbouw steekt buiten de dakrand')
  }

  // (b) elementen die onbedoeld buiten of in het volume steken
  for (const a of spec.aanbouwen || []) {
    if (a.x + a.b / 2 > -spec.b / 2 + .3 && a.x - a.b / 2 < spec.b / 2 - .3
      && Math.abs(a.z) < spec.d / 2) fouten.push('aanbouw overlapt het hoofdvolume')
  }
  if (spec.kop?.penanten && zadel) {
    const gB = spec.b * (spec.kop.puiFactor || .62)
    const n = spec.kop.penanten.n || 3
    for (let i = 1; i <= n; i++) {
      const x = -gB / 2 + (gB / n) * i + (spec.kop.puiX || 0)
      if (Math.abs(x) > spec.b / 2 - .1) { fouten.push('penant valt buiten de gevel'); break }
    }
  }
  if (spec.elementen?.includes('balkon')) {
    const vloer = spec.plint ? spec.plint.h : 2.95
    if (vloer > spec.goot + (zadel ? (spec.nok - spec.goot) * .4 : 0))
      fouten.push('balkon ligt boven de gevelcontour')
  }

  // (c) onlogische aansluitingen van kappen en volumes
  if (spec.kopstaart) {
    const ks = spec.kopstaart
    if (ks.gootK <= spec.goot - 1.6) fouten.push('kopgebouw lager dan de staartgoot')
    if (ks.nokK <= spec.nok - 2.5) fouten.push('kopnok te laag ten opzichte van de staart')
    if (ks.dKop >= spec.d - 2) fouten.push('staart te kort voor een kop-en-staart')
  }
  if (spec.dwars) {
    const dw = spec.dwars
    if (dw.nok2 >= spec.nok - .2) fouten.push('dwarsnok prikt door de hoofdnok')
    if (dw.goot2 >= spec.goot + 1.2) fouten.push('dwarsgoot sluit niet aan op het hoofdvolume')
    if (Math.abs(dw.z) + dw.b2 / 2 > spec.d / 2 - .2) fouten.push('dwarsvolume steekt voorbij de kopgevel')
  }
  if (spec.stapel) {
    const st = spec.stapel
    if (st.onder.h + st.boven.h > Math.max(spec.nok, spec.goot) + .05)
      fouten.push('gestapelde volumes hoger dan de toegestane hoogte')
  }
  return fouten
}

// probeer een falende spec te repareren met dezelfde clip-wiskunde;
// wat niet te repareren valt, laat de generator opnieuw genereren
export function repareerSpec(spec) {
  const p = prof(spec)
  const zadel = !spec.plat && spec.nok > spec.goot
  if (spec.panelen && zadel) {
    spec.panelen = spec.panelen.map(pa => {
      if (pa.vlak !== 'kop') return pa
      const c = clipVlak(pa.x || 0, pa.y, pa.w, pa.h, p)
      return c ? { ...pa, y: c.y, h: c.h } : null
    }).filter(Boolean)
  }
  if (spec.lamellenVelden && zadel) {
    spec.lamellenVelden = spec.lamellenVelden.map(v => {
      const rand = randYOp(v.x || 0, spec.b, spec.goot, spec.nok, p.off, .25)
      return v.y1 > rand ? { ...v, y1: Math.max(v.y0 + .3, rand) } : v
    }).filter(v => v.y1 > v.y0)
  }
  if (spec.glasPanelen && zadel) {
    spec.glasPanelen = spec.glasPanelen.map(g => {
      if (g.vlak !== 'kop') return g
      const c = clipVlak(g.x || 0, g.y, g.w, g.h, p)
      return c ? { ...g, y: c.y, h: c.h } : null
    }).filter(Boolean)
  }
  if (spec.dakOpbouw) {
    const o = spec.dakOpbouw
    const bMax = (spec.massa === 'stapel' ? (spec.stapel?.boven.b ?? spec.b) : spec.b) / 2
    const dMax = (spec.massa === 'stapel' ? (spec.stapel?.boven.d ?? spec.d) : spec.d) / 2
    o.x = Math.max(-(bMax - o.b / 2 - .2), Math.min(bMax - o.b / 2 - .2, o.x || 0))
    o.z = Math.max(-(dMax - o.d / 2 - .2), Math.min(dMax - o.d / 2 - .2, o.z || 0))
  }
  if (spec.aanbouwen) {
    spec.aanbouwen = spec.aanbouwen.map(a => {
      if (a.x + a.b / 2 > -spec.b / 2 + .3 && Math.abs(a.z) < spec.d / 2)
        return { ...a, x: -(spec.b / 2 + a.b / 2 + .4) }
      return a
    })
  }
  if (spec.dwars) {
    spec.dwars.nok2 = Math.min(spec.dwars.nok2, spec.nok - .4)
    spec.dwars.goot2 = Math.min(spec.dwars.goot2, spec.goot + 1.0)
    const zMax = spec.d / 2 - spec.dwars.b2 / 2 - .3
    spec.dwars.z = Math.max(-zMax, Math.min(zMax, spec.dwars.z))
  }
  if (spec.kopstaart) {
    spec.kopstaart.gootK = Math.max(spec.kopstaart.gootK, spec.goot - 1.4)
    spec.kopstaart.nokK = Math.max(spec.kopstaart.nokK, spec.nok - 2.2)
    spec.kopstaart.dKop = Math.min(spec.kopstaart.dKop, spec.d - 2.5)
  }
  return spec
}
