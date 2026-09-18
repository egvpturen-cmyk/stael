// Playwright-controle stap 2 (kavel en programma): het VOLLEDIGE
// live-codepad (echte fetches, geen fixture-vlag) met de PDOK-diensten
// gemockt op netwerkniveau, in exact de vastgelegde live-responsvorm
// (scripts/testdata/, opgenomen van de echte diensten). Controleert dat
// de perceelgrenzen zichtbaar getekend en aanklikbaar zijn, de
// kadastrale oppervlakte in het infopaneel, het programmaformulier,
// afronden naar stap 3 en de klik-zonder-perceel-reactie; desktop en
// mobiel. De sessie wordt vooraf via de API naar stap 2 gezet.
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const BASIS = process.env.URL || 'http://localhost:4173'
const API = process.env.API_BASIS || 'https://api-production-4d7f4.up.railway.app'
const UIT = 'schermen/reis'
fs.mkdirSync(UIT, { recursive: true })
const hier = path.dirname(fileURLToPath(import.meta.url))
const lees = naam => fs.readFileSync(path.join(hier, 'testdata', naam), 'utf8')
const WFS = JSON.parse(lees('wfs-percelen.json'))
const PERCEEL0 = WFS.features[0].properties
// 1x1 grijze jpeg als luchtfoto-tegel, zodat de test offline van PDOK is
const TEGEL = Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64')

async function sessieOpStap2() {
  const maak = await fetch(API + '/api/sessies', { method: 'POST' })
  const { token } = await maak.json()
  await fetch(API + '/api/sessies/' + token, {
    method: 'PATCH', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ stap: 2, spraakOk: false }),
  })
  return token
}

const browser = await chromium.launch()
const fouten = []

async function mock(page) {
  await page.route('**/locatieserver/search/v3_1/suggest**', r =>
    r.fulfill({ contentType: 'application/json', body: lees('locatieserver-suggest.json') }))
  await page.route('**/locatieserver/search/v3_1/lookup**', r =>
    r.fulfill({ contentType: 'application/json', body: lees('locatieserver-lookup.json') }))
  await page.route('**/kadastralekaart/wfs/**', r =>
    r.fulfill({ contentType: 'application/json', body: lees('wfs-percelen.json') }))
  await page.route('**/luchtfotorgb/**', r =>
    r.fulfill({ contentType: 'image/jpeg', body: TEGEL }))
}

