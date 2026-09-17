// Bewijs dat de stap-4-wetten bijten: saboteer een geldig stapelmodel
// en eis dat de validator rood wordt. Elke case moet fouten geven.
import { bouwModel } from '../src/kern/model.js'
import { valideerModel } from '../src/kern/valideer.js'

const params = {
  seed: 2,
  volume: { b: 8, d: 11, goot: 3.1 },
  massa: {
    type: 'stapel', h1: 3.1, h2: 2.9, b2: 8, d2: 6, dx: 3.4, dz: 1.2,
    terras: true, opbouw: { b: 2.6, d: 2.2, h: 2.6 },
  },
}

const cases = [
  ['balustrade weg', m => { m.randafwerking = m.randafwerking.filter(r => r.type !== 'balustrade') }],
  ['kolommen weg', m => { m.randafwerking = m.randafwerking.filter(r => r.type !== 'stapelkolommen') }],
  ['kolom te kort', m => { m.randafwerking.find(r => r.type === 'stapelkolommen').h -= .4 }],
  ['terrasdeur weg', m => {
    for (const w of m.wanden) w.sparingen = w.sparingen.filter(sp => !sp.id.includes('terrasdeur'))
  }],
  ['opbouwdeur weg (bovendak zonder toegang)', m => {
    for (const w of m.wanden) w.sparingen = w.sparingen.filter(sp => !sp.id.includes('opbouw'))
  }],
  ['opbouw zonder terras eronder', m => { m.volumes.find(v => v.id === 'boven').terras = false }],
  ['balustrade op niet-begaanbaar dak', m => { m.volumes.find(v => v.id === 'onder').terras = false }],
  ['balustrade te laag', m => { m.randafwerking.find(r => r.type === 'balustrade').h = .6 }],
  ['terras met te smalle inzet (regel 1,2 m)', m => {
    // verklein alle inzetten door de bovendoos op te blazen tot bijna
    // de onderdoos: het terras had dan nooit mogen bestaan
    const boven = m.volumes.find(v => v.id === 'boven')
    const onder = m.volumes.find(v => v.id === 'onder')
    boven.b = onder.b - .7; boven.d = onder.d - .7; boven.pos = [0, 0]
  }, 'begaanbare inzet'],
  ['bovenwand begint te hoog (open strook, basis-schilcheck)', m => {
    const w = m.wanden.find(x => x.id === 'boven:langs-')
    const basis = m.volumes.find(v => v.id === 'boven').basis
    w.contour = w.contour.map(([u, v]) => [u, Math.max(v, basis + .5)])
  }],
]

let mis = 0
for (const [naam, saboteer, verwacht] of cases) {
  const model = bouwModel(params)
  const basis = valideerModel(model)
  if (basis.length) { console.log('BASIS NIET GROEN:', basis.slice(0, 3)); mis++; continue }
  saboteer(model)
  const fouten = valideerModel(model)
  const raak = verwacht ? fouten.some(f => f.includes(verwacht)) : fouten.length > 0
  if (raak) console.log('rood zoals verwacht |', naam, '|', fouten.find(f => !verwacht || f.includes(verwacht)))
  else { console.log('!! WET VUURDE NIET:', naam, fouten.slice(0, 2)); mis++ }
}
console.log(mis ? 'FAAL: ' + mis + ' cases' : 'alle sabotages rood: wetten bijten')
