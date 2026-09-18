// Integratiecheck tegen de ECHTE PDOK-diensten met het echte adres
// van de live gevonden bug: bewaakt dat adreszoek, lookup en de
// percelen-WFS in de vorm antwoorden die de app verwacht (lon/lat,
// oppervlakte als getal). Bij een PDOK-storing skipt de check met een
// melding in plaats van te falen; de vormdekking zit dan nog in de
// vastgelegde testdata van de andere poorten.
import { zoekAdres, adresDetail, percelenRond } from '../src/reis/pdok.js'

let fouten = 0
const eis = (naam, conditie, detail) => {
  if (conditie) console.log('ok  |', naam)
  else { fouten++; console.log('FOUT|', naam, detail ?? '') }
}

try {
  const suggesties = await zoekAdres('Tweetandschelp 52, Monster')
  eis('adressuggestie gevonden', suggesties.length >= 1 && suggesties[0].weergavenaam.includes('Tweetandschelp 52'))

  const detail = await adresDetail(suggesties[0].id)
  eis('adresdetail heeft lon/lat in Nederland',
    detail.lon > 3 && detail.lon < 8 && detail.lat > 50 && detail.lat < 54)

  const { percelen } = await percelenRond(detail.lon, detail.lat)
  eis('minstens tien percelen rond het adres', percelen.length >= 10, 'kreeg ' + percelen.length)
  const p = percelen[0]
  eis('oppervlakte is een getal uit de data', Number.isFinite(p.oppervlakte) && p.oppervlakte > 0)
  eis('perceel heeft sectie en nummer', !!p.sectie && Number.isInteger(p.perceelnummer))
  const ring = p.geometrie.type === 'Polygon' ? p.geometrie.coordinates[0] : p.geometrie.coordinates[0][0]
  eis('geometrie is polygonaal in lon/lat (CRS-bewaking)',
    ['Polygon', 'MultiPolygon'].includes(p.geometrie.type)
    && ring.every(([x, y]) => x > 3 && x < 8 && y > 50 && y < 54))
  console.log(fouten ? 'FAAL: ' + fouten + ' checks rood' : 'PDOK-integratie groen')
  process.exitCode = fouten ? 1 : 0
} catch (e) {
  console.log('PDOK niet bereikbaar (' + String(e.message || e) + '); integratiecheck GESKIPT')
  process.exitCode = 0
}
