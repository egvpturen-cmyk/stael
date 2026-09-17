// Web worker: bouwt en valideert een variant-poging buiten de hoofddraad.
// De uitkomst (kern-model plus kerngetallen) is pure data en gaat via
// structured clone terug naar de pagina.
import { maakVariantUitPoging } from './klantgenerator.js'

self.onmessage = e => {
  const { taak, prog, poging } = e.data
  let v = null
  try { v = maakVariantUitPoging(prog, poging) } catch { v = null }
  self.postMessage({ taak, v })
}
