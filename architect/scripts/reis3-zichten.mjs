// Playwright-controle van de VOLLEDIGE reis tot en met stap 3: smaak
// kiezen in de show, kavel en programma (PDOK gemockt in live-vorm),
// vijf smaakgestuurde modellen zien, een variant kiezen, aanpassen via
// de functielaag en hervatten; desktop volledig, mobiel de modellenstap
// met overflowcontrole.
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
const TEGEL = Buffer.from('/9j/4AAQSkZJRgABAQEAYABgAAD/2wBDAAgGBgcGBQgHBwcJCQgKDBQNDAsLDBkSEw8UHRofHh0aHBwgJC4nICIsIxwcKDcpLDAxNDQ0Hyc5PTgyPC4zNDL/wAALCAABAAEBAREA/8QAFAABAAAAAAAAAAAAAAAAAAAACf/EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAD8AKp//2Q==', 'base64')

const browser = await chromium.launch()
// door het startscherm: een klik slaat de intro over, daarna de knop
async function voorbijStart(pagina) {
  await pagina.waitForSelector('.introscherm', { timeout: 15000 })
  await pagina.mouse.click(30, 30)
  await pagina.click('.startknop', { timeout: 15000 })
  await pagina.waitForTimeout(400)
}

const fouten = []

async function mock(page) {
  await page.route('**/locatieserver/search/v3_1/suggest**', r =>
    r.fulfill({ contentType: 'application/json', body: lees('locatieserver-suggest.json') }))
  await page.route('**/locatieserver/search/v3_1/lookup**', r =>
    r.fulfill({ contentType: 'application/json', body: lees('locatieserver-lookup.json') }))
  await page.route('**/kadastralekaart/wfs/**', r =>
    r.fulfill({ contentType: 'application/json', body: lees('wfs-percelen.json') }))
  await page.route('**/luchtfotorgb/**', r => r.fulfill({ contentType: 'image/jpeg', body: TEGEL }))
}

// ---- desktop: de hele reis van welkom tot aangepast model ----
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('503')) fouten.push('desktop: ' + m.text()) })
page.on('pageerror', e => fouten.push('desktop: ' + String(e)))
await mock(page)

await page.goto(BASIS + '/reis')
  await voorbijStart(page)
await page.waitForSelector('.podium', { timeout: 20000 })
// de entree kent geen kanaalkeuze meer; door naar stap 1 via de
// sessie (de gespreksbevestiging is in gesprekstest 0 gedekt)
const startToken = new URL(page.url()).searchParams.get('s')
await fetch(API + '/api/sessies/' + startToken, {
  method: 'PATCH', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ stap: 1, spraakOk: false }),
})
await page.reload()
await voorbijStart(page)

// stap 1: drie favorieten met een citaat
await page.waitForSelector('.showslide.actief .naam', { timeout: 20000 })
for (const nr of [3, 15, 20]) {
  await page.click('.filmstrip button[title*="(nr ' + nr + ')"]')
  await page.waitForTimeout(1100)
  await page.click('.showslide.actief .favorietknop')
  await page.waitForTimeout(700)
}
await page.fill('.showslide.actief .citaatrij input', 'dat roest en die kolossale overstek')
await page.click('.showslide.actief .citaatrij button')
await page.waitForTimeout(700)
await page.click('text=Smaak afronden')
await page.waitForSelector('.kavelzoek input', { timeout: 15000 })
console.log('stap 1 afgerond met drie favorieten: ok')

// stap 2: kavel en programma
await page.fill('.kavelzoek input', 'Tweetandschelp 52, Monster')
await page.click('text=Zoek adres')
await page.waitForSelector('.kavelkaart .leaflet-interactive', { timeout: 15000 })
await page.waitForTimeout(800)
const binnen = await page.evaluate(() => {
  const el = [...document.querySelectorAll('.kavelkaart path.leaflet-interactive')]
    .find(p => p.getAttribute('stroke')?.toLowerCase() === '#e8b48c')
  const r = el.getBoundingClientRect()
  for (let fy = .1; fy < 1; fy += .12) {
    for (let fx = .1; fx < 1; fx += .12) {
      const x = r.x + r.width * fx, y = r.y + r.height * fy
      if (document.elementFromPoint(x, y) === el) return { x, y }
    }
  }
  return null
})
await page.mouse.click(binnen.x, binnen.y)
await page.waitForSelector('.perceelinfo', { timeout: 10000 })
await page.click('text=Dit is mijn perceel')
await page.waitForSelector('.programmaform', { timeout: 10000 })
const inputs = await page.$$('.programmaform input')
for (const [i, w] of [['180'], ['2'], ['4'], ['2']].entries()) await inputs[i].fill(w[0])
await inputs[4].fill('leefkeuken')
await page.click('text=Kavel en programma afronden')
console.log('stap 2 afgerond: ok')

