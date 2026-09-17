// Maakt webversies van de conceptcollectie: bibliotheek/N.png (bron,
// ~2 MB per stuk) naar public/collectie/N.jpg (max 1280 breed, jpeg),
// zodat de smaakstap snel laadt. Bron blijft bibliotheek/ in de
// repo-root; dit script houdt de webversies in sync.
import { chromium } from 'playwright'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const hier = path.dirname(fileURLToPath(import.meta.url))
const bron = path.resolve(hier, '../../bibliotheek')
const doel = path.resolve(hier, '../public/collectie')
fs.mkdirSync(doel, { recursive: true })

const browser = await chromium.launch()
const page = await browser.newPage()
let gemaakt = 0, fouten = 0
for (let n = 1; n <= 34; n++) {
  const uit = path.join(doel, n + '.jpg')
  const inPad = path.join(bron, n + '.png')
  if (!fs.existsSync(inPad)) { console.log('MIST bron', n + '.png'); fouten++; continue }
  if (fs.existsSync(uit) && fs.statSync(uit).mtimeMs > fs.statSync(inPad).mtimeMs) continue
  const dataUrl = await page.evaluate(async b64 => {
    const img = new Image()
    img.src = 'data:image/png;base64,' + b64
    await img.decode()
    const schaal = Math.min(1, 1280 / img.width)
    const c = document.createElement('canvas')
    c.width = Math.round(img.width * schaal)
    c.height = Math.round(img.height * schaal)
    c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
    return c.toDataURL('image/jpeg', .82)
  }, fs.readFileSync(inPad).toString('base64'))
  fs.writeFileSync(uit, Buffer.from(dataUrl.split(',')[1], 'base64'))
  gemaakt++
}
await browser.close()
const totaal = fs.readdirSync(doel).length
console.log('webversies:', totaal, 'aanwezig,', gemaakt, 'nieuw gemaakt,', fouten, 'fouten')
process.exitCode = (totaal === 34 && !fouten) ? 0 : 1
