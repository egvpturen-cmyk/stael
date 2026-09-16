import { useMemo, useState, useEffect } from 'react'
import { genereerVarianten } from './generator.js'
import { REGELS_DEFAULT } from './ontwerptaal.js'
import Woning3D from './Woning3D.jsx'

const START = {
  kavel: 800,
  bouwvlak: 150,
  woonopp: 140,
  lagen: 1,
  dak: 'zadel',
  regels: { ...REGELS_DEFAULT },
}

const ROMEINS = ['I', 'II', 'III', 'IV']
function naamVoor(v, alle) {
  const zelfde = alle.filter(x => x.naam === v.naam)
  if (zelfde.length < 2) return v.naam
  return v.naam + ' ' + (ROMEINS[zelfde.indexOf(v)] || zelfde.indexOf(v) + 1)
}

function Getal({ label, eenheid, waarde, min, max, stap = 1, onChange }) {
  return (
    <label className="veld">
      <span>{label} <em>{eenheid}</em></span>
      <input type="number" value={waarde} min={min} max={max} step={stap}
        onChange={e => onChange(Number(e.target.value) || min)} />
    </label>
  )
}

function Keuze({ label, opties, waarde, onChange }) {
  return (
    <div className="veld">
      <span>{label}</span>
      <div className="knopgroep">
        {opties.map(([v, t]) => (
          <button key={v} type="button"
            className={v === waarde ? 'actief' : ''}
            onClick={() => onChange(v)}>{t}</button>
        ))}
      </div>
    </div>
  )
}

function VariantKaart({ v, naam, prog, favoriet, opFavoriet, opGroot }) {
  return (
    <article className={'variant' + (favoriet ? ' favoriet' : '')}>
      {favoriet && <span className="keuzelabel">Jouw keuze</span>}
      <div className="canvasvak">
        <Woning3D spec={v} programma={prog} />
      </div>
      <div className="variantinfo">
        <h3>{naam}</h3>
        <p>{v.beschrijving}</p>
        <dl>
          <div><dt>Voetafdruk</dt><dd>{v.voet} m²</dd></div>
          <div><dt>Woonopp.</dt><dd>≈ {v.opp} m²</dd></div>
          <div><dt>Goot / nok</dt><dd>{v.goot.toFixed(1)} / {v.nok.toFixed(1)} m</dd></div>
          {!v.plat && <div><dt>Dakhelling</dt><dd>{v.helling}°</dd></div>}
        </dl>
        {!v.past && <p className="waarschuwing">Past niet volledig in het bouwvlak: kies een kleiner woonoppervlak of een verdieping.</p>}
        <div className="kaartknoppen">
          <button type="button" onClick={opGroot}>Bekijk groot</button>
          <button type="button" className={favoriet ? 'stil' : ''} onClick={opFavoriet}>
            {favoriet ? 'Keuze loslaten' : 'Kies deze'}
          </button>
        </div>
      </div>
    </article>
  )
}

