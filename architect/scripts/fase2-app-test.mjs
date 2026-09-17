// Fase 2-controle van de klantapp: setsnelheid met de workerpool (doel
// maximaal 2 s), gevulde kaartcanvases, grootvak met materiaalkeuze
// live, en framerate bij het draaien van het grote model.
import { chromium } from 'playwright'
import fs from 'fs'

const BASIS = process.env.URL || 'http://localhost:5173'
const UIT = 'schermen/fase2'
fs.mkdirSync(UIT, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
const fouten = []
page.on('console', m => { if (m.type() === 'error') fouten.push(m.text()) })
page.on('pageerror', e => fouten.push(String(e)))

const t0 = Date.now()
await page.goto(BASIS + '/')
await page.waitForSelector('.variant', { timeout: 30000 })
console.log('eerste set zichtbaar na', Date.now() - t0, 'ms (incl. paginalading)')

// nieuwe set: pure generatietijd
const t1 = Date.now()
await page.click('.nieuweset')
await page.waitForFunction(() => !document.querySelector('.lader'), { timeout: 30000 })
console.log('nieuwe set klaar in', Date.now() - t1, 'ms')

await page.waitForTimeout(7000)
const leeg = await page.evaluate(() => {
  const c = document.querySelector('.variant canvas')
  if (!c) return 'GEEN CANVAS'
  const t = document.createElement('canvas'); t.width = 64; t.height = 64
  const g = t.getContext('2d'); g.drawImage(c, 0, 0, 64, 64)
  const d = g.getImageData(0, 0, 64, 64).data
  let versch = 0
  const [r0, g0, b0] = [d[0], d[1], d[2]]
  for (let i = 4; i < d.length; i += 4)
    if (Math.abs(d[i] - r0) + Math.abs(d[i + 1] - g0) + Math.abs(d[i + 2] - b0) > 24) versch++
  return versch < 40 ? 'VRIJWEL LEEG (' + versch + ')' : 'ok (' + versch + ')'
})
console.log('eerste kaartcanvas:', leeg)
await page.screenshot({ path: UIT + '/app-kaarten.png' })

// grootvak met materiaalkeuze
await page.click('.variant .kaartknoppen button')
await page.waitForSelector('.grootvak', { timeout: 10000 })
await page.waitForTimeout(4000)
await page.screenshot({ path: UIT + '/groot-basis.png' })
// framerate tijdens draaien: sleep het grote canvas rond
const fps = await page.evaluate(() => new Promise(res => {
  let n = 0
  const start = performance.now()
  const tel = () => {
    n++
    if (performance.now() - start < 2000) requestAnimationFrame(tel)
    else res(Math.round(n / 2))
  }
  requestAnimationFrame(tel)
}))
console.log('framerate grootvak (statisch):', fps, 'fps')
const canvasBox = await (await page.$('.grootcanvas canvas')).boundingBox()
const cx = canvasBox.x + canvasBox.width / 2, cy = canvasBox.y + canvasBox.height / 2
await page.mouse.move(cx, cy)
await page.mouse.down()
const fpsMeting = page.evaluate(() => new Promise(res => {
  let n = 0
  const start = performance.now()
  const tel = () => {
    n++
    if (performance.now() - start < 2000) requestAnimationFrame(tel)
    else res(Math.round(n / 2))
  }
  requestAnimationFrame(tel)
}))
for (let i = 0; i < 40; i++) await page.mouse.move(cx + Math.sin(i / 4) * 220, cy + Math.cos(i / 6) * 60, { steps: 2 })
const fpsDraai = await fpsMeting
await page.mouse.up()
console.log('framerate grootvak (draaien):', fpsDraai, 'fps')

// materiaal wisselen: dak naar blauwgrijs fels
await page.selectOption('.materiaalpaneel select', 'felsGevel').catch(() => {})
await page.waitForTimeout(1500)
await page.screenshot({ path: UIT + '/groot-materiaal.png' })

// verzin het voor mij
const t2 = Date.now()
await page.click('.grootvak .sluit')
const knoppen = await page.$$('.setbalk .nieuweset')
await knoppen[1].click()
await page.waitForFunction(() => !document.querySelector('.lader'), { timeout: 30000 })
console.log('verzin het voor mij klaar in', Date.now() - t2, 'ms')
await page.waitForTimeout(6000)
await page.screenshot({ path: UIT + '/app-verzin.png' })

console.log(fouten.length ? 'CONSOLEFOUTEN:\n' + fouten.slice(0, 8).join('\n') : 'console leeg')
await browser.close()
