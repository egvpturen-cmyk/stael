import { STAEL, typologieenVoor } from './ontwerptaal.js'

// deterministische pseudo-random zodat dezelfde invoer dezelfde varianten geeft
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

export function genereerVarianten(prog) {
  const kandidaten = typologieenVoor(prog.dak, prog.lagen)
  const lijst = []
  kandidaten.forEach((t, i) => {
    lijst.push(maakVariant(t, prog, i * 7 + 1))
    if (i === 0) lijst.push(maakVariant(t, prog, i * 7 + 5))
  })
  return lijst
}

function maakVariant(t, prog, seed) {
  const r = rng(seed * 2654435761)
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

  // dakvorm mix: lager plat bijvolume aan de langsgevel
  const aanbouw = prog.dak === 'mix'
    ? { b: Math.max(3, b * .5), d: Math.min(d * .45, 6), h: Math.min(goot * .92, 3.0) }
    : null

  return {
    id: t.id + '-' + seed,
    typologie: t,
    seed,
    b, d, goot, nok, helling: Math.round(helling), plat, overstek: t.overstek,
    aanbouw, lagen, past,
    opp: Math.round(voet * (lagen === 2 ? factor : 1)),
    voet: Math.round(voet),
    stramien: Math.max(2, Math.round(d / (t.glas.langs === 'ritme' ? 2.3 : 3.1))),
  }
}
