// PDOK-koppeling voor stap 2 (kavel): adres zoeken via de
// Locatieserver, kadastrale percelen via de kadastralekaart-WFS en de
// luchtfoto als tilelaag. Alles genormaliseerd naar een eigen
// perceelvorm zodat de rest van de app geen PDOK-details kent. De
// fixture-modus levert een vast adres met drie percelen, zodat tests
// nooit van de PDOK-uptime afhangen. Puur JavaScript zonder React.

const LOCATIESERVER = 'https://api.pdok.nl/bzk/locatieserver/search/v3_1'
const PERCELEN_WFS = 'https://service.pdok.nl/kadaster/kadastralekaart/wfs/v5_0'

export const LUCHTFOTO = {
  url: 'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_ortho25/EPSG:3857/{z}/{x}/{y}.jpeg',
  attributie: 'Luchtfoto en percelen: PDOK / Kadaster',
  maxZoom: 19,
}

let fixture = false
export function zetPdokFixture(aan) { fixture = !!aan }
export function pdokFixtureAan() { return fixture }

async function haalJson(url) {
  const r = await fetch(url)
  if (!r.ok) throw new Error('PDOK antwoordt niet (' + r.status + ')')
  return r.json()
}

// Zoek adressen; levert maximaal vijf suggesties [{id, weergavenaam}].
export async function zoekAdres(tekst) {
  if (fixture) {
    const past = FIXTURE_ADRES.weergavenaam.toLowerCase().includes((tekst || '').trim().split(/[ ,]/)[0].toLowerCase())
    return past ? [{ id: FIXTURE_ADRES.id, weergavenaam: FIXTURE_ADRES.weergavenaam }] : []
  }
  const url = LOCATIESERVER + '/suggest?rows=5&fq=type:adres&q=' + encodeURIComponent(tekst)
  const j = await haalJson(url)
  return (j.response?.docs || []).map(d => ({ id: d.id, weergavenaam: d.weergavenaam }))
}

// Detail van een suggestie: weergavenaam plus middelpunt in lon/lat.
export async function adresDetail(id) {
  if (fixture) return { ...FIXTURE_ADRES }
  const url = LOCATIESERVER + '/lookup?fl=id,weergavenaam,centroide_ll&id=' + encodeURIComponent(id)
  const j = await haalJson(url)
  const doc = j.response?.docs?.[0]
  if (!doc) throw new Error('adres niet gevonden')
  const m = /POINT\(([\d.-]+) ([\d.-]+)\)/.exec(doc.centroide_ll || '')
  if (!m) throw new Error('adres zonder middelpunt')
  return { id: doc.id, weergavenaam: doc.weergavenaam, lon: Number(m[1]), lat: Number(m[2]) }
}

// Kadastrale percelen rond een punt, genormaliseerd: id, sectie,
// perceelnummer, gemeente, oppervlakte (kadastraleGrootteWaarde in m2,
// uit de data, nooit berekend) en de geometrie in lon/lat (CRS84).
export async function percelenRond(lon, lat, meters = 180) {
  if (fixture) return { percelen: FIXTURE_PERCELEN.map(p => ({ ...p })) }
  const dLat = meters / 111320
  const dLon = meters / (111320 * Math.cos(lat * Math.PI / 180))
  const bbox = [lat - dLat, lon - dLon, lat + dLat, lon + dLon].join(',') + ',urn:ogc:def:crs:EPSG::4326'
  const url = PERCELEN_WFS + '?service=WFS&version=2.0.0&request=GetFeature'
    + '&typeNames=kadastralekaart:Perceel&outputFormat=application/json'
    + '&count=80&srsName=EPSG:4326&bbox=' + bbox
  const j = await haalJson(url)
  const percelen = (j.features || []).map(f => ({
    id: String(f.properties.identificatieLokaalID),
    sectie: f.properties.sectie,
    perceelnummer: f.properties.perceelnummer,
    gemeente: f.properties.kadastraleGemeenteWaarde,
    oppervlakte: f.properties.kadastraleGrootteWaarde,
    geometrie: f.geometry,
  })).filter(p => p.geometrie && Number.isFinite(p.oppervlakte))
  return { percelen }
}

// --- fixture: Molenstraat 1 Naaldwijk met drie eenvoudige percelen ---

const FIXTURE_MIDDEN = { lon: 4.20604514, lat: 51.99381352 }

const FIXTURE_ADRES = {
  id: 'fixture-molenstraat-1',
  weergavenaam: 'Molenstraat 1, 2671EV Naaldwijk',
  lon: FIXTURE_MIDDEN.lon,
  lat: FIXTURE_MIDDEN.lat,
}

// rechthoekig perceel rond een middelpunt, maten in meters
function fixtureRechthoek(midLon, midLat, breedte, diepte) {
  const hw = (breedte / 2) / (111320 * Math.cos(midLat * Math.PI / 180))
  const hd = (diepte / 2) / 111320
  return {
    type: 'Polygon',
    coordinates: [[
      [midLon - hw, midLat - hd], [midLon + hw, midLat - hd],
      [midLon + hw, midLat + hd], [midLon - hw, midLat + hd],
      [midLon - hw, midLat - hd],
    ]],
  }
}

const fxLon = m => m / (111320 * Math.cos(FIXTURE_MIDDEN.lat * Math.PI / 180))

const FIXTURE_PERCELEN = [
  {
    id: 'fx-1', sectie: 'D', perceelnummer: 591, gemeente: 'Naaldwijk', oppervlakte: 270,
    geometrie: fixtureRechthoek(FIXTURE_MIDDEN.lon, FIXTURE_MIDDEN.lat, 15, 18),
  },
  {
    id: 'fx-2', sectie: 'D', perceelnummer: 592, gemeente: 'Naaldwijk', oppervlakte: 425,
    geometrie: fixtureRechthoek(FIXTURE_MIDDEN.lon - fxLon(18.5), FIXTURE_MIDDEN.lat, 20, 21.25),
  },
  {
    id: 'fx-3', sectie: 'D', perceelnummer: 593, gemeente: 'Naaldwijk', oppervlakte: 610,
    geometrie: fixtureRechthoek(FIXTURE_MIDDEN.lon + fxLon(20.5), FIXTURE_MIDDEN.lat, 24, 25.4),
  },
]
