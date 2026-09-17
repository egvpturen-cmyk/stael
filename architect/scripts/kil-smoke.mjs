// Smoketest dwarskap/kilkeper: alleen dwarskap-varianten, volledige validatie
import { bouwModel } from '../src/kern/model.js'
import { valideerModel } from '../src/kern/valideer.js'
import { willekeurigeParams } from '../src/kern/genereerParams.js'

let n = 0, fail = 0
for (let seed = 0; seed < 600 && n < 60; seed++) {
  const p = willekeurigeParams(seed)
  if (p.massa?.type !== 'dwarskap') continue
  n++
  try {
    const m = bouwModel(p)
    const f = valideerModel(m)
    if (f.length) {
      fail++
      console.log('seed', seed, 'b=' + p.volume.b.toFixed(1), 'b2=' + p.massa.b2.toFixed(1), ':')
      for (const x of f.slice(0, 4)) console.log('   ', x)
    }
  } catch (e) {
    fail++
    console.log('seed', seed, 'EXCEPTIE:', e.message)
  }
}
console.log('dwarskap-smoke:', (n - fail) + '/' + n, 'groen')