// stap 3: vijf smaakgestuurde modellen
await page.waitForSelector('.reisvariant', { timeout: 40000 })
await page.waitForTimeout(2500)
const kaarten = await page.evaluate(() => document.querySelectorAll('.reisvariant').length)
console.log('modellen gegenereerd:', kaarten === 5 ? 'ok (5)' : 'ONVERWACHT ' + kaarten)
const zinnen = await page.evaluate(() => [...document.querySelectorAll('.smaakzin')].map(z => z.textContent))
console.log('smaakzinnen verwijzen naar het profiel:',
  zinnen.some(z => z.includes('ERTS') || z.includes('corten') || z.includes('overstek')) ? 'ok' : 'ONVERWACHT: ' + zinnen[0])
await page.screenshot({ path: UIT + '/stap3-set.png' })

// kiezen en aanpassen via de functielaag
await page.click('.reisvariant >> nth=0 >> text=Kies deze')
await page.waitForSelector('.gekozenvak', { timeout: 10000 })
const gootVoor = await page.evaluate(() => document.querySelector('.gekozenvak span').textContent)
await page.click('.aanpaspaneel >> text=+ >> nth=0')
await page.waitForFunction(() => [...document.querySelectorAll('.beurt-architect')].some(b => b.textContent.includes('Aangepast: goothoogte')), null, { timeout: 10000 })
console.log('goothoogte aangepast via de functielaag: ok')
const selects = await page.$$('.aanpaspaneel select')
await selects[1].selectOption('corten')
await page.waitForFunction(() => [...document.querySelectorAll('.beurt-architect')].some(b => b.textContent.includes('gevelmateriaal')), null, { timeout: 10000 })
console.log('gevelmateriaal gewijzigd via de functielaag: ok')
await page.waitForTimeout(1500)
await page.screenshot({ path: UIT + '/stap3-aanpassen.png' })

// een onmogelijke wens wordt eerlijk geweigerd (via dezelfde poort)
const weiger = await page.evaluate(async () => {
  const knoppen = [...document.querySelectorAll('.aanpaspaneel button')]
  return knoppen.length > 0
})
// de weigering zelf is functielaag-gedrag en is in gesprekstest 3 gedekt

// hervatten midden in stap 3
const deellink = page.url()
const page2 = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page2.on('pageerror', e => fouten.push('hervat: ' + String(e)))
await mock(page2)
await page2.goto(deellink)
  await voorbijStart(page2)
await page2.waitForSelector('.gekozenvak', { timeout: 30000 })
const hervat = await page2.evaluate(() => ({
  kaarten: document.querySelectorAll('.reisvariant').length,
  wijzigingen: document.body.textContent.includes('Wijzigingen:'),
}))
console.log('hervatten midden in stap 3 met keuze en wijzigingen:',
  hervat.wijzigingen ? 'ok' : 'ONVERWACHT ' + JSON.stringify(hervat))
await page2.close()

// ---- mobiel: modellenstap rechtstreeks, overflow en bediening ----
const maak = await fetch(API + '/api/sessies', { method: 'POST' })
const { token } = await maak.json()
await fetch(API + '/api/sessies/' + token, {
  method: 'PATCH', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    stap: 3,
    smaak: { favorieten: [14, 26, 30], families: { E: 3 }, materialen: ['travertin', 'brons'], elementen: ['lamellen'], citaten: ['serene rust'] },
    programma: { woonoppervlakte: 150, verdiepingen: 1, slaapkamers: 3 },
    kavel: { oppervlakte: 900 },
  }),
})
const mob = await browser.newPage({ viewport: { width: 390, height: 844 } })
mob.on('pageerror', e => fouten.push('mobiel: ' + String(e)))
await mock(mob)
await mob.goto(BASIS + '/reis?s=' + token)
  await voorbijStart(mob)
await mob.waitForSelector('.reisvariant', { timeout: 40000 })
await mob.waitForTimeout(2500)
const mobKaarten = await mob.evaluate(() => document.querySelectorAll('.reisvariant').length)
console.log('mobiel modellen:', mobKaarten === 5 ? 'ok (5)' : 'ONVERWACHT ' + mobKaarten)
const overflow = await mob.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
console.log('mobiel horizontale overflow px:', overflow)
await mob.screenshot({ path: UIT + '/stap3-mobiel.png' })

console.log(fouten.length ? 'FOUTEN:\n' + fouten.slice(0, 6).join('\n') : 'console leeg')
await browser.close()
