import { useEffect, useMemo, useRef, useState } from 'react'
import { KALIBRATIE_KERN } from './kern/kalibratieKern.js'
import { bouwModel } from './kern/model.js'
import { valideerModel, repareerModel } from './kern/valideer.js'
import KernCanvas from './kern/KernWoning.jsx'

// Interne kalibratiepagina (/kalibratie, niet gelinkt in de klant-UI).
// Links het referentiebeeld, rechts de nabouw uit de GEBOUWMODEL-KERN
// vanuit dezelfde camerahoek; elke rij toont ook de validatorstatus.
// De status geslaagd wordt uitsluitend door STAEL zelf gegeven, via de
// knoppen per rij (lokaal opgeslagen in de browser).

const OPSLAG = 'stael-kalibratie-status'
const STATUSSEN = ['review', 'bijna', 'geslaagd']
const LABELS = { review: 'in review', bijna: 'bijna', geslaagd: 'geslaagd' }

function leesStatussen() {
  try { return JSON.parse(localStorage.getItem(OPSLAG)) || {} } catch { return {} }
}

// mount een canvas pas bij (bijna) in beeld: dertien rijen zijn meer
// dan de browser aan gelijktijdige WebGL-contexts toestaat
function LuiCanvas({ children }) {
  const ref = useRef(null)
  const [zichtbaar, zetZichtbaar] = useState(false)
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => zetZichtbaar(e.isIntersecting), { rootMargin: '250px' })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [])
  return <div ref={ref} style={{ position: 'absolute', inset: 0 }}>{zichtbaar ? children : null}</div>
}

export default function Kalibratie() {
  const [statussen, zetStatussen] = useState(leesStatussen)
  useEffect(() => {
    try { localStorage.setItem(OPSLAG, JSON.stringify(statussen)) } catch { /* prive-modus */ }
  }, [statussen])

  const rijen = useMemo(() => KALIBRATIE_KERN.map(p => {
    let model = bouwModel(p.params)
    let fouten = valideerModel(model)
    if (fouten.length) { model = repareerModel(model); fouten = valideerModel(model) }
    return { ...p, model, fouten }
  }), [])

  const statusVan = nr => statussen[nr] || 'review'
  const geslaagd = rijen.filter(p => statusVan(p.nr) === 'geslaagd').length

  return (
    <div className="kalibratie">
      <header>
        <img src="./wordmark.png" alt="STÆL" style={{ height: 22 }} />
        <span className="titel">KALIBRATIE <em>referentie versus gebouwmodel-kern</em></span>
        <span className="kalteller">{geslaagd} van {rijen.length} geslaagd</span>
      </header>
      {rijen.map(p => {
        const status = statusVan(p.nr)
        return (
          <section key={p.nr} className={'kalrij status-' + status} id={'ref-' + p.nr}>
            <div className="kalkop">
              <h2>Referentie {p.nr} · {p.naam}</h2>
              <span style={{ color: p.fouten.length ? '#d98a5a' : '#8fc493', fontSize: '.72rem', letterSpacing: '.08em' }}>
                {p.fouten.length ? p.fouten[0] : 'model valide'}
              </span>
              <span className={'kalstatus ' + status}>{LABELS[status]}</span>
              <div className="kalknoppen">
                {STATUSSEN.map(sx => (
                  <button key={sx} type="button"
                    className={sx === status ? 'actief' : ''}
                    onClick={() => zetStatussen(v => ({ ...v, [p.nr]: sx }))}>
                    {LABELS[sx]}
                  </button>
                ))}
              </div>
            </div>
            <div className="kalpaar">
              <figure><img src={'./referenties/' + p.beeld} alt={'Referentie ' + p.nr} /></figure>
              <div className="kalcanvas" style={{ position: 'relative' }}>
                <LuiCanvas><KernCanvas model={p.model} camera={p.camera} /></LuiCanvas>
              </div>
            </div>
            <p className="kalnotitie">{p.notitie}</p>
          </section>
        )
      })}
    </div>
  )
}
