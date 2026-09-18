// PDOK-koppeling voor stap 2 (kavel): adres zoeken via de
// Locatieserver, kadastrale percelen via de kadastralekaart-WFS en de
// luchtfoto als tilelaag. Alles genormaliseerd naar een eigen
// perceelvorm zodat de rest van de app geen PDOK-details kent. De
// fixture-modus levert een echte, vastgelegde WFS-respons (exact de
// live-vorm, rond Tweetandschelp 52 in Monster) die door dezelfde
// normalisatie loopt als productie, zodat tests nooit van de
// PDOK-uptime afhangen maar wel de echte responsvorm dekken.
// Puur JavaScript zonder React.
import WFS_TESTDATA from './pdok-testdata.js'

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

// De ene normalisatie van een WFS-FeatureCollection naar percelen:
// id, sectie, perceelnummer, gemeente, oppervlakte
// (kadastraleGrootteWaarde in m2, uit de data, nooit berekend) en de
// geometrie in lon/lat. Fixture en productie lopen hier allebei door.
export function normaliseerPercelen(featureCollection) {
  return (featureCollection?.features || []).map(f => ({
    id: String(f.properties.identificatieLokaalID),
    sectie: f.properties.sectie,
    perceelnummer: f.properties.perceelnummer,
    gemeente: f.properties.kadastraleGemeenteWaarde,
    oppervlakte: f.properties.kadastraleGrootteWaarde,
    geometrie: f.geometry,
  })).filter(p => p.geometrie && Number.isFinite(p.oppervlakte))
}

export const ZOEKSTRAAL_M = 220

// Het zoekgebied rond een adres als Leaflet-bounds: binnen dit kader
// is elk stuk kaart gedekt door de geladen percelen, dus hierop mag
// het kaartbeeld veilig scherpstellen.
export function zoekGebied(lon, lat, meters = ZOEKSTRAAL_M) {
  const dLat = meters / 111320
  const dLon = meters / (111320 * Math.cos(lat * Math.PI / 180))
  return [[lat - dLat, lon - dLon], [lat + dLat, lon + dLon]]
}

// Kadastrale percelen rond een punt.
export async function percelenRond(lon, lat, meters = ZOEKSTRAAL_M) {
  if (fixture) return { percelen: normaliseerPercelen(WFS_TESTDATA) }
  const dLat = meters / 111320
  const dLon = meters / (111320 * Math.cos(lat * Math.PI / 180))
  const bbox = [lat - dLat, lon - dLon, lat + dLat, lon + dLon].join(',') + ',urn:ogc:def:crs:EPSG::4326'
  const url = PERCELEN_WFS + '?service=WFS&version=2.0.0&request=GetFeature'
    + '&typeNames=kadastralekaart:Perceel&outputFormat=application/json'
    + '&count=120&srsName=EPSG:4326&bbox=' + bbox
  const j = await haalJson(url)
  return { percelen: normaliseerPercelen(j) }
}

// --- fixture-adres: het echte middelpunt bij de vastgelegde respons ---
const FIXTURE_ADRES = {
  id: 'fixture-tweetandschelp-52',
  weergavenaam: 'Tweetandschelp 52, 2681DM Monster',
  lon: 4.1608659,
  lat: 52.02000707,
}
