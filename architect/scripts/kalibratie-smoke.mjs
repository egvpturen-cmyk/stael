// Regressietest stap 5a: alle 13 kalibratiepresets door de volle kern
import { bouwModel } from '../src/kern/model.js'
import { valideerModel, repareerModel } from '../src/kern/valideer.js'
import { KALIBRATIE_KERN } from '../src/kern/kalibratieKern.js'

let fail = 0
for (const p of KALIBRATIE_KERN) {
  try {
    let m = bouwModel(p.params)
    let f = valideerModel(m)
    const eerste = f.length === 0
    if (f.length) { m = repareerModel(m); f = valideerModel(m) }
    if (f.length) {
      fail++
      console.log('ref', p.nr, 'ROOD:')
      for (const x of f.slice(0, 4)) console.log('   ', x)
    } else {
      console.log('ref', p.nr, eerste ? 'groen (eerste keer)' : 'groen (na reparatie)')
    }
  } catch (e) {
    fail++
    console.log('ref', p.nr, 'EXCEPTIE:', e.message)
  }
}
console.log(fail ? 'FAAL: ' + fail + ' van 13' : 'alle 13 presets groen')