export default function App() {
  const [prog, zetProg] = useState(START)
  const [regelsOpen, zetRegelsOpen] = useState(false)
  const [groot, zetGroot] = useState(null)
  const [ronde, zetRonde] = useState(0)
  const [favoriet, zetFavoriet] = useState(null)
  const [laden, zetLaden] = useState(false)

  const varianten = useMemo(() => genereerVarianten(prog, ronde), [prog, ronde])
  const zet = deel => { zetProg(p => ({ ...p, ...deel })); zetRonde(0) }
  const zetRegel = deel => { zetProg(p => ({ ...p, regels: { ...p.regels, ...deel } })); zetRonde(0) }

  function nieuweSet() {
    zetLaden(true)
    setTimeout(() => { zetRonde(r => r + 1); zetLaden(false) }, 30)
  }

  useEffect(() => { zetFavoriet(null) }, [prog])

  const lijst = varianten.filter(v => !favoriet || v.id !== favoriet.id)

  return (
    <div className="app">
      <header>
        <a className="merk" href="https://egvpturen-cmyk.github.io/stael/" title="Terug naar de site">
          <img src="./wordmark.png" alt="STÆL" />
        </a>
        <span className="titel">LIVE ARCHITECT <em>fase 1 · vormstudie</em></span>
      </header>

      <div className="indeling">
        <aside>
          <h2>Programma</h2>
          <Getal label="Kavel" eenheid="m²" waarde={prog.kavel} min={200} max={10000} stap={50}
            onChange={v => zet({ kavel: v })} />
          <Getal label="Bouwvlak" eenheid="m²" waarde={prog.bouwvlak} min={50} max={600} stap={10}
            onChange={v => zet({ bouwvlak: v })} />
          <Getal label="Woonoppervlak" eenheid="m²" waarde={prog.woonopp} min={60} max={500} stap={10}
            onChange={v => zet({ woonopp: v })} />
          <Keuze label="Lagen" waarde={prog.lagen}
            opties={[[1, 'Alles begane grond'], [2, 'Met verdieping']]}
            onChange={v => zet({ lagen: v })} />
          <Keuze label="Dakvorm" waarde={prog.dak}
            opties={[['zadel', 'Zadeldak'], ['plat', 'Plat'], ['mix', 'Mix']]}
            onChange={v => zet({ dak: v })} />

          <button type="button" className="regelknop" onClick={() => zetRegelsOpen(o => !o)}>
            Bestemmingsplan {regelsOpen ? '−' : '+'}
          </button>
          {regelsOpen && (
            <div className="regels">
              <Getal label="Goothoogte max" eenheid="m" waarde={prog.regels.gootMax} min={2} max={8} stap={.5}
                onChange={v => zetRegel({ gootMax: v })} />
              <Getal label="Nokhoogte max" eenheid="m" waarde={prog.regels.nokMax} min={3} max={14} stap={.5}
                onChange={v => zetRegel({ nokMax: v })} />
              <Getal label="Dakhelling min" eenheid="°" waarde={prog.regels.hellingMin} min={0} max={60}
                onChange={v => zetRegel({ hellingMin: v })} />
              <Getal label="Dakhelling max" eenheid="°" waarde={prog.regels.hellingMax} min={10} max={70}
                onChange={v => zetRegel({ hellingMax: v })} />
            </div>
          )}

          <p className="voetnoot">Fase 1 is een vormstudie: materialen, licht, opslaan en opmerkingen volgen in de volgende fasen.</p>
        </aside>

        <main>
          <div className="setbalk">
            <button type="button" className="nieuweset" onClick={nieuweSet} disabled={laden}>
              Nieuwe varianten ↻
            </button>
            {laden && <span className="lader" aria-label="Bezig met genereren" />}
            <span className="settekst">{varianten.length} vormen bij dit programma · set {ronde + 1}</span>
          </div>
          <div className="varianten">
            {favoriet && (
              <VariantKaart v={favoriet} naam={naamVoor(favoriet, [favoriet])} prog={prog}
                favoriet opFavoriet={() => zetFavoriet(null)} opGroot={() => zetGroot(favoriet)} />
            )}
            {lijst.map(v => (
              <VariantKaart key={v.id} v={v} naam={naamVoor(v, varianten)} prog={prog}
                favoriet={false} opFavoriet={() => zetFavoriet(v)} opGroot={() => zetGroot(v)} />
            ))}
          </div>
        </main>
      </div>

      {groot && (
        <div className="grootvak" role="dialog" aria-label={groot.naam}>
          <button type="button" className="sluit" onClick={() => zetGroot(null)}>Sluiten ×</button>
          <div className="grootcanvas">
            <Woning3D spec={groot} programma={prog} groot />
          </div>
          <p className="groottitel">{groot.naam} · goot {groot.goot.toFixed(1)} m · nok {groot.nok.toFixed(1)} m</p>
        </div>
      )}
    </div>
  )
}
