import { useEffect, useMemo, useRef, useState } from 'react'
import KernCanvas from '../kern/KernWoning.jsx'
import LuiCanvas from '../kern/LuiCanvas.jsx'
import { MATERIALEN } from '../kern/materialen.js'
import { herbouwVariant } from './smaakmotor.js'

// Stap 3: vijf modellen uit het smaakprofiel, het programma en de
// kavel. De klant kiest een variant en past hem aan in gesprek met de
// Architect; elke wijziging loopt via dezelfde functielaag door de
// bouwregels en is live zichtbaar op het 3D-model. Zonder stem is
// alles ook met knoppen bedienbaar.

const vak = { background: '#161618', border: '1px solid #2c2c30', borderRadius: 8 }

function VariantKaart({ v, gekozen, opKies, kavelOpp }) {
  return (
    <article className={'variant reisvariant' + (gekozen ? ' favoriet' : '')}>
      {gekozen && <span className="keuzelabel">Uw keuze</span>}
      <div className="canvasvak" style={{ position: 'relative' }}>
        <LuiCanvas><KernCanvas model={v.model} camera={v.kijk} kavel={kavelOpp} /></LuiCanvas>
      </div>
      <div className="variantinfo">
        <h3>{v.naam}</h3>
        <p className="smaakzin" style={{ color: '#E8B48C' }}>{v.smaakZin}</p>
        <p>{v.beschrijving}</p>
        <dl>
          <div><dt>Voetafdruk</dt><dd>{v.voet} m²</dd></div>
          <div><dt>Woonopp.</dt><dd>≈ {v.opp} m²</dd></div>
          <div><dt>Goot / nok</dt><dd>{v.goot.toFixed(1)} / {v.nok.toFixed(1)} m</dd></div>
        </dl>
        {!v.past && <p className="waarschuwing">Past niet volledig in het geschatte bouwvlak; bespreek een kleiner woonoppervlak of een extra laag.</p>}
        <div className="kaartknoppen">
          <button type="button" className={gekozen ? 'stil' : ''} onClick={opKies}>
            {gekozen ? 'Keuze loslaten' : 'Kies deze'}
          </button>
        </div>
      </div>
    </article>
  )
}

// knoppenbediening voor het aanpasgesprek: exact dezelfde functielaag
// als de stem, zodat praten en klikken hetzelfde doen
function AanpasPaneel({ functies, variant, opMelding, meldArchitect }) {
  const [matDoel, zetMatDoel] = useState('materialen.gevel')
  const cat = matDoel.endsWith('gevel') ? 'gevel' : matDoel.endsWith('dak') ? 'dak' : 'accent'
  const keuzes = Object.entries(MATERIALEN).filter(([, d]) => d.cat === cat)

  async function wijzig(pad, waarde) {
    const r = await functies.voerUit('parameterWijzigen', { pad, waarde })
    if (!r.ok) { opMelding(r.fout); return }
    opMelding(null)
    meldArchitect('Aangepast: ' + r.gewijzigd + ' naar ' + (typeof waarde === 'object' ? waarde.mat : waarde)
      + '. Voetafdruk ' + r.resultaat.voet + ' m2, goot ' + r.resultaat.goot + ' m, nok ' + r.resultaat.nok + ' m.')
  }
  const stapKnop = (pad, label, delta, huidig) => (
    <div style={{ display: 'flex', alignItems: 'center', gap: '.35rem' }}>
      <span style={{ color: '#a7a49c', fontSize: '.78rem', minWidth: 86 }}>{label}</span>
      <button type="button" className="nieuweset" style={{ padding: '.2rem .6rem' }}
        onClick={() => wijzig(pad, Number((huidig - delta).toFixed(2)))}>−</button>
      <button type="button" className="nieuweset" style={{ padding: '.2rem .6rem' }}
        onClick={() => wijzig(pad, Number((huidig + delta).toFixed(2)))}>+</button>
    </div>
  )
  const p = variant.params
  return (
    <div className="aanpaspaneel" style={{ display: 'grid', gap: '.6rem' }}>
      <div style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        {stapKnop('volume.goot', 'Goothoogte', .3, p.volume.goot)}
        {!p.volume.plat && stapKnop('volume.helling', 'Dakhelling', 4, p.volume.helling || 30)}
        {stapKnop('volume.b', 'Breedte', .5, p.volume.b)}
        {stapKnop('volume.d', 'Diepte', .5, p.volume.d)}
      </div>
      <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <select value={matDoel} onChange={e => zetMatDoel(e.target.value)}
          style={{ background: '#1c1c1f', color: '#e8e4dc', border: '1px solid #3a3a3e', padding: '.35rem .5rem' }}>
          <option value="materialen.gevel">Gevel</option>
          <option value="materialen.dak">Dak</option>
          <option value="materialen.accent">Accent</option>
        </select>
        <select value="" onChange={e => { if (e.target.value) wijzig(matDoel, e.target.value) }}
          style={{ background: '#1c1c1f', color: '#e8e4dc', border: '1px solid #3a3a3e', padding: '.35rem .5rem' }}>
          <option value="">kies materiaal…</option>
          {keuzes.map(([id, d]) => <option key={id} value={id}>{d.naam}</option>)}
        </select>
        <span style={{ color: '#77756f', fontSize: '.76rem' }}>
          U kunt dit ook gewoon aan de Architect vragen; elke wijziging gaat door de bouwregels.
        </span>
      </div>
    </div>
  )
}

