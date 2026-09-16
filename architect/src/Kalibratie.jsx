import { KALIBRATIE } from './kalibratie.js'
import { bouwSpec } from './generator.js'
import Woning3D from './Woning3D.jsx'

// Interne kalibratiepagina (/kalibratie, niet gelinkt in de klant-UI).
// Links het referentiebeeld, rechts de 3D-nabouw van de generator vanuit
// ongeveer dezelfde camerahoek. Nabouwsels zijn testmateriaal en
// verschijnen nooit als klantvariant.
export default function Kalibratie() {
  const geslaagd = KALIBRATIE.filter(p => p.status === 'geslaagd').length
  return (
    <div className="kalibratie">
      <header>
        <img src="./wordmark.png" alt="STÆL" style={{ height: 22 }} />
        <span className="titel">KALIBRATIE <em>referentie versus generator</em></span>
        <span className="kalteller">{geslaagd} van {KALIBRATIE.length} geslaagd</span>
      </header>
      {KALIBRATIE.map(p => {
        const spec = bouwSpec(p.params)
        const programma = { kavel: Math.max(600, spec.voet * 4), bouwvlak: spec.voet * 1.3 }
        return (
          <section key={p.nr} className={'kalrij status-' + p.status} id={'ref-' + p.nr}>
            <div className="kalkop">
              <h2>Referentie {p.nr} · {p.naam}</h2>
              <span className={'kalstatus ' + p.status}>{p.status}</span>
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
