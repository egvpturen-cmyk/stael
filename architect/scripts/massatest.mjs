// Massatest: de vaste poort voor elke oplevering van de gebouwmodel-kern.
// Honderden gegenereerde varianten gaan door ALLE validaties (gesloten
// schil, sparingen, clipping, dakranden, nokvouw). Rapport: aantal
// gegenereerd, eerste keer goed, gerepareerd, verworpen, en de top-3
// faalredenen. Reparatie en verwerping zijn vangnetten: een percentage
// boven een paar procent betekent dat er een regel in het MODEL ontbreekt.
// Gebruik: node scripts/massatest.mjs [aantal]

import { bouwModel } from '../src/kern/model.js'
import { valideerModel, repareerModel } from '../src/kern/valideer.js'
import { willekeurigeParams } from '../src/kern/genereerParams.js'

const N = parseInt(process.argv[2] || '300')
const start = Date.now()
let eersteKeerGoed = 0, gerepareerd = 0, verworpen = 0
const redenen = new Map()
const normaliseer = f => f
  .replace(/-?\d+\.\d+/g, '#').replace(/\b\d+\b/g, '#')
  .replace(/(kop|langs)[+-]?[^:]*/, '$1')

for (let i = 0; i < N; i++) {
  const params = willekeurigeParams(i)
  let model, fouten
  try {
    model = bouwModel(params)
    fouten = valideerModel(model)
  } catch (e) {
    verworpen++
    const kort = 'CRASH: ' + String(e.message).slice(0, 90)
    redenen.set(kort, (redenen.get(kort) || 0) + 1)
    continue
  }
  if (fouten.length === 0) { eersteKeerGoed++; continue }
  for (const f of fouten) {
    const kort = normaliseer(f)
    redenen.set(kort, (redenen.get(kort) || 0) + 1)
  }
  const her = repareerModel(model)
  if (valideerModel(her).length === 0) gerepareerd++
  else verworpen++
}

const pct = n => (100 * n / N).toFixed(1) + '%'
console.log('== MASSATEST ==', N, 'varianten in', ((Date.now() - start) / 1000).toFixed(1) + 's')
console.log('eerste keer goed:', eersteKeerGoed, '(' + pct(eersteKeerGoed) + ')')
console.log('gerepareerd:     ', gerepareerd, '(' + pct(gerepareerd) + ')')
console.log('verworpen:       ', verworpen, '(' + pct(verworpen) + ')')
console.log('top faalredenen:')
const top = [...redenen.entries()].sort((a, b) => b[1] - a[1]).slice(0, 6)
top.forEach(([f, n]) => console.log('  ' + n + 'x  ' + f))
process.exit(verworpen > N * .05 ? 1 : 0)