async function doorloop(page, naam, { volledig }) {
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('503')) fouten.push(naam + ': ' + m.text()) })
  page.on('pageerror', e => fouten.push(naam + ': ' + String(e)))
  await mock(page)
  const token = await sessieOpStap2()
  await page.goto(BASIS + '/reis?s=' + token)
  await page.waitForSelector('.kavelzoek input', { timeout: 20000 })

  await page.fill('.kavelzoek input', 'Tweetandschelp 52, Monster')
  await page.click('text=Zoek adres')
  await page.waitForSelector('.kavelkaart .leaflet-interactive', { timeout: 15000 })
  const percelen = await page.evaluate(() => document.querySelectorAll('.kavelkaart .leaflet-interactive').length)
  console.log(naam + ' perceelvlakken op de kaart:', percelen === WFS.features.length ? 'ok (' + percelen + ')' : 'ONVERWACHT ' + percelen)

  // de grenzen zijn koperkleurig getekend, dus zichtbaar op luchtfoto,
  // en het perceel onder de adresmarker licht feller op
  const kleuren = await page.evaluate(() =>
    [...document.querySelectorAll('.kavelkaart path.leaflet-interactive')]
      .map(p => p.getAttribute('stroke')?.toLowerCase()))
  console.log(naam + ' perceelgrenzen in koper getekend:',
    kleuren.every(k => k === '#c98a5e' || k === '#e8b48c') ? 'ok' : 'NIET')
  console.log(naam + ' thuisperceel licht op voor het klikken:',
    kleuren.filter(k => k === '#e8b48c').length === 1 ? 'ok' : 'NIET (' + kleuren.filter(k => k === '#e8b48c').length + ')')
  await page.waitForTimeout(600)
  await page.screenshot({ path: UIT + '/stap2-' + naam + '-kaart.png' })

  // klik naast alle percelen krijgt altijd een reactie
  await page.mouse.click((await page.locator('.kavelkaart').boundingBox()).x + 8,
    (await page.locator('.kavelkaart').boundingBox()).y + 8)
  const geenPerceel = await page.waitForFunction(() =>
    document.body.textContent.includes('Hier vind ik geen perceel'), null, { timeout: 8000 }).then(() => true).catch(() => false)
  console.log(naam + ' klik zonder perceel geeft reactie:', geenPerceel ? 'ok' : 'NIET')

  // het eerste vastgelegde perceel gericht aanwijzen en kiezen: een
  // echte muisklik op een punt dat volgens de hit-test binnen het
  // (soms smalle, langgerekte) perceelvlak ligt
  const binnen = await page.evaluate(id => {
    const el = document.querySelector('.kavelkaart path[data-perceel="' + id + '"]')
    if (!el) return null
    const r = el.getBoundingClientRect()
    for (let fy = .08; fy < 1; fy += .12) {
      for (let fx = .08; fx < 1; fx += .12) {
        const x = r.x + r.width * fx, y = r.y + r.height * fy
        if (document.elementFromPoint(x, y) === el) return { x, y }
      }
    }
    return null
  }, PERCEEL0.identificatieLokaalID)
  if (!binnen) { fouten.push(naam + ': geen klikbaar binnenpunt op het doelperceel'); return }
  await page.mouse.click(binnen.x, binnen.y)
  await page.waitForSelector('.perceelinfo', { timeout: 10000 })
  const opp = await page.evaluate(() => document.querySelector('.perceelinfo').textContent)
  console.log(naam + ' oppervlakte uit kadastrale data:',
    opp.includes(PERCEEL0.kadastraleGrootteWaarde + ' m') ? 'ok (' + PERCEEL0.kadastraleGrootteWaarde + ' m2)' : 'ONVERWACHT: ' + opp)
  await page.click('text=Dit is mijn perceel')
  await page.waitForSelector('.programmaform', { timeout: 10000 })

  // teken-interactie: hoekpunten klikken, oppervlakte live, verslepen
  await page.click('text=Kavel zelf intekenen')
  await page.waitForSelector('.tekenpaneel', { timeout: 8000 })
  // de kaart in beeld zetten (op mobiel ligt hij na de gespreks-scroll
  // onder de vouw) en pas meten als het beeld stilstaat
  await page.waitForTimeout(800)
  await page.evaluate(() => document.querySelector('.kavelkaart').scrollIntoView({ block: 'center' }))
  await page.waitForTimeout(400)
  const kaartBox = await page.locator('.kavelkaart').boundingBox()
  const cx = kaartBox.x + kaartBox.width / 2, cy = kaartBox.y + kaartBox.height / 2
  for (const [dx, dy] of [[-50, -40], [50, -40], [50, 40], [-50, 40]]) {
    await page.mouse.click(cx + dx, cy + dy)
    await page.waitForTimeout(250)
  }
  const opp1 = await page.evaluate(() => Number(document.querySelector('.tekenopp')?.textContent.replace(/\D/g, '')))
  console.log(naam + ' oppervlakte live bij vier hoekpunten:', opp1 > 0 ? 'ok (' + opp1 + ' m2)' : 'NIET')
  // een hoekpunt verslepen verandert de oppervlakte
  const punt = await page.locator('.tekenpunt').last().boundingBox()
  await page.mouse.move(punt.x + 7, punt.y + 7)
  await page.mouse.down()
  await page.mouse.move(punt.x - 33, punt.y + 7, { steps: 6 })
  await page.mouse.up()
  await page.waitForTimeout(300)
  const opp2 = await page.evaluate(() => Number(document.querySelector('.tekenopp')?.textContent.replace(/\D/g, '')))
  console.log(naam + ' verslepen verandert de oppervlakte:', opp2 > 0 && opp2 !== opp1 ? 'ok (' + opp1 + ' naar ' + opp2 + ')' : 'NIET (' + opp1 + '/' + opp2 + ')')
  await page.screenshot({ path: UIT + '/stap2-' + naam + '-tekenen.png' })

  if (volledig) {
    await page.click('text=Vlak sluiten en gebruiken')
    await page.waitForFunction(() => document.body.textContent.includes('Zelf ingetekende kavel'), { timeout: 8000 })
    const kv = (await (await fetch(API + '/api/sessies/' + token)).json()).sessie.kavel
    console.log(naam + ' ingetekende kavel in sessie:',
      kv?.herkomst === 'zelf ingetekend' && kv?.oppervlakte === opp2 ? 'ok (' + kv.oppervlakte + ' m2)' : 'ONVERWACHT ' + JSON.stringify({ herkomst: kv?.herkomst, opp: kv?.oppervlakte }))

    const velden = ['180', '2', '4', '2']
    const inputs = await page.$$('.programmaform input')
    for (let i = 0; i < velden.length; i++) await inputs[i].fill(velden[i])
    await inputs[4].fill('leefkeuken')
    await page.fill('.programmaform textarea', 'werkplek aan de tuinzijde')
    await page.waitForTimeout(400)
    await page.screenshot({ path: UIT + '/stap2-' + naam + '-programma.png' })
    await page.click('text=Kavel en programma afronden')
    await page.waitForFunction(() => document.body.textContent.includes('Stap 3 (Modellen)'), { timeout: 15000 })
    console.log(naam + ' afronden met ingetekende kavel brengt de reis naar stap 3: ok')

    const page2 = await browser.newPage({ viewport: page.viewportSize() })
    await mock(page2)
    await page2.goto(BASIS + '/reis?s=' + token)
    await page2.waitForFunction(() => document.body.textContent.includes('Stap 3 (Modellen)'), { timeout: 20000 })
    console.log(naam + ' hervatten op stap 3 met sessie intact: ok')
    await page2.close()
  } else {
    // mobiel: annuleren ruimt de tekening op en het perceelpaneel keert terug
    await page.click('text=Annuleren')
    await page.waitForSelector('.perceelinfo', { timeout: 8000 })
    const restPunten = await page.evaluate(() => document.querySelectorAll('.tekenpunt').length)
    console.log(naam + ' annuleren ruimt de tekening op:', restPunten === 0 ? 'ok' : 'NIET (' + restPunten + ')')
    await page.waitForTimeout(400)
    await page.screenshot({ path: UIT + '/stap2-' + naam + '-programma.png' })
  }

  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  console.log(naam + ' horizontale overflow px:', overflow)
}

const desktop = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await doorloop(desktop, 'desktop', { volledig: true })

const mobiel = await browser.newPage({ viewport: { width: 390, height: 844 } })
await doorloop(mobiel, 'mobiel', { volledig: false })

console.log(fouten.length ? 'FOUTEN:\n' + fouten.slice(0, 6).join('\n') : 'console leeg')
await browser.close()
