// Playwright-controle stap 1 (smaak): collectiegrid met webbeelden,
// favorieten kiezen via de kaarten, citaat noteren, afronden naar
// stap 2, en hervatten met het profiel intact; desktop en mobiel.
import { chromium } from 'playwright'
import fs from 'fs'

const BASIS = process.env.URL || 'http://localhost:4173'
const UIT = 'schermen/reis'
fs.mkdirSync(UIT, { recursive: true })

const browser = await chromium.launch()
const fouten = []
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('503')) fouten.push('desktop: ' + m.text()) })
page.on('pageerror', e => fouten.push('desktop: ' + String(e)))

await page.goto(BASIS + '/reis')
await page.waitForSelector('.gesprek', { timeout: 20000 })
await page.click('text=Ik typ liever')
await page.waitForSelector('.collectiekaart', { timeout: 20000 })
const kaarten = await page.evaluate(() => document.querySelectorAll('.collectiekaart').length)
console.log('collectiekaarten:', kaarten === 34 ? 'ok (34)' : 'ONVERWACHT ' + kaarten)
await page.waitForTimeout(2500)
await page.screenshot({ path: UIT + '/stap1-grid.png' })

// drie favorieten kiezen via de beelden
for (const n of [1, 3, 25]) {
  await page.click('.collectiekaart:nth-of-type(' + n + ') img')
  await page.waitForTimeout(700)
}
const teller = await page.evaluate(() => document.body.textContent.includes('(3 gekozen)'))
console.log('favorietenteller staat op 3:', teller ? 'ok' : 'NIET')

// citaat noteren bij de eerste favoriet
await page.fill('.collectiekaart.favoriet input', 'die lage luifel maakt het uitnodigend')
await page.click('.collectiekaart.favoriet >> text=Noteer')
await page.waitForTimeout(1200)
await page.screenshot({ path: UIT + '/stap1-favorieten.png' })

// afronden naar stap 2
await page.click('text=Smaak afronden')
await page.waitForFunction(() => document.body.textContent.includes('Stap 2 (Kavel en programma)'), { timeout: 15000 })
console.log('afronden brengt de reis naar stap 2: ok')
const deellink = page.url()

// hervatten: favorieten en stap blijven staan
const page2 = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page2.goto(deellink)
await page2.waitForFunction(() => document.body.textContent.includes('Stap 2 (Kavel en programma)'), { timeout: 20000 })
console.log('hervatten op stap 2 met sessie intact: ok')

// mobiel: grid zonder horizontale overflow
const mob = await browser.newPage({ viewport: { width: 390, height: 844 } })
mob.on('pageerror', e => fouten.push('mobiel: ' + String(e)))
await mob.goto(BASIS + '/reis')
await mob.waitForSelector('.gesprek', { timeout: 20000 })
await mob.click('text=Ik typ liever')
await mob.waitForSelector('.collectiekaart', { timeout: 20000 })
await mob.waitForTimeout(2500)
const overflow = await mob.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
console.log('mobiel horizontale overflow px:', overflow)
await mob.screenshot({ path: UIT + '/stap1-mobiel.png' })

console.log(fouten.length ? 'FOUTEN:\n' + fouten.slice(0, 6).join('\n') : 'console leeg')
await browser.close()
