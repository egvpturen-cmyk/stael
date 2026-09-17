import { useEffect, useRef, useState } from 'react'
import { sessieMaak, sessieLees } from './api.js'
import { maakFuncties } from './functies.js'
import { maakTekstAdapter, maakRealtimeAdapter } from './adapter.js'
import { COLLECTIE } from './collectie.js'

// De klantreis (/reis): een begeleide reis in stappen met de pratende
// Architect als gastheer. Stem en tekst zijn hetzelfde gesprek via twee
// kanalen; de app blijft zonder stem volledig bedienbaar en de
// sessie-state is altijd leidend.

const STAPPEN = ['Smaak', 'Kavel en programma', 'Modellen', 'Beelden']

const vak = { background: '#161618', border: '1px solid #2c2c30', borderRadius: 8 }

function Voortgang({ stap }) {
  return (
    <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
      {STAPPEN.map((naam, i) => {
        const nr = i + 1
        const actief = stap === nr
        const klaar = stap > nr
        return (
          <div key={naam} style={{
            display: 'flex', alignItems: 'center', gap: '.45rem',
            padding: '.35rem .7rem', borderRadius: 999,
            border: '1px solid ' + (actief ? '#e8873c' : '#2c2c30'),
            background: actief ? '#241a12' : '#161618',
            color: klaar ? '#8fc493' : actief ? '#e8e4dc' : '#77756f',
            fontSize: '.8rem', letterSpacing: '.04em',
          }}>
            <span style={{
              width: 20, height: 20, borderRadius: 999, display: 'grid', placeItems: 'center',
              background: klaar ? '#24321f' : actief ? '#e8873c' : '#232326',
              color: actief ? '#141414' : 'inherit', fontSize: '.72rem',
            }}>{klaar ? '✓' : nr}</span>
            {naam}
          </div>
        )
      })}
    </div>
  )
}

