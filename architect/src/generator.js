import { STAEL, KLEUREN, MASSAS, STRAMIENEN, KOPTHEMAS, SECUNDAIR, TYPOLOGIEEN, typologieenVoor } from './ontwerptaal.js'
import { valideerSpec, repareerSpec } from './validatie.js'

// deterministische pseudo-random: zelfde programma en ronde geven
// dezelfde set, een nieuwe ronde geeft echt andere combinaties
function rng(seed) {
  let a = seed >>> 0
  return () => {
    a |= 0; a = a + 0x6D2B79F5 | 0
    let t = Math.imul(a ^ a >>> 15, 1 | a)
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t
    return ((t ^ t >>> 14) >>> 0) / 4294967296
  }
}
const tussen = (r, [lo, hi]) => lo + r() * (hi - lo)
const grad = g => g * Math.PI / 180
const kies = (r, lijst) => lijst[Math.floor(r() * lijst.length) % lijst.length]
function kiesGewogen(r, items) {
  const totaal = items.reduce((s, [, g]) => s + g, 0)
  let lot = r() * totaal
  for (const [naam, g] of items) { lot -= g; if (lot <= 0) return naam }
  return items[items.length - 1][0]
}
const donker = kleur => [KLEUREN.houtZwart, KLEUREN.staalZwart].includes(kleur)
function schud(r, lijst) {
  const l = [...lijst]
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]
  }
  return l
}

export function genereerVarianten(prog, ronde = 0, opties = {}) {
  const basis = ronde * 7919 + 13
  const r = rng((basis + 1) * 2654435761)
  const kandidaten = typologieenVoor(prog.dak, prog.lagen)

  // pool van typologie x massastrategie, geschud per ronde
  const pool = []
  kandidaten.forEach(t => t.massas.forEach(m => pool.push({ t, m })))
  const volgorde = schud(r, pool)

  const doel = 5 + Math.floor(r() * 3) // 5 tot 7
  const lijst = []
  let i = 0, poging = 0
  while (lijst.length < doel && poging < volgorde.length * 4) {
    const { t, m } = volgorde[i % volgorde.length]
    let v = maakVariant(t, m, prog, basis + poging * 31 + i * 7)
    // geometrie-validatie: repareren of verwerpen, nooit doorlaten
    if (v && !opties.ruw) {
      if (valideerSpec(v).length) {
        v = repareerSpec(v)
        if (valideerSpec(v).length) v = null
      }
    }
    if (v) lijst.push(v)
    i++; poging++
  }
  return lijst
}

