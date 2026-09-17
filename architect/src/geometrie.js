// Gedeelde dakgeometrie: een plek voor de dakcontour en het clippen van
// elementen tegen het dakvlak, zodat renderer en validator dezelfde
// wiskunde gebruiken en niets per element hoogtes hoeft te gokken.

// hoogte van de dakrand (binnenzijde dakpakket) op gevelpositie x
export function randYOp(x, b, goot, nok, nokOffset = 0, marge = 0) {
  if (nok <= goot) return goot - marge
  const t = nokOffset
  if (x <= t) return goot + (nok - goot) * ((x + b / 2) / (t + b / 2)) - marge
  return goot + (nok - goot) * ((b / 2 - x) / (b / 2 - t)) - marge
}

// horizontaal bereik [xMin, xMax] binnen de gevelcontour op hoogte y,
// met marge naar binnen; onder de goot is dat de volle gevelbreedte
export function gevelBereik(y, b, goot, nok, nokOffset = 0, marge = .12) {
  if (nok <= goot || y <= goot) return [-b / 2 + marge, b / 2 - marge]
  if (y >= nok) return null
  const f = (y - goot) / (nok - goot)
  const xMin = -b / 2 + f * (nokOffset + b / 2) + marge
  const xMax = b / 2 - f * (b / 2 - nokOffset) - marge
  if (xMax - xMin < .05) return null
  return [xMin, xMax]
}

// clip een horizontale lat (center x, breedte) op hoogte y tegen de
// gevelcontour; geeft {x, breedte} of null als er niets overblijft
export function clipLat(x, breedte, y, prof, marge = .12) {
  const bereik = gevelBereik(y, prof.b, prof.goot, prof.nok, prof.off || 0, marge)
  if (!bereik) return null
  const van = Math.max(x - breedte / 2, bereik[0])
  const tot = Math.min(x + breedte / 2, bereik[1])
  if (tot - van < .2) return null
  return { x: (van + tot) / 2, breedte: tot - van }
}

// clip een rechthoekig gevelvlak (center x, y, breedte, hoogte) tegen de
// contour: de onderkant blijft liggen, de bovenkant wordt ingekort
export function clipVlak(x, y, w, h, prof, marge = .15) {
  const onder = y - h / 2
  const randL = randYOp(Math.max(-prof.b / 2, x - w / 2), prof.b, prof.goot, prof.nok, prof.off || 0, marge)
  const randR = randYOp(Math.min(prof.b / 2, x + w / 2), prof.b, prof.goot, prof.nok, prof.off || 0, marge)
  const top = Math.min(y + h / 2, randL, randR)
  if (top - onder < .2) return null
  return { x, y: (onder + top) / 2, w, h: top - onder }
}
