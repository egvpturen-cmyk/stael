// Playwright-controle stap 5: /kalibratie op de kern (13 rijen, per rij
// validatorstatus en gevuld canvas) en de klantapp op de kern
// (varianten renderen, console leeg), desktop en mobiel.
import { chromium } from 'playwright'
import fs from 'fs'

const BASIS = process.env.URL || 'http://localhost:5173'
const UIT = 'schermen/stap5'
fs.mkdirSync(UIT, { recursive: true })

const browser = await chromium.launch()
const fouten = []

// ---- kalibratie ----
const kal = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
kal.on('console', m => { if (m.type() === 'error') fouten.push('kal: ' + m.text()) })
kal.on('pageerror', e => fouten.push('kal: ' + String(e)))
await kal.goto(BASIS + '/kalibratie')
await kal.waitForTimeout(2500)
const rijen = await kal.evaluate(() =>
  [...document.querySelectorAll('.kalrij')].map(s => ({
    id: s.id,
    status: s.querySelector('.kalkop span')?.textContent || '?',
  })))
for (const r of rijen) console.log('KAL', r.id, '::', r.status)
console.log('kalibratierijen:', rijen.length)

const leegcheck = async (page, id) => page.evaluate(id => {
  const c = document.getElementById(id)?.querySelector('canvas')
  if (!c) return 'GEEN CANVAS'
  const t = document.createElement('canvas'); t.width = 64; t.height = 64
  const g = t.getContext('2d'); g.drawImage(c, 0, 0, 64, 64)
  const d = g.getImageData(0, 0, 64, 64).data
  let versch = 0
  const [r0, g0, b0] = [d[0], d[1], d[2]]
  for (let i = 4; i < d.length; i += 4)
    if (Math.abs(d[i] - r0) + Math.abs(d[i + 1] - g0) + Math.abs(d[i + 2] - b0) > 24) versch++
  return versch < 40 ? 'VRIJWEL LEEG (' + versch + ')' : 'ok (' + versch + ')'
}, id)

for (const r of rijen) {
  await kal.evaluate(id => document.getElementById(id)?.scrollIntoView({ block: 'center' }), r.id)
  await kal.waitForTimeout(2400)
  const el = await kal.$(`[id="${r.id}"]`)
  const box = await el.boundingBox()
  const pad = UIT + '/' + r.id + '.png'
  await kal.screenshot({ path: pad, clip: box })
  console.log(r.id, '->', pad, await leegcheck(kal, r.id))
}

// ---- klantapp desktop ----
const app = await browser.newPage({ viewport: { width: 1440, height: 900 } })
app.on('console', m => { if (m.type() === 'error') fouten.push('app: ' + m.text()) })
app.on('pageerror', e => fouten.push('app: ' + String(e)))
await app.goto(BASIS + '/')
await app.waitForTimeout(9000)
const nVar = await app.evaluate(() => document.querySelectorAll('.variant').length)
console.log('app varianten:', nVar)
await app.screenshot({ path: UIT + '/app-desktop.png' })
const kaartLeeg = await app.evaluate(() => {
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
console.log('eerste kaartcanvas:', kaartLeeg)
// nieuwe set moet ook werken
await app.click('.nieuweset')
await app.waitForTimeout(9000)
console.log('na nieuwe set:', await app.evaluate(() => document.querySelectorAll('.variant').length), 'varianten')

// ---- klantapp mobiel ----
const mob = await browser.newPage({ viewport: { width: 390, height: 844 } })
mob.on('console', m => { if (m.type() === 'error') fouten.push('mobiel: ' + m.text()) })
mob.on('pageerror', e => fouten.push('mobiel: ' + String(e)))
await mob.goto(BASIS + '/')
await mob.waitForTimeout(9000)
console.log('mobiel varianten:', await mob.evaluate(() => document.querySelectorAll('.variant').length))
await mob.screenshot({ path: UIT + '/app-mobiel.png' })

console.log(fouten.length ? 'CONSOLEFOUTEN:\n' + fouten.join('\n') : 'console leeg')
await browser.close()
