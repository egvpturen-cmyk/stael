import { useMemo, useState, useEffect } from 'react'
import { genereerVariantenAsync } from './kern/variantenParallel.js'
import { REGELS_DEFAULT } from './ontwerptaal.js'
import { MATERIALEN } from './kern/materialen.js'
import KernCanvas from './kern/KernWoning.jsx'
import LuiCanvas from './kern/LuiCanvas.jsx'

// materiaal- en kleurkeuze per vlak, live op het grote model
function MateriaalPaneel({ mats, volumes, onWijzig }) {
  const [doel, zetDoel] = useState('gevel:standaard')
  const doelen = [
    ['gevel:standaard', volumes.length > 1 ? 'Gevel (alles)' : 'Gevel'],
    ...(volumes.length > 1 ? volumes.map(v => ['gevel:' + v.id, 'Gevel ' + v.id]) : []),
    ['dak', 'Dak'], ['daklijnen', 'Daklijnen'], ['accent', 'Accenten'],
  ]
  const cat = doel.startsWith('gevel') ? 'gevel' : doel === 'accent' ? 'accent' : 'dak'
  const keuzes = Object.entries(MATERIALEN).filter(([, d]) => d.cat === cat)
  const huidig = doel === 'dak' ? mats.dak
    : doel === 'daklijnen' ? (mats.daklijnen || mats.dak)
    : doel === 'accent' ? mats.accent
    : (doel === 'gevel:standaard' ? mats.gevels.standaard
      : mats.gevels[doel.slice(6)] || mats.gevels.standaard)
  const kies = (mat, kleur) => onWijzig(doel, { mat, kleur })
  const defHuidig = MATERIALEN[huidig.mat]
  return (
    <div className="materiaalpaneel" style={{ display: 'grid', gap: '.55rem' }}>
      <div className="knopgroep" style={{ flexWrap: 'wrap' }}>
        {doelen.map(([id, naam]) => (
          <button key={id} type="button" className={id === doel ? 'actief' : ''}
            onClick={() => zetDoel(id)}>{naam}</button>
        ))}
      </div>
      <select value={huidig.mat}
        onChange={e => kies(e.target.value, MATERIALEN[e.target.value].kleuren[0].id)}
        style={{ background: '#1c1c1f', color: '#e8e4dc', border: '1px solid #3a3a3e', padding: '.4rem .5rem' }}>
        {keuzes.map(([id, d]) => <option key={id} value={id}>{d.naam}</option>)}
      </select>
      <div style={{ display: 'flex', gap: '.35rem', flexWrap: 'wrap' }}>
        {(defHuidig?.kleuren || []).map(k => (
          <button key={k.id} type="button" title={k.naam}
            onClick={() => kies(huidig.mat, k.id)}
            style={{
              width: 30, height: 30, borderRadius: 4, background: k.hex, cursor: 'pointer',
              border: huidig.kleur === k.id && !huidig.hex ? '2px solid #e8873c' : '1px solid #55555a',
            }} />
        ))}
      </div>
    </div>
  )
}

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

