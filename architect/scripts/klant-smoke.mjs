// Smoketest stap 5b: de kern-klantgenerator over een reeks programma's
// en rondes; elke set moet genoeg geldige varianten opleveren en elke
// variant is per constructie al door de wetten (anders was hij weg).
import { genereerKernVarianten } from '../src/kern/klantgenerator.js'
import { REGELS_DEFAULT } from '../src/ontwerptaal.js'

const programmas = [
  { kavel: 800, bouwvlak: 150, woonopp: 140, lagen: 1, dak: 'zadel', regels: { ...REGELS_DEFAULT } },
  { kavel: 800, bouwvlak: 150, woonopp: 140, lagen: 2, dak: 'zadel', regels: { ...REGELS_DEFAULT } },
  { kavel: 600, bouwvlak: 120, woonopp: 180, lagen: 2, dak: 'plat', regels: { ...REGELS_DEFAULT } },
  { kavel: 1200, bouwvlak: 220, woonopp: 260, lagen: 2, dak: 'mix', regels: { ...REGELS_DEFAULT } },
  { kavel: 400, bouwvlak: 90, woonopp: 90, lagen: 1, dak: 'mix', regels: { ...REGELS_DEFAULT, gootMax: 2.8, nokMax: 7 } },
  { kavel: 2000, bouwvlak: 300, woonopp: 320, lagen: 2, dak: 'plat', regels: { ...REGELS_DEFAULT, nokMax: 12 } },
]

let totaal = 0, dun = 0
for (let pi = 0; pi < programmas.length; pi++) {
  for (let ronde = 0; ronde < 3; ronde++) {
    const t0 = Date.now()
    const lijst = genereerKernVarianten(programmas[pi], ronde)
    totaal += lijst.length
    const massas = lijst.map(v => v.id.split('-')[1]).join(',')
    console.log('prog', pi, 'ronde', ronde, ':', lijst.length, 'varianten in',
      Date.now() - t0, 'ms  [' + massas + ']')
    if (lijst.length < 4) { dun++; console.log('   !! dunne set') }
  }
}
console.log(dun ? 'LET OP: ' + dun + ' dunne sets, totaal ' + totaal : 'klant-smoke ok, totaal ' + totaal + ' varianten')
