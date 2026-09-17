// Framerate-meting met echte GPU (ANGLE/D3D11) in plaats van
// SwiftShader: het grootvak draaien moet 60 fps halen.
import { chromium } from 'playwright'

const BASIS = process.env.URL || 'http://localhost:4173'
const browser = await chromium.launch({
  args: ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'],
})
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(BASIS + '/')
await page.waitForSelector('.variant', { timeout: 40000 })
await page.waitForTimeout(6000)
const gpu = await page.evaluate(() => {
  const c = document.createElement('canvas')
  const gl = c.getContext('webgl2') || c.getContext('webgl')
  const info = gl.getExtension('WEBGL_debug_renderer_info')
  return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : 'onbekend'
})
console.log('renderer:', gpu)
await page.click('.variant .kaartknoppen button')
await page.waitForSelector('.grootvak', { timeout: 10000 })
await page.waitForTimeout(4000)
const canvasBox = await (await page.$('.grootcanvas canvas')).boundingBox()
const cx = canvasBox.x + canvasBox.width / 2, cy = canvasBox.y + canvasBox.height / 2
await page.mouse.move(cx, cy)
await page.mouse.down()
const meting = page.evaluate(() => new Promise(res => {
  let n = 0
  const start = performance.now()
  const tel = () => {
    n++
    if (performance.now() - start < 2500) requestAnimationFrame(tel)
    else res(Math.round(n / 2.5))
  }
  requestAnimationFrame(tel)
}))
for (let i = 0; i < 50; i++) await page.mouse.move(cx + Math.sin(i / 4) * 240, cy + Math.cos(i / 6) * 70, { steps: 2 })
console.log('framerate grootvak (draaien, GPU):', await meting, 'fps')
await page.mouse.up()
await browser.close()