function VariantKaart({ v, naam, favoriet, opFavoriet, opGroot }) {
  return (
    <article className={'variant' + (favoriet ? ' favoriet' : '')}>
      {favoriet && <span className="keuzelabel">Jouw keuze</span>}
      <div className="canvasvak" style={{ position: 'relative' }}>
        <LuiCanvas><KernCanvas model={v.model} camera={v.kijk} kavel={v.kavel} /></LuiCanvas>
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

// startpunten voor "verzin het voor mij": herkenbare situaties, de
// generator en de materiaalpresets doen de rest
const ARCHETYPES = [
  { kavel: 500, bouwvlak: 110, woonopp: 110, lagen: 1, dak: 'zadel' },
  { kavel: 800, bouwvlak: 150, woonopp: 160, lagen: 2, dak: 'zadel' },
  { kavel: 1500, bouwvlak: 240, woonopp: 240, lagen: 2, dak: 'mix' },
  { kavel: 900, bouwvlak: 160, woonopp: 180, lagen: 2, dak: 'plat' },
]

export default function App() {
  const [prog, zetProg] = useState(START)
  const [regelsOpen, zetRegelsOpen] = useState(false)
  const [groot, zetGroot] = useState(null)
  const [ronde, zetRonde] = useState(0)
  const [favoriet, zetFavoriet] = useState(null)
  const [varianten, zetVarianten] = useState([])
  const [laden, zetLaden] = useState(true)
  const [verzonnen, zetVerzonnen] = useState(0)

  useEffect(() => {
    let actueel = true
    zetLaden(true)
    genereerVariantenAsync(prog, ronde).then(lijst => {
      if (!actueel) return
      zetVarianten(lijst.map(v => ({ ...v, kavel: prog.kavel })))
      zetLaden(false)
    })
    return () => { actueel = false }
  }, [prog, ronde])

  const zet = deel => { zetProg(p => ({ ...p, ...deel })); zetRonde(0) }
  const zetRegel = deel => { zetProg(p => ({ ...p, regels: { ...p.regels, ...deel } })); zetRonde(0) }

  function nieuweSet() { zetRonde(r => r + 1) }

  function verzinVoorMij() {
    const keuze = ARCHETYPES[verzonnen % ARCHETYPES.length]
    zetVerzonnen(n => n + 1)
    zetProg(p => ({ ...p, ...keuze }))
    zetRonde(verzonnen * 3 + 1)
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
            <button type="button" className="nieuweset" onClick={verzinVoorMij} disabled={laden}>
              Verzin het voor mij
            </button>
            {laden && <span className="lader" aria-label="Bezig met genereren" />}
            <span className="settekst">
              {laden ? 'De architect tekent...' : varianten.length + ' vormen bij dit programma · set ' + (ronde + 1)}
            </span>
          </div>
          <div className="varianten">
            {laden ? (
              // tijdens het genereren geen actieve canvases: alle
              // rekenkracht gaat naar de workers
              [0, 1, 2].map(i => (
                <article key={'skelet' + i} className="variant" aria-hidden="true">
                  <div className="canvasvak" style={{ opacity: .25 }} />
                </article>
              ))
            ) : (
              <>
                {favoriet && (
                  <VariantKaart v={favoriet} naam={naamVoor(favoriet, [favoriet])} prog={prog}
                    favoriet opFavoriet={() => zetFavoriet(null)} opGroot={() => zetGroot(favoriet)} />
                )}
                {lijst.map(v => (
                  <VariantKaart key={v.id} v={v} naam={naamVoor(v, varianten)} prog={prog}
                    favoriet={false} opFavoriet={() => zetFavoriet(v)} opGroot={() => zetGroot(v)} />
                ))}
              </>
            )}
          </div>
        </main>
      </div>

      {groot && <GrootVak groot={groot} sluit={() => zetGroot(null)} />}
    </div>
  )
}

function GrootVak({ groot, sluit }) {
  const [mats, zetMats] = useState(groot.model.materialen)
  const model = useMemo(() => ({ ...groot.model, materialen: mats }), [groot, mats])
  const onWijzig = (doel, keuze) => zetMats(m => {
    if (doel === 'dak') return { ...m, dak: keuze }
    if (doel === 'daklijnen') return { ...m, daklijnen: keuze }
    if (doel === 'accent') return { ...m, accent: { ...keuze, forceer: true } }
    if (doel === 'gevel:standaard') return { ...m, gevels: { standaard: keuze } }
    return { ...m, gevels: { ...m.gevels, [doel.slice(6)]: keuze } }
  })
  return (
    <div className="grootvak" role="dialog" aria-label={groot.naam}>
      <button type="button" className="sluit" onClick={sluit}>Sluiten ×</button>
      <div className="grootcanvas">
        <KernCanvas model={model} camera={{ ...groot.kijk, fov: 36 }} kavel={groot.kavel} />
      </div>
      <div style={{ display: 'grid', gap: '.6rem', paddingTop: '.6rem' }}>
        <p className="groottitel" style={{ margin: 0 }}>
          {groot.naam} · goot {groot.goot.toFixed(1)} m · nok {groot.nok.toFixed(1)} m
        </p>
        <MateriaalPaneel mats={mats} volumes={groot.model.volumes} onWijzig={onWijzig} />
      </div>
    </div>
  )
}
