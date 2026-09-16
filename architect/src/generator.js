import { STAEL, KLEUREN, MASSAS, STRAMIENEN, ELEMENTEN, typologieenVoor } from './ontwerptaal.js'

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
function schud(r, lijst) {
  const l = [...lijst]
  for (let i = l.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1)); [l[i], l[j]] = [l[j], l[i]]
  }
  return l
}

export function genereerVarianten(prog, ronde = 0) {
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
  while (lijst.length < doel && poging < volgorde.length * 3) {
    const { t, m } = volgorde[i % volgorde.length]
    const v = maakVariant(t, m, prog, basis + poging * 31 + i * 7)
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
    }
    if (massaWens === 'asym') {
      spec.nokOffset = (r() < .5 ? -1 : 1) * b * (.1 + r() * .15)
    }
    if (massaWens === 'zwevend') {
      spec.plat = true; spec.helling = 0
      spec.nok = Math.min(6.6, regels.nokMax)
      spec.goot = spec.nok
      spec.zwevend = {
        onderH: 3.0,
        overhang: Math.min(2.4, d * .22),
        onderKrimp: .72,
      }
    }
  }
  spec.zinnen.push(MASSAS[spec.massa].zin)

  // kop-stijl en stramien
  spec.zinnen.push(STRAMIENEN[spec.kop.stramien].zin)

  // creatieve laag: 2 tot 4 elementen, gedoseerd en alleen waar logisch
  const aantal = 2 + Math.floor(r() * 3)
  const kandidaten = schud(r, Object.keys(ELEMENTEN))
  const gekozen = []
  for (const naam of kandidaten) {
    if (gekozen.length >= aantal) break
    const el = ELEMENTEN[naam]
    if (!el.kan(spec, prog)) continue
    if (gekozen.some(g => ELEMENTEN[g].sluit.includes(naam) || el.sluit.includes(g))) continue
    gekozen.push(naam)
  }
  spec.elementen = gekozen
  if (gekozen.includes('kader')) spec.kop.kader = true
  if (gekozen.includes('lamellen')) spec.kop.lamellen = true
  if (gekozen.includes('materiaalwissel')) {
    spec.gevel2 = spec.gevel === KLEUREN.houtZwart || spec.gevel === KLEUREN.staalZwart
      ? KLEUREN.stucLicht : KLEUREN.houtZwart
  }
  gekozen.forEach(naam => spec.zinnen.push(ELEMENTEN[naam].zin))

  spec.naam = t.naam + (spec.massa !== 'enkel' ? ' · ' + MASSAS[spec.massa].naam : '')
  spec.beschrijving = maakBeschrijving(spec)
  return spec
}

function maakBeschrijving(spec) {
  const [massa, stramien, ...rest] = spec.zinnen
  let zin = spec.typologie.kern.charAt(0).toUpperCase() + spec.typologie.kern.slice(1)
    + ', als ' + massa + '. '
  zin += stramien.charAt(0).toUpperCase() + stramien.slice(1)
  if (rest.length) zin += ', met ' + rest.join(', ') + '.'
  else zin += '.'
  return zin
}
