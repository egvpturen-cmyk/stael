// Dunne client voor de Live Architect API (Railway). De basis-URL is
// instelbaar via VITE_API_BASIS; zonder die variabele wijst hij naar de
// productie-API.
export const API_BASIS = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_API_BASIS)
  || (typeof process !== 'undefined' && process.env?.API_BASIS)
  || 'https://api-production-4d7f4.up.railway.app'

async function vraag(pad, opties = {}) {
  const r = await fetch(API_BASIS + pad, {
    headers: { 'Content-Type': 'application/json' },
    ...opties,
  })
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const fout = new Error(data.fout || 'API-fout ' + r.status)
    fout.status = r.status
    fout.data = data
    throw fout
  }
  return data
}

export const sessieMaak = () => vraag('/api/sessies', { method: 'POST' })
export const sessieLees = token => vraag('/api/sessies/' + encodeURIComponent(token))
export const sessiePatch = (token, updates) => vraag('/api/sessies/' + encodeURIComponent(token), {
  method: 'PATCH', body: JSON.stringify(updates),
})
export const stemSessie = sessieToken => vraag('/api/stem/sessie', {
  method: 'POST', body: JSON.stringify({ sessieToken }),
})
export const stemTekst = (sessieToken, berichten) => vraag('/api/stem/tekst', {
  method: 'POST', body: JSON.stringify({ sessieToken, berichten }),
})
export const stemHartslag = uitgifteId => vraag('/api/stem/hartslag', {
  method: 'POST', body: JSON.stringify({ uitgifteId }),
})
export const stemEinde = uitgifteId => vraag('/api/stem/einde', {
  method: 'POST', body: JSON.stringify({ uitgifteId }),
})
