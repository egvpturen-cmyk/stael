// Playwright-controle stap 1 (smaak als collectieshow): bladeren via
// pijlen, toetsenbord en filmstrip, 3 favorieten kiezen met doorvraag-
// citaat in het sessie-object, afronden naar stap 2 en hervatten
// zonder verlies; desktop en mobiel, met animatiemomenten vroeg en
// laat in beeld.
import { chromium } from 'playwright'
import fs from 'fs'

const BASIS = process.env.URL || 'http://localhost:4173'
const API = process.env.API_BASIS || 'https://api-production-4d7f4.up.railway.app'
const UIT = 'schermen/reis'
fs.mkdirSync(UIT, { recursive: true })

const browser = await chromium.launch()
const fouten = []
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
page.on('console', m => { if (m.type() === 'error' && !m.text().includes('503')) fouten.push('desktop: ' + m.text()) })
page.on('pageerror', e => fouten.push('desktop: ' + String(e)))

const naamActief = () => page.evaluate(() => document.querySelector('.showslide.actief .naam')?.textContent)

await page.goto(BASIS + '/reis')
await page.waitForSelector('.gesprek', { timeout: 20000 })
await page.click('text=Ik typ liever')
await page.waitForSelector('.smaakshow', { timeout: 20000 })
await page.waitForSelector('.showslide.actief .naam', { timeout: 10000 })
console.log('show geopend op:', await naamActief())
await page.screenshot({ path: UIT + '/stap1-show-vroeg.png' })
await page.waitForTimeout(2400)
await page.screenshot({ path: UIT + '/stap1-show-laat.png' })

// bladeren: pijlknop en toetsenbord
await page.click('.showknoppen button[aria-label="Volgende"]')
await page.waitForFunction(() => document.querySelector('.showslide.actief .naam')?.textContent === 'GLOED', { timeout: 8000 })
await page.keyboard.press('ArrowRight')
await page.waitForFunction(() => document.querySelector('.showslide.actief .naam')?.textContent === 'ERTS', { timeout: 8000 })
console.log('bladeren met pijlknop en toetsenbord: ok (GLOED, ERTS)')

// favoriet 1: ERTS, met doorvraag-citaat
await page.click('.showslide.actief .favorietknop')
await page.waitForSelector('.showslide.actief .citaatrij input', { timeout: 8000 })
await page.fill('.showslide.actief .citaatrij input', 'dat roest vind ik prachtig verweren')
await page.click('.showslide.actief .citaatrij button')
await page.waitForTimeout(800)

// favoriet 2 en 3 via de filmstrip
for (const nr of [1, 25]) {
  await page.click('.filmstrip button[title*="(nr ' + nr + ')"]')
  await page.waitForFunction(() => document.querySelector('.showslide.actief .favorietknop'), { timeout: 8000 })
  await page.waitForTimeout(1100)
  await page.click('.showslide.actief .favorietknop')
  await page.waitForFunction(n => {
    const t = [...document.querySelectorAll('.showkop .teller')].map(x => x.textContent).join(' ')
    return t.includes(n + ' FAVORIET')
  }, nr === 1 ? 2 : 3, { timeout: 8000 })
}
console.log('drie favorieten gekozen, teller volgt: ok')
const favThumbs = await page.evaluate(() => document.querySelectorAll('.filmstrip button.fav').length)
console.log('filmstrip markeert favorieten:', favThumbs === 3 ? 'ok (3)' : 'ONVERWACHT ' + favThumbs)
await page.screenshot({ path: UIT + '/stap1-favoriet.png' })

// doorvraag-notitie staat in het sessie-object
const token = new URL(page.url()).searchParams.get('s')
const sessie = (await (await fetch(API + '/api/sessies/' + token)).json()).sessie
console.log('citaat in sessie-object:',
  sessie.smaak.citaten.some(c => c.includes('prachtig verweren')) ? 'ok' : 'ONTBREEKT')
console.log('favorieten in sessie-object:',
  JSON.stringify([...sessie.smaak.favorieten].sort((a, b) => a - b)) === '[1,3,25]' ? 'ok [1,3,25]' : 'ONVERWACHT ' + JSON.stringify(sessie.smaak.favorieten))

// afronden naar stap 2
await page.click('text=Smaak afronden')
await page.waitForFunction(() => document.body.textContent.includes('Wat is het adres van uw kavel?'), { timeout: 15000 })
console.log('afronden brengt de reis naar stap 2: ok')
const deellink = page.url()

// hervatten: stap en profiel blijven staan
const page2 = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page2.goto(deellink)
await page2.waitForFunction(() => document.body.textContent.includes('Wat is het adres van uw kavel?'), { timeout: 20000 })
console.log('hervatten op stap 2 met sessie intact: ok')

// mobiel: show gestapeld, bladeren, geen horizontale overflow
const mob = await browser.newPage({ viewport: { width: 390, height: 844 } })
mob.on('pageerror', e => fouten.push('mobiel: ' + String(e)))
await mob.goto(BASIS + '/reis')
await mob.waitForSelector('.gesprek', { timeout: 20000 })
await mob.click('text=Ik typ liever')
await mob.waitForSelector('.showslide.actief .naam', { timeout: 20000 })
await mob.waitForTimeout(2400)
await mob.click('.showknoppen button[aria-label="Volgende"]')
await mob.waitForFunction(() => document.querySelector('.showslide.actief .naam')?.textContent === 'GLOED', { timeout: 8000 })
console.log('mobiel bladeren: ok')
const overflow = await mob.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
console.log('mobiel horizontale overflow px:', overflow)
await mob.evaluate(() => document.querySelector('.smaakshow').scrollIntoView())
await mob.waitForTimeout(1600)
await mob.screenshot({ path: UIT + '/stap1-mobiel.png' })

console.log(fouten.length ? 'FOUTEN:\n' + fouten.slice(0, 6).join('\n') : 'console leeg')
await browser.close()