function maakVariant(t, massaWens, prog, seed) {
  const r = rng((seed + 7) * 2246822519)
  const regels = prog.regels
  const lagen = t.id === 'loft' ? 2 : Math.min(prog.lagen, Math.max(...t.lagen))
  const factor = t.id === 'loft' ? STAEL.loftVerdiepingFactor : STAEL.verdiepingFactor
  const nodig = prog.woonopp / (lagen === 2 ? factor : 1)
  const voet = Math.min(nodig, prog.bouwvlak)
  const past = nodig <= prog.bouwvlak

  let ratio = tussen(r, t.ratio)
  let b = Math.sqrt(voet / ratio)
  if (b > STAEL.maxOverspanning) b = STAEL.maxOverspanning
  const d = voet / b

  let goot = Math.min(tussen(r, t.goot), regels.gootMax)
  if (t.id === 'loft') goot = Math.min(Math.max(goot, 5.9), Math.max(regels.gootMax, 5.9))
  const plat = t.helling[1] === 0 || (prog.dak === 'plat' && t.dakvormen.includes('plat'))
  let helling = 0, nok = goot
  if (!plat) {
    const hMin = Math.max(t.helling[0], regels.hellingMin)
    const hMax = Math.max(hMin, Math.min(t.helling[1], regels.hellingMax))
    helling = tussen(r, [hMin, hMax])
    nok = goot + Math.tan(grad(helling)) * b / 2
    if (nok > regels.nokMax) {
      nok = regels.nokMax
      helling = Math.atan2(nok - goot, b / 2) / Math.PI * 180
    }
  }

  const spec = {
    id: t.id + '-' + massaWens + '-' + seed,
    typologie: t, seed, lagen, past, plat,
    b, d, goot, nok, helling: Math.round(helling),
    overstek: t.overstek,
    voet: Math.round(voet),
    opp: Math.round(voet * (lagen === 2 ? factor : 1)),
    stramienN: Math.max(2, Math.round(d / 2.6)),
    gevel: KLEUREN[kies(r, t.gevels)],
    dak: KLEUREN[kies(r, t.daken)],
    gevel2: null,
    massa: 'enkel',
    kop: { stramien: kies(r, Object.keys(STRAMIENEN)), kader: false, lamellen: false },
    elementen: [],
    zinnen: [],
  }

  // massastrategie toepassen als hij past, anders terugvallen op enkel
  const massaDef = MASSAS[massaWens]
  if (massaWens !== 'enkel' && massaDef.kan && massaDef.kan(spec)) {
    spec.massa = massaWens
    if (massaWens === 'kopstaart') {
      const dKop = Math.max(4.5, d * .34)
      spec.kopstaart = {
        dKop,
        gootK: Math.min(goot + 1.1, regels.gootMax + 1.1),
        nokK: Math.min(nok + 1.2, regels.nokMax),
        krimp: .82, // staart smaller en lager
      }
    }
    if (massaWens === 'dwarskap') {
      const b2 = Math.max(3.6, b * .62)
      spec.dwars = {
        b2,
        d2: Math.max(3.4, b * .55) + b / 2,
        goot2: Math.max(2.2, goot * .85),
        nok2: Math.max(3.4, nok * .72),
        z: -d / 2 + d * (.3 + r() * .25),
      }
      // zoals in referentie 4: het dwarsvolume krijgt de pui,
      // de hoofdkopgevel wordt dicht met kaders, ramen en deur
      spec.kopPui = false
      spec.kop.kaderKleur = donker(spec.gevel) ? KLEUREN.houtBlank : KLEUREN.houtWarm
      spec.gevel2 = donker(spec.gevel) ? KLEUREN.stucLicht : KLEUREN.felsBlauwgrijs
    }
    if (massaWens === 'asym') {
      spec.nokOffset = (r() < .5 ? -1 : 1) * b * (.1 + r() * .15)
    }
    if (massaWens === 'stapel') {
      spec.plat = true; spec.helling = 0
      spec.nok = Math.min(6.4, Math.max(regels.nokMax, 6.2))
      spec.goot = spec.nok
      const onderH = 3.0, bovenH = spec.nok - onderH
      const richting = kies(r, ['voor', 'zij', 'terug'])
      const st = {
        onder: { b, d, h: onderH, kleur: donker(spec.gevel) ? KLEUREN.wit : spec.gevel },
        boven: { b, d, h: bovenH, kleur: spec.gevel },
        glasband: { y0: onderH + .3, y1: spec.nok - .5 },
      }
      if (richting === 'voor') st.boven.z = d * .18
      if (richting === 'zij') {
        st.boven.x = -b * .26
        st.kolommen = [{ x: -b * .26 - b / 2 + .4, z: d * .34 }]
      }
      if (richting === 'terug') {
        st.boven = { ...st.boven, d: d * .78, z: -d * .1 }
        spec.balustrades = [{ x: 0, y: onderH + .1, z: d / 2 - .3, w: b - .6 }]
        if (r() < .5) spec.pergola = { x: 0, y: spec.nok + .25, b: b + .5, d: d * .4, z: d * .3, stap: .5 }
      }
      if (r() < .5) st.glasbandOnder = { y0: .25, y1: onderH - .3 }
      else if (richting !== 'zij') spec.glasPanelen = [{ vlak: 'kop', x: b * .05, y: 1.55, w: b * .6, h: 2.5, z: d / 2 + (st.onder.z || 0) + .06, stijlen: 4 }]
      spec.stapel = st
    }
  }
  spec.zinnen.push(MASSAS[spec.massa].zin)

  // dominant kopgevel-thema: er wordt er precies een gekozen
  if (spec.massa === 'dwarskap') {
    spec.kopThema = 'dwarsPui'
    spec.zinnen.push('de glazen kopgevel in het dwarsvolume, de hoofdgevel dicht met kaders en ramen')
  } else {
    const kandidaten = Object.entries(KOPTHEMAS)
      .filter(([, def]) => def.kan(spec, prog))
      .map(([naam, def]) => [naam, def.gewicht])
    spec.kopThema = kiesGewogen(r, kandidaten)
    const thema = KOPTHEMAS[spec.kopThema]
    if (spec.kopThema === 'puiKader') {
      spec.kop.kader = true
      spec.kop.kaderKleur = donker(spec.gevel) ? KLEUREN.houtBlank : KLEUREN.houtZwart
      spec.kop.puiFactor = .78
    }
    if (spec.kopThema === 'puiLamellen') spec.kop.lamellen = true
    if (spec.kopThema === 'puiPenanten') {
      spec.kop.penanten = { n: 3, breedte: .5, kleur: KLEUREN.houtWarm, hMax: spec.goot + .3 }
      spec.kop.puiFactor = .82
    }
    if (spec.kopThema === 'portaal') {
      const uit = .5 + r() * 1.8
      spec.portaal = { uit, kleur: donker(spec.gevel) ? KLEUREN.houtBlank : KLEUREN.wit }
      if (uit > 1.2) spec.veranda = { diepte: uit, kolommen: 0 }
      spec.kop.puiFactor = .8
    }
    if (spec.kopThema === 'lamellenVeld') {
      spec.lamellenVelden = [{ x: 0, y0: spec.goot * .5, y1: spec.goot - .8, w: b * .8, uit: .3 }]
      spec.kop.puiFactor = .8
    }
    spec.zinnen.push(thema.zin)
  }
  spec.zinnen.push(STRAMIENEN[spec.kop.stramien].zin)

  // secundaire laag: een of twee elementen, gedoseerd en zonder conflicten
  const aantal = 1 + (r() < .45 ? 1 : 0)
  const volgorde = schud(r, Object.entries(SECUNDAIR).map(([naam, def]) => [naam, def.gewicht]))
  const gekozen = []
  for (const [naam] of volgorde) {
    if (gekozen.length >= aantal) break
    const el = SECUNDAIR[naam]
    if (!el.kan(spec, prog)) continue
    if (gekozen.some(g => SECUNDAIR[g].sluit.includes(naam) || el.sluit.includes(g))) continue
    gekozen.push(naam)
  }
  spec.secundair = gekozen
  for (const naam of gekozen) {
    if (naam === 'veranda') spec.veranda = { diepte: 2.2 + r() * 1.2, kolommen: 2 + (r() < .4 ? 1 : 0) }
    else if (naam === 'zijLuifel') spec.zijLuifel = { kant: r() < .5 ? -1 : 1, uit: 1.6 + r() * .8, wandKleur: donker(spec.gevel) ? KLEUREN.houtBlank : KLEUREN.houtZwart }
    else if (naam === 'aanbouw') spec.aanbouwen = [{ x: -(b / 2 + 2.3), z: d * .26, b: 3.6, d: 5, h: Math.min(2.9, Math.max(2.5, spec.goot * .9)), kleur: spec.gevel2 || spec.gevel, dakUitX: 2.2, deur: true }]
    else if (naam === 'plint') spec.plint = { h: Math.min(3, spec.goot * .92), kleur: donker(spec.gevel) ? KLEUREN.houtBlank : KLEUREN.houtZwart }
    else if (naam === 'dakOpbouw') spec.dakOpbouw = { b: 2.2, d: 2.4, h: 1.1, x: -b * .22, z: -d * .25 }
    else if (naam === 'lamellenEntree') spec.lamellenVelden = [...(spec.lamellenVelden || []), { x: -b * .22, y0: 3.3, y1: Math.min(5.1, spec.nok - .8), w: 2.2, uit: .12 }]
    else if (naam === 'erker') { spec.elementen.push('hoekpui'); spec.hoekpuiKant = r() < .5 ? -1 : 1 }
    else if (naam === 'bijgebouw') spec.elementen.push('bijgebouw')
    else spec.elementen.push(naam) // balkon, dakramen, dakkapel, schoorsteen, entreeKader, entreeLuifel
    spec.zinnen.push(SECUNDAIR[naam].zin)
  }

  spec.naam = t.naam + (spec.massa !== 'enkel' ? ' · ' + MASSAS[spec.massa].naam : '')
  spec.beschrijving = maakBeschrijving(spec)
  return spec
}

