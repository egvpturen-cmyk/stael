// Workerpool voor de klantgenerator: de zware bouw- en validatiestap
// draait parallel in web workers, de hoofddraad blijft op 60 fps. De
// uitkomst is deterministisch identiek aan de sequentiele generator:
// pogingen worden op volgnummer verzameld en de eerste doel-N geldige
// vormen de set, ongeacht welke worker eerder klaar was.
import { variantenPlan, genereerKernVarianten } from './klantgenerator.js'

const AANTAL = Math.min(4, (typeof navigator !== 'undefined' && navigator.hardwareConcurrency) || 4)
let workers = null
let volgnr = 0
const wachters = new Map()

function pool() {
  if (!workers) {
    workers = Array.from({ length: AANTAL }, () => {
      const w = new Worker(new URL('./variantWorker.js', import.meta.url), { type: 'module' })
      w.onmessage = e => {
        const { taak, v } = e.data
        const cb = wachters.get(taak)
        if (cb) { wachters.delete(taak); cb(v) }
      }
      return w
    })
  }
  return workers
}

export function genereerVariantenAsync(prog, ronde = 0) {
  if (typeof Worker === 'undefined') return Promise.resolve(genereerKernVarianten(prog, ronde))
  const { doel, pogingen } = variantenPlan(prog, ronde)
  if (!pogingen.length) return Promise.resolve([])
  const ws = pool()
  return new Promise(resolve => {
    const resultaten = new Array(pogingen.length).fill(undefined)
    let uitgedeeld = 0
    let klaar = false
    const evalueer = () => {
      const lijst = []
      for (let i = 0; i < resultaten.length && lijst.length < doel; i++) {
        if (resultaten[i] === undefined) return
        if (resultaten[i]) lijst.push(resultaten[i])
      }
      klaar = true
      resolve(lijst)
    }
    const geef = w => {
      if (klaar || uitgedeeld >= pogingen.length) return
      const idx = uitgedeeld++
      const taak = ++volgnr
      wachters.set(taak, v => {
        resultaten[idx] = v || null
        if (!klaar) { evalueer(); geef(w) }
      })
      w.postMessage({ taak, prog, poging: pogingen[idx] })
    }
    ws.forEach(geef)
  })
}
