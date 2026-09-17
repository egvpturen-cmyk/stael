// Playwright-controle stap 2 (kavel en programma): adres zoeken, de
// kaart met perceelgrenzen, een perceel aanwijzen en kiezen, het
// programmaformulier en afronden naar stap 3; desktop en mobiel. Draait
// met de PDOK-fixture (?fixture=1) zodat de test nooit van de
// PDOK-uptime afhangt; de sessie wordt vooraf via de API naar stap 2
// gezet.
import { chromium } from 'playwright'
import fs from 'fs'

const BASIS = process.env.URL || 'http://localhost:4173'
const API = process.env.API_BASIS || 'https://api-production-4d7f4.up.railway.app'
const UIT = 'schermen/reis'
fs.mkdirSync(UIT, { recursive: true })

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

async function doorloop(page, naam, { volledig }) {
  page.on('console', m => { if (m.type() === 'error' && !m.text().includes('503')) fouten.push(naam + ': ' + m.text()) })
  page.on('pageerror', e => fouten.push(naam + ': ' + String(e)))
  const token = await sessieOpStap2()
  await page.goto(BASIS + '/reis?s=' + token + '&fixture=1')
  await page.waitForSelector('.kavelzoek input', { timeout: 20000 })

  await page.fill('.kavelzoek input', 'Molenstraat 1, Naaldwijk')
  await page.click('text=Zoek adres')
  await page.waitForSelector('.kavelkaart .leaflet-interactive', { timeout: 15000 })
  const percelen = await page.evaluate(() => document.querySelectorAll('.kavelkaart .leaflet-interactive').length)
  console.log(naam + ' perceelvlakken op de kaart:', percelen === 3 ? 'ok (3)' : 'ONVERWACHT ' + percelen)
  await page.waitForTimeout(600)
  await page.screenshot({ path: UIT + '/stap2-' + naam + '-kaart.png' })

  // middelste perceel aanwijzen en kiezen
  await page.click('.kavelkaart .leaflet-interactive >> nth=0')
  await page.waitForSelector('.perceelinfo', { timeout: 10000 })
  const opp = await page.evaluate(() => document.querySelector('.perceelinfo').textContent)
  console.log(naam + ' oppervlakte uit kadastrale data:', opp.includes('270 m') ? 'ok (270 m2)' : 'ONVERWACHT: ' + opp)
  await page.click('text=Dit is mijn perceel')
  await page.waitForSelector('.programmaform', { timeout: 10000 })

  if (volledig) {
    // programma invullen en afronden naar stap 3
    const velden = ['180', '2', '4', '2']
    const inputs = await page.$$('.programmaform input')
    for (let i = 0; i < velden.length; i++) await inputs[i].fill(velden[i])
    await inputs[4].fill('leefkeuken')
    await page.fill('.programmaform textarea', 'werkplek aan de tuinzijde')
    await page.waitForTimeout(400)
    await page.screenshot({ path: UIT + '/stap2-' + naam + '-programma.png' })
    await page.click('text=Kavel en programma afronden')
    await page.waitForFunction(() => document.body.textContent.includes('Stap 3 (Modellen)'), { timeout: 15000 })
    console.log(naam + ' afronden brengt de reis naar stap 3: ok')

    // hervatten: kavel en kaart blijven staan
    const page2 = await browser.newPage({ viewport: page.viewportSize() })
    await page2.goto(BASIS + '/reis?s=' + token + '&fixture=1')
    await page2.waitForFunction(() => document.body.textContent.includes('Stap 3 (Modellen)'), { timeout: 20000 })
    console.log(naam + ' hervatten op stap 3 met sessie intact: ok')
    await page2.close()
  } else {
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
