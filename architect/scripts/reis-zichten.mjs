// Playwright-controle van /reis (stap 0): sessie via de echte API,
// begroeting met ondertiteling, keuzeknoppen die de function-call-laag
// gebruiken, voortgang naar stap 1, hervatten via de deellink, en de
// nette tekst-fallback; desktop en mobiel.
import { chromium } from 'playwright'
import fs from 'fs'

const BASIS = process.env.URL || 'http://localhost:4173'
const UIT = 'schermen/reis'
fs.mkdirSync(UIT, { recursive: true })

const browser = await chromium.launch()
const fouten = []

const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('console', m => { if (m.type() === 'error') fouten.push('desktop: ' + m.text()) })
page.on('pageerror', e => fouten.push('desktop: ' + String(e)))
await page.goto(BASIS + '/reis')
await page.waitForSelector('.gesprek', { timeout: 20000 })
await page.waitForFunction(() => document.querySelectorAll('.beurt-architect').length >= 1, { timeout: 20000 })
const begroeting = await page.evaluate(() => document.querySelector('.beurt-architect').textContent)
console.log('begroeting:', begroeting.includes('vier stappen') ? 'ok' : 'ONVERWACHT: ' + begroeting.slice(0, 80))
const deellink = page.url()
console.log('deellink bevat sessietoken:', /[?&]s=/.test(deellink) ? 'ok' : 'MIST')
await page.screenshot({ path: UIT + '/stap0-desktop.png' })

// keuze via de knoppen (zelfde functies als de stem zou gebruiken)
await page.click('text=Ik typ liever')
await page.waitForTimeout(2500)
const stapBadge = await page.evaluate(() => document.body.textContent.includes('Stap 1 (Smaak)'))
console.log('na keuze staat de reis op stap 1:', stapBadge ? 'ok' : 'NIET')
await page.screenshot({ path: UIT + '/stap1-placeholder.png' })

// tekstinvoer: zonder taalmodel-sleutel hoort een nette melding te komen
await page.fill('.invoerbalk input', 'wat kunnen jullie bouwen?')
await page.click('text=Verstuur')
await page.waitForTimeout(4000)
const nette = await page.evaluate(() => document.body.textContent.includes('niet te bereiken')
  || document.body.textContent.includes('spreektijd')
  || document.querySelectorAll('.beurt-architect').length >= 3)
console.log('tekstkanaal antwoordt of meldt netjes:', nette ? 'ok' : 'NIET')

// hervatten via de deellink in een verse pagina
const page2 = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page2.on('pageerror', e => fouten.push('hervat: ' + String(e)))
await page2.goto(deellink)
await page2.waitForFunction(() => document.body.textContent.includes('Welkom terug'), { timeout: 20000 })
console.log('hervatten via deellink: ok')
await page2.screenshot({ path: UIT + '/hervat.png' })

// mobiel
const mob = await browser.newPage({ viewport: { width: 390, height: 844 } })
mob.on('pageerror', e => fouten.push('mobiel: ' + String(e)))
await mob.goto(BASIS + '/reis')
await mob.waitForSelector('.gesprek', { timeout: 20000 })
await mob.waitForTimeout(2000)
await mob.screenshot({ path: UIT + '/stap0-mobiel.png' })
console.log('mobiel geladen')

console.log(fouten.length ? 'FOUTEN:\n' + fouten.slice(0, 6).join('\n') : 'console leeg')
await browser.close()