// Deterministische spec uit expliciete parameters, voor de
// kalibratiepresets (interne nabouwsels van de referenties). Deze specs
// verschijnen nooit als klantvariant; ze kalibreren en testen de renderer.
export function bouwSpec(p) {
  const t = TYPOLOGIEEN.find(x => x.id === p.typologie) || TYPOLOGIEEN[0]
  const kleur = k => KLEUREN[k] || k
  const plat = !!p.plat
  const b = p.b, d = p.d, goot = p.goot
  const helling = plat ? 0 : (p.helling ?? 48)
  const nok = plat ? goot : (p.nok ?? goot + Math.tan(grad(helling)) * (b / 2 - Math.abs(p.nokOffset || 0)) )
  const spec = {
    id: 'kal-' + (p.id || t.id), typologie: t,
    lagen: p.lagen ?? 1, past: true, plat,
    b, d, goot, nok, helling: Math.round(helling),
    overstek: p.overstek ?? t.overstek,
    voet: Math.round(b * d), opp: Math.round(b * d),
    stramienN: p.stramienN ?? Math.max(2, Math.round(d / 2.6)),
    gevel: kleur(p.gevel || t.gevels[0]),
    dak: kleur(p.dak || t.daken[0]),
    gevel2: p.gevel2 ? kleur(p.gevel2) : null,
    massa: p.massa || 'enkel',
    nokOffset: p.nokOffset || 0,
    dakDikte: p.dakDikte,
    kop: {
      stramien: p.stramien || 'stroken',
      kader: !!p.kader, kaderKleur: p.kader && p.kader.kleur ? kleur(p.kader.kleur) : null,
      lamellen: !!p.lamellen,
      puiFactor: p.puiFactor,
      puiX: p.puiX || 0,
      penanten: p.penanten ? { ...p.penanten, kleur: kleur(p.penanten.kleur || 'houtWarm') } : null,
    },
    dakraamKant: p.dakraamKant,
    panelen: p.panelen ? p.panelen.map(x => ({ ...x, kleur: kleur(x.kleur) })) : null,
    portaal: p.portaal ? { ...p.portaal, kleur: kleur(p.portaal.kleur || 'wit') } : null,
    zijLuifel: p.zijLuifel ? { ...p.zijLuifel, wandKleur: kleur(p.zijLuifel.wandKleur || 'houtZwart') } : null,
    plint: p.plint ? { ...p.plint, kleur: kleur(p.plint.kleur) } : null,
    stapel: p.stapel ? {
      ...p.stapel,
      onder: { ...p.stapel.onder, kleur: p.stapel.onder.kleur ? kleur(p.stapel.onder.kleur) : null },
      boven: { ...p.stapel.boven, kleur: p.stapel.boven.kleur ? kleur(p.stapel.boven.kleur) : null },
    } : null,
    glasPanelen: p.glasPanelen || null,
    pergola: p.pergola || null,
    balustrades: p.balustrades || null,
    lamellenVelden: p.lamellenVelden ? p.lamellenVelden.map(x => ({ ...x, kleur: kleur(x.kleur || 'houtBlank') })) : null,
    dakOpbouw: p.dakOpbouw ? { ...p.dakOpbouw, kleur: p.dakOpbouw.kleur ? kleur(p.dakOpbouw.kleur) : null } : null,
    aanbouwen: p.aanbouwen ? p.aanbouwen.map(x => ({ ...x, kleur: x.kleur ? kleur(x.kleur) : null })) : null,
    kopstaart: p.kopstaart, dwars: p.dwars, zwevend: p.zwevend,
    veranda: p.veranda,
    kopPui: p.kopPui,
    hoekpuiKant: p.hoekpuiKant,
    elementen: p.elementen || [],
    naam: p.naam || t.naam,
    beschrijving: p.beschrijving || '',
    zinnen: [],
  }
  // ook presets gaan door de geometrie-reparatie (clippen, klemmen)
  if (!p.ruw && valideerSpec(spec).length) repareerSpec(spec)
  return spec
}

function maakBeschrijving(spec) {
  const [massa, kopthema, , ...rest] = spec.zinnen
  let zin = spec.typologie.kern.charAt(0).toUpperCase() + spec.typologie.kern.slice(1)
    + ', als ' + massa + '. '
  zin += kopthema.charAt(0).toUpperCase() + kopthema.slice(1)
  if (rest.length) zin += ', met ' + rest.join(' en ') + '.'
  else zin += '.'
  return zin
}