// Stap 1: de conceptcollectie met favorieten en het smaakprofiel. De
// kaarten gebruiken exact dezelfde functielaag als de stem: klikken en
// praten zijn hetzelfde gesprek.
function CollectieStap({ sessie, functies, meldArchitect }) {
  const [open, zetOpen] = useState(null)
  const [citaten, zetCitaten] = useState({})
  const [melding, zetMelding] = useState(null)
  const favorieten = sessie.smaak.favorieten

  async function toggleFavoriet(c) {
    const aan = !favorieten.includes(c.nummer)
    const r = await functies.voerUit('favorietKiezen', { nummer: c.nummer, aan })
    if (!r.ok) zetMelding(r.fout)
    else zetMelding(null)
  }

  async function bewaarCitaat(c) {
    const tekst = (citaten[c.nummer] || '').trim()
    if (!tekst) return
    await functies.voerUit('smaakToevoegen', { favoriet: c.nummer, familie: c.familie, citaat: tekst })
    zetCitaten(v => ({ ...v, [c.nummer]: '' }))
    meldArchitect('Genoteerd bij ' + c.naam + ': "' + tekst + '"')
  }

  async function rondAf() {
    const klaar = await functies.voerUit('stapAfronden', { stap: 1 })
    if (!klaar.ok) { zetMelding(klaar.fout); return }
    await functies.voerUit('naarStap', { stap: 2 })
    meldArchitect('Mooi, uw smaakprofiel staat. Dan gaan we nu naar uw kavel en programma.')
  }

  return (
    <div style={{ display: 'grid', gap: '.7rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '.5rem' }}>
        <span style={{ color: '#a7a49c', fontSize: '.88rem' }}>
          Kies 3 tot 5 ontwerpen die u aanspreken ({favorieten.length} gekozen)
        </span>
        <button type="button" className="nieuweset" disabled={favorieten.length < 3 || favorieten.length > 5}
          onClick={rondAf}>Smaak afronden</button>
      </div>
      {melding && <div style={{ ...vak, padding: '.5rem .8rem', color: '#d9b06a', fontSize: '.85rem' }}>{melding}</div>}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: '.7rem' }}>
        {COLLECTIE.map(c => {
          const fav = favorieten.includes(c.nummer)
          return (
            <div key={c.nummer} className={'collectiekaart' + (fav ? ' favoriet' : '')} style={{
              ...vak, overflow: 'hidden', cursor: 'pointer',
              outline: fav ? '2px solid #e8873c' : 'none',
            }}>
              <img src={'./collectie/' + c.bestand.replace('.png', '.jpg')} alt={c.naam} loading="lazy"
                onClick={() => toggleFavoriet(c)}
                style={{ width: '100%', aspectRatio: '4 / 3', objectFit: 'cover', display: 'block' }} />
              <div style={{ padding: '.55rem .7rem', display: 'grid', gap: '.3rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '.4rem', alignItems: 'baseline' }}>
                  <strong style={{ color: '#e8e4dc', letterSpacing: '.06em' }}>{c.naam}</strong>
                  <span style={{ color: '#77756f', fontSize: '.72rem' }}>nr {c.nummer} · familie {c.familie}</span>
                </div>
                <span style={{ color: '#a7a49c', fontSize: '.76rem', lineHeight: 1.35 }}>{c.materialen}</span>
                <button type="button" onClick={() => zetOpen(open === c.nummer ? null : c.nummer)}
                  style={{ justifySelf: 'start', background: 'none', border: 'none', color: '#e8873c', cursor: 'pointer', padding: 0, fontSize: '.76rem' }}>
                  {open === c.nummer ? 'minder' : 'meer over dit ontwerp'}
                </button>
                {open === c.nummer && (
                  <p style={{ color: '#c9c5bc', fontSize: '.8rem', lineHeight: 1.45, margin: 0 }}>{c.beschrijving}</p>
                )}
                {fav && (
                  <div style={{ display: 'flex', gap: '.4rem' }}>
                    <input value={citaten[c.nummer] || ''} placeholder="Wat spreekt u hierin aan?"
                      onChange={e => zetCitaten(v => ({ ...v, [c.nummer]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') bewaarCitaat(c) }}
                      style={{ flex: '1 1 120px', minWidth: 0, background: '#1c1c1f', color: '#e8e4dc', border: '1px solid #3a3a3e', borderRadius: 5, padding: '.35rem .5rem', fontSize: '.8rem' }} />
                    <button type="button" className="nieuweset" style={{ padding: '.3rem .6rem', fontSize: '.75rem' }}
                      onClick={() => bewaarCitaat(c)}>Noteer</button>
                  </div>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default function Reis() {
  const [token, zetToken] = useState(null)
  const [sessie, zetSessie] = useState(null)
  const [berichten, zetBerichten] = useState([])
  const [invoer, zetInvoer] = useState('')
  const [status, zetStatus] = useState('tekst')
  const [melding, zetMelding] = useState(null)
  const sessieRef = useRef({ huidige: null })
  const adapterRef = useRef(null)
  const functiesRef = useRef(null)
  const onderaan = useRef(null)

  const toonBericht = (rol, tekst, definitief = true) => {
    zetBerichten(b => {
      const kopie = [...b]
      const laatste = kopie[kopie.length - 1]
      if (laatste && laatste.rol === rol && !laatste.definitief) {
        kopie[kopie.length - 1] = { rol, tekst, definitief }
      } else {
        kopie.push({ rol, tekst, definitief })
      }
      return kopie
    })
  }

  // sessie starten of hervatten via ?s=token in de deelbare link
  useEffect(() => {
    (async () => {
      const url = new URL(location.href)
      const bestaand = url.searchParams.get('s')
      try {
        let t = bestaand, s = null
        if (bestaand) {
          try { s = (await sessieLees(bestaand)).sessie } catch { t = null }
        }
        if (!t) {
          const nieuw = await sessieMaak()
          t = nieuw.token; s = nieuw.sessie
          url.searchParams.set('s', t)
          history.replaceState(null, '', url.toString())
        }
        sessieRef.current.huidige = s
        zetToken(t); zetSessie(s)
        functiesRef.current = maakFuncties({
          token: t, sessieRef: { get huidige() { return sessieRef.current.huidige }, set huidige(v) { sessieRef.current.huidige = v; zetSessie(v) } },
          opUiSignaal: () => zetSessie({ ...sessieRef.current.huidige }),
        })
        toonBericht('architect', s.stap === 0
          ? 'Welkom bij STAEL. Ik ben de Architect en ik neem u in vier stappen mee naar uw woning: eerst uw smaak, dan uw kavel en programma, dan de modellen, en tot slot de beelden. Vindt u het prettig om te praten, of typt u liever?'
          : 'Welkom terug. We gaan verder waar we gebleven waren.')
      } catch (e) {
        zetMelding('De sessieopslag is even niet bereikbaar. Probeer het zo opnieuw.')
      }
    })()
  }, [])

  useEffect(() => { onderaan.current?.scrollIntoView({ behavior: 'smooth' }) }, [berichten])

  const koppelAdapter = a => {
    a.onTranscript = (rol, tekst, definitief) => toonBericht(rol, tekst, definitief)
    a.onFunctionCall = (naam, args) => functiesRef.current.voerUit(naam, args)
    a.onStatus = st => {
      if (st.startsWith('fout:')) {
        zetStatus('tekst')
        zetMelding(st.includes('429') || st.includes('tijd')
          ? 'De spreektijd voor vandaag is op; we gaan gewoon verder via tekst.'
          : 'De Architect is even niet te bereiken via spraak; we gaan verder via tekst.')
      }
    }
    adapterRef.current = a
    return a
  }

  const startTekst = () => koppelAdapter(maakTekstAdapter({ token }))

  async function startSpraak() {
    try {
      zetMelding(null)
      const url = new URL(location.href)
      const a = koppelAdapter(maakRealtimeAdapter({ token, stemOverride: url.searchParams.get('stem') || undefined }))
      zetStatus('spraak')
      await a.start()
      await functiesRef.current.voerUit('spraakVoorkeur', { spraak: true })
    } catch (e) {
      zetStatus('tekst')
      adapterRef.current = null
      zetMelding(e?.status === 429
        ? 'De spreektijd voor vandaag is op; we gaan gewoon verder via tekst.'
        : 'Spraak is nu niet beschikbaar (microfoon of dienst); we gaan verder via tekst.')
    }
  }

  async function verstuur() {
    const tekst = invoer.trim()
    if (!tekst || !token) return
    zetInvoer('')
    if (!adapterRef.current) startTekst()
    try {
      await adapterRef.current.zegTekst(tekst)
    } catch { /* status-handler meldt al */ }
  }

  // stap 0 blijft ook zonder taalmodel volledig bedienbaar: dezelfde
  // functies, maar dan via knoppen
  async function kiesSpraakVoorkeur(spraak) {
    if (spraak) { await startSpraak(); }
    else await functiesRef.current.voerUit('spraakVoorkeur', { spraak: false })
    await functiesRef.current.voerUit('stapAfronden', { stap: 0 })
    await functiesRef.current.voerUit('naarStap', { stap: 1 })
    toonBericht('architect', spraak
      ? 'Prima, dan praten we. We beginnen met uw smaak.'
      : 'Prima, dan typen we. We beginnen met uw smaak.')
  }

  function stopSpraak() {
    adapterRef.current?.stop()
    adapterRef.current = null
    zetStatus('tekst')
  }

  const stap = sessie?.stap ?? 0

  return (
    <div className="kalibratie" style={{ minHeight: '100vh' }}>
      <header>
        <img src="./wordmark.png" alt="STÆL" style={{ height: 22 }} />
        <span className="titel">DE ARCHITECT <em>begeleide klantreis</em></span>
      </header>

      <div style={{ maxWidth: 880, margin: '0 auto', padding: '1.1rem 1rem 2rem', display: 'grid', gap: '.9rem' }}>
        <Voortgang stap={stap} />

        {melding && (
          <div style={{ ...vak, padding: '.6rem .8rem', color: '#d9b06a', fontSize: '.85rem' }}>{melding}</div>
        )}

        <div className="gesprek" style={{ ...vak, padding: '1rem', display: 'grid', gap: '.6rem', minHeight: 260 }}>
          {berichten.map((b, i) => (
            <div key={i} className={'beurt-' + b.rol} style={{
              justifySelf: b.rol === 'klant' ? 'end' : 'start',
              maxWidth: '85%', padding: '.55rem .8rem', borderRadius: 10,
              background: b.rol === 'klant' ? '#2a2317' : '#1d1d21',
              border: '1px solid ' + (b.rol === 'klant' ? '#4a3a20' : '#2c2c30'),
              color: '#e8e4dc', lineHeight: 1.45, fontSize: '.92rem',
              opacity: b.definitief ? 1 : .75,
            }}>
              {b.rol === 'architect' && <span style={{ display: 'block', fontSize: '.68rem', letterSpacing: '.09em', color: '#e8873c', marginBottom: '.2rem' }}>DE ARCHITECT</span>}
              {b.tekst}
            </div>
          ))}
          <div ref={onderaan} />
        </div>

        {stap === 0 && sessie && (
          <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
            <button type="button" className="nieuweset" onClick={() => kiesSpraakVoorkeur(true)}>Praten is prima</button>
            <button type="button" className="nieuweset" onClick={() => kiesSpraakVoorkeur(false)}>Ik typ liever</button>
          </div>
        )}

        {stap === 1 && sessie && (
          <CollectieStap sessie={sessie} functies={functiesRef.current} meldArchitect={t => toonBericht('architect', t)} />
        )}

        {stap > 1 && (
          <div style={{ ...vak, padding: '.8rem', color: '#a7a49c', fontSize: '.88rem' }}>
            Stap {stap} ({STAPPEN[stap - 1]}) wordt in het volgende bouwdeel ingericht; het gesprek en uw sessie lopen gewoon door.
          </div>
        )}

        <div className="invoerbalk" style={{ display: 'flex', gap: '.55rem', flexWrap: 'wrap' }}>
          <input value={invoer} onChange={e => zetInvoer(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') verstuur() }}
            placeholder="Typ uw antwoord aan de Architect"
            style={{ flex: '1 1 200px', minWidth: 0, background: '#1c1c1f', color: '#e8e4dc', border: '1px solid #3a3a3e', borderRadius: 6, padding: '.6rem .7rem' }} />
          <button type="button" className="nieuweset" onClick={verstuur}>Verstuur</button>
          {status === 'spraak'
            ? <button type="button" className="nieuweset" onClick={stopSpraak} title="Stop het spraakgesprek">Stop spraak</button>
            : <button type="button" className="nieuweset" onClick={startSpraak} title="Start het spraakgesprek">🎙 Spreek</button>}
        </div>
        <p style={{ color: '#77756f', fontSize: '.78rem', margin: 0 }}>
          Alles wat de Architect zegt, leest u hier ook mee. Praten en typen zijn hetzelfde gesprek; u kunt altijd wisselen.
          Uw sessie is te hervatten via de link in de adresbalk.
        </p>
      </div>
    </div>
  )
}
