import { useEffect, useState } from 'react'
import { KALIBRATIE } from './kalibratie.js'
import { bouwSpec } from './generator.js'
import Woning3D from './Woning3D.jsx'

// Interne kalibratiepagina (/kalibratie, niet gelinkt in de klant-UI).
// Links het referentiebeeld, rechts de 3D-nabouw vanuit dezelfde
// camerahoek. De status geslaagd wordt uitsluitend door STAEL zelf
// gegeven, via de knoppen per rij (lokaal opgeslagen in de browser).

const OPSLAG = 'stael-kalibratie-status'
const STATUSSEN = ['review', 'bijna', 'geslaagd']
const LABELS = { review: 'in review', bijna: 'bijna', geslaagd: 'geslaagd' }

function leesStatussen() {
  try { return JSON.parse(localStorage.getItem(OPSLAG)) || {} } catch { return {} }
}

export default function Kalibratie() {
  const [statussen, zetStatussen] = useState(leesStatussen)
  useEffect(() => {
    try { localStorage.setItem(OPSLAG, JSON.stringify(statussen)) } catch { /* prive-modus */ }
  }, [statussen])

  const statusVan = nr => statussen[nr] || 'review'
  const geslaagd = KALIBRATIE.filter(p => statusVan(p.nr) === 'geslaagd').length

  return (
    <div className="kalibratie">
      <header>
        <img src="./wordmark.png" alt="STÆL" style={{ height: 22 }} />
        <span className="titel">KALIBRATIE <em>referentie versus generator</em></span>
        <span className="kalteller">{geslaagd} van {KALIBRATIE.length} geslaagd</span>
      </header>
      {KALIBRATIE.map(p => {
        const spec = bouwSpec(p.params)
        const programma = { kavel: spec.voet * 2, bouwvlak: spec.voet * 1.15 }
        const status = statusVan(p.nr)
        return (
          <section key={p.nr} className={'kalrij status-' + status} id={'ref-' + p.nr}>
            <div className="kalkop">
              <h2>Referentie {p.nr} · {p.naam}</h2>
              <span className={'kalstatus ' + status}>{LABELS[status]}</span>
              <div className="kalknoppen">
                {STATUSSEN.map(s => (
                  <button key={s} type="button"
                    className={s === status ? 'actief' : ''}
                    onClick={() => zetStatussen(v => ({ ...v, [p.nr]: s }))}>
                    {LABELS[s]}
                  </button>
                ))}
              </div>
            </div>
            <div className="kalpaar">
              <figure><img src={'./referenties/' + p.beeld} alt={'Referentie ' + p.nr} /></figure>
              <div className="kalcanvas">
                <Woning3D spec={spec} programma={programma} camera={p.camera} />
              </div>
            </div>
            <p className="kalnotitie">{p.notitie}</p>
          </section>
        )
      })}
    </div>
  )
}
