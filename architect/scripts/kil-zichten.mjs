// Playwright-zichtcontrole voor de dwarskap/kilkeper-blokken op /kern:
// clip-screenshots per zicht plus pixel-leegte-detectie, en de
// validatorstatus van elk blok.
import { chromium } from 'playwright'
import fs from 'fs'

const URL = process.env.URL || 'http://localhost:5173/kern'
const UIT = 'schermen/kil'
fs.mkdirSync(UIT, { recursive: true })

const ids = [
  'zicht-dwarskap:-totaal',
  'zicht-dwarskap:-dal-voor-links',
  'zicht-dwarskap:-dal-voor-rechts',
  'zicht-dwarskap:-dal-bovenaf',
  'zicht-dwarskap:-dal-laag-vanaf-goot',
  'zicht-dwarskap:-dwarsnok-op-hoofddak',
  'zicht-dwarskap:-keuring-goothoek',
  'zicht-dwarskap:-keuring-ver-achter',
  'zicht-dwarskap2:-totaal',
  'zicht-dwarskap2:-dal-bovenaf',
  'zicht-dwarskap2:-dal-close',
  'zicht-dwarskap2:-dal-schuin-achter',
  'zicht-dwarskap2:-keuring-goothoek',
  'zicht-dwarskap2:-keuring-hoog-voor',
]

const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } })
const consoleFouten = []
page.on('console', m => { if (m.type() === 'error') consoleFouten.push(m.text()) })
page.on('pageerror', e => consoleFouten.push(String(e)))
await page.goto(URL)
await page.waitForTimeout(2000)

const status = await page.evaluate(() =>
  [...document.querySelectorAll('.kernbloktitel')].map(t =>
    t.querySelector('h2').textContent.slice(0, 46) + ' :: ' + (t.querySelector('span')?.textContent || '?')))
for (const s of status) console.log('STATUS', s)

for (const id of ids) {
  const bestaat = await page.evaluate(id => {
    const el = document.getElementById(id)
    if (!el) return false
    el.scrollIntoView({ block: 'center' })
    return true
  }, id)
  if (!bestaat) { console.log('MIST:', id); continue }
  await page.waitForTimeout(2600)
  const el = await page.$(`[id="${id}"]`)
  const box = await el.boundingBox()
  const pad = UIT + '/' + id.replace(/:/g, '') + '.png'
  await page.screenshot({ path: pad, clip: box })
  const oordeel = await page.evaluate(id => {
    const c = document.getElementById(id).querySelector('canvas')
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
  console.log(id, '->', pad, oordeel)
}

// mobiel: laadt de pagina zonder consolefouten
const mob = await browser.newPage({ viewport: { width: 390, height: 844 } })
mob.on('console', m => { if (m.type() === 'error') consoleFouten.push('mobiel: ' + m.text()) })
mob.on('pageerror', e => consoleFouten.push('mobiel: ' + String(e)))
await mob.goto(URL)
await mob.waitForTimeout(3000)
console.log('mobiel geladen')

console.log(consoleFouten.length ? 'CONSOLEFOUTEN:\n' + consoleFouten.join('\n') : 'console leeg')
await browser.close()