export default function ModellenStap({ sessie, functies, meldArchitect }) {
  const [laden, zetLaden] = useState(false)
  const [melding, zetMelding] = useState(null)
  const gestart = useRef(false)
  const model = sessie.model

  async function genereer() {
    zetLaden(true); zetMelding(null)
    const r = await functies.voerUit('setVerversen', {})
    zetLaden(false)
    if (!r.ok) { zetMelding(r.fout); return }
    meldArchitect(model?.varianten?.length
      ? 'Hier is een nieuwe set; uw keuze staat er nog bij. Welke wilt u naast elkaar leggen?'
      : 'Hier zijn vijf modellen, gevormd door uw smaakprofiel, uw programma en uw kavel. Onder elk model staat waarom hij bij u past. Welke wilt u als uitgangspunt?')
  }

  useEffect(() => {
    if (!gestart.current && !(model?.varianten?.length)) {
      gestart.current = true
      genereer()
    }
  }, [])

  // modellen en camera worden uit de bewaarde params herbouwd; wat de
  // wetten niet meer haalt, verschijnt niet
  const gebouwd = useMemo(() =>
    (model?.varianten || []).map(v => herbouwVariant(v)).filter(Boolean),
  [model?.varianten])

  async function kies(v) {
    const r = await functies.voerUit('variantKiezen', { variantId: v.id })
    if (!r.ok) { zetMelding(r.fout); return }
    meldArchitect('Mooi, ' + v.naam + ' is het uitgangspunt. Wat wilt u aanpassen: maten, dak of materialen?')
  }

  async function rondAf() {
    const klaar = await functies.voerUit('stapAfronden', { stap: 3 })
    if (!klaar.ok) { zetMelding(klaar.fout); return }
    const volgende = await functies.voerUit('naarStap', { stap: 4 })
    meldArchitect(volgende.beschikbaar
      ? 'Uw model staat. Dan gaan we nu naar de beelden.'
      : 'Uw model staat vast in uw sessie. De fotostand volgt binnenkort.')
  }

  const gekozenId = model?.gekozenId || null
  const gekozen = gebouwd.find(v => v.id === gekozenId) || null
  const rest = gebouwd.filter(v => v.id !== gekozenId)
  const kavelOpp = model?.prog?.kavel

  return (
    <div style={{ display: 'grid', gap: '.7rem' }}>
      <div className="smaakbalk">
        <span className="stand">
          {laden ? 'De Architect tekent vijf modellen op uw smaak…'
            : gebouwd.length
              ? gebouwd.length + ' modellen uit uw smaakprofiel · set ' + ((model?.ronde ?? 0) + 1)
              : 'Nog geen modellen'}
        </span>
        <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
          <button type="button" className="nieuweset" disabled={laden} onClick={genereer}>Nieuwe varianten ↻</button>
          <button type="button" className="nieuweset" disabled={!gekozenId} onClick={rondAf}>Model afronden</button>
        </div>
      </div>

      {melding && <div style={{ ...vak, padding: '.5rem .8rem', color: '#d9b06a', fontSize: '.85rem' }}>{melding}</div>}

      {gekozen && (
        <div className="gekozenvak" style={{ ...vak, padding: '.9rem', display: 'grid', gap: '.7rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: '.5rem' }}>
            <strong style={{ color: '#e8e4dc', letterSpacing: '.05em' }}>{gekozen.naam} · uw uitgangspunt</strong>
            <span style={{ color: '#a7a49c', fontSize: '.82rem' }}>
              voetafdruk {gekozen.voet} m² · goot {gekozen.goot.toFixed(1)} m · nok {gekozen.nok.toFixed(1)} m
            </span>
          </div>
          <div className="grootcanvas" style={{ position: 'relative', aspectRatio: '16 / 9', minHeight: 280 }}>
            <KernCanvas model={gekozen.model} camera={{ ...gekozen.kijk, fov: 36 }} kavel={kavelOpp} />
          </div>
          <AanpasPaneel functies={functies} variant={gekozen} opMelding={zetMelding} meldArchitect={meldArchitect} />
          {(model?.wijzigingen || []).length > 0 && (
            <p style={{ color: '#77756f', fontSize: '.76rem', margin: 0 }}>
              Wijzigingen: {(model.wijzigingen || []).map(w => w.pad.split('.')[1] + ' → ' + (typeof w.waarde === 'object' ? w.waarde.mat : w.waarde)).join(' · ')}
            </p>
          )}
        </div>
      )}

      <div className="varianten">
        {laden
          ? [0, 1, 2].map(i => <article key={'sk' + i} className="variant" aria-hidden="true"><div className="canvasvak" style={{ opacity: .25 }} /></article>)
          : rest.map(v => (
            <VariantKaart key={v.id} v={v} gekozen={false} kavelOpp={kavelOpp}
              opKies={() => kies(v)} />
          ))}
      </div>
    </div>
  )
}
