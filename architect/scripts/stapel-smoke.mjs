// Smoketest stap 4: alleen stapel- en bungalowvarianten, volledige validatie
import { bouwModel } from '../src/kern/model.js'
import { valideerModel } from '../src/kern/valideer.js'
import { willekeurigeParams } from '../src/kern/genereerParams.js'

let n = 0, fail = 0
for (let seed = 0; seed < 700 && n < 70; seed++) {
  const p = willekeurigeParams(seed)
  if (p.massa?.type !== 'stapel' && !p.volume.plat) continue
  n++
  try {
    const m = bouwModel(p)
    const f = valideerModel(m)
    if (f.length) {
      fail++
      console.log('seed', seed, p.volume.plat ? '(bungalow)' : '(stapel)', ':')
      for (const x of f.slice(0, 4)) console.log('   ', x)
    }
  } catch (e) {
    fail++
    console.log('seed', seed, 'EXCEPTIE:', e.message)
  }
}
console.log('stapel-smoke:', (n - fail) + '/' + n, 'groen')
