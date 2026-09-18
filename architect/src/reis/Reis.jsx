import { useEffect, useRef, useState } from 'react'
import { sessieMaak, sessieLees } from './api.js'
import { maakFuncties } from './functies.js'
import { maakTekstAdapter, maakRealtimeAdapter } from './adapter.js'
import { zetPdokFixture } from './pdok.js'
import KavelStap from './KavelStap.jsx'
import SmaakStap from './SmaakStap.jsx'
import ModellenStap from './ModellenStap.jsx'

// De klantreis (/reis): een begeleide reis in stappen met de pratende
// Architect als gastheer. Stem en tekst zijn hetzelfde gesprek via twee
// kanalen; de app blijft zonder stem volledig bedienbaar en de
// sessie-state is altijd leidend.

const STAPPEN = ['Smaak', 'Kavel en programma', 'Modellen', 'Beelden']

const vak = { background: '#161618', border: '1px solid #2c2c30', borderRadius: 8 }

// compacte voortgang voor in de kopbalk: bolletjes per stap, alleen
// de actieve stap draagt zijn naam
function Voortgang({ stap }) {
  return (
    <div className="kopvoortgang" style={{ display: 'flex', gap: '.35rem', alignItems: 'center' }}>
      {STAPPEN.map((naam, i) => {
        const nr = i + 1
        const actief = stap === nr
        const klaar = stap > nr
        return (
          <div key={naam} style={{
            display: 'flex', alignItems: 'center', gap: '.35rem',
            padding: actief ? '.2rem .6rem .2rem .2rem' : '.2rem',
            borderRadius: 999,
            border: '1px solid ' + (actief ? '#e8873c' : '#2c2c30'),
            background: actief ? '#241a12' : 'transparent',
            color: klaar ? '#8fc493' : actief ? '#e8e4dc' : '#77756f',
            fontSize: '.72rem', letterSpacing: '.04em', whiteSpace: 'nowrap',
          }}>
            <span style={{
              width: 18, height: 18, borderRadius: 999, display: 'grid', placeItems: 'center',
              background: klaar ? '#24321f' : actief ? '#e8873c' : '#232326',
              color: actief ? '#141414' : 'inherit', fontSize: '.66rem',
            }}>{klaar ? '✓' : nr}</span>
            {actief && naam}
          </div>
        )
      })}
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
  const [kavelBron, zetKavelBron] = useState(null)
  const [tekenVraag, zetTekenVraag] = useState(0)
  const [gesprekOpen, zetGesprekOpen] = useState(false)
  const gesprekRef = useRef(null)
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
      if (url.searchParams.get('fixture') === '1') zetPdokFixture(true)
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
          opUiSignaal: (naam, data) => {
            if (naam === 'kavelBron') { zetKavelBron(data); zetMelding(null) }
            if (naam === 'kavelFout') zetMelding('De percelen konden niet geladen worden; probeer het opnieuw.')
            if (naam === 'tekenModus' && data?.aan) zetTekenVraag(v => v + 1)
            zetSessie({ ...sessieRef.current.huidige })
          },
        })
        toonBericht('architect', s.stap === 0
          ? 'Welkom bij STAEL. Ik ben de Architect en ik neem u in vier stappen mee naar uw woning: eerst uw smaak, dan uw kavel en programma, dan de modellen, en tot slot de beelden. Vindt u het prettig om te praten, of typt u liever?'
          : 'Welkom terug. We gaan verder waar we gebleven waren.')
      } catch (e) {
        zetMelding('De sessieopslag is even niet bereikbaar. Probeer het zo opnieuw.')
      }
    })()
  }, [])

  // het gesprek scrolt binnen zijn eigen kolom; het podium beweegt
  // nooit mee met nieuwe beurten
  useEffect(() => {
    const el = gesprekRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [berichten, gesprekOpen])

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
  const laatsteArchitect = [...berichten].reverse().find(b => b.rol === 'architect')?.tekst || 'De Architect luistert mee.'

  return (
    <div className="reis">
      <header className="reiskop">
        <img src="./wordmark.png" alt="STÆL" style={{ height: 20 }} />
        <span className="titel">DE ARCHITECT <em>begeleide klantreis</em></span>
        <Voortgang stap={stap} />
      </header>

      <div className="reisvlak">
        {/* het podium: hier gebeurt alles */}
        <main className="podium">
          {melding && (
            <div style={{ ...vak, padding: '.6rem .8rem', color: '#d9b06a', fontSize: '.85rem', marginBottom: '.8rem' }}>{melding}</div>
          )}

          {stap === 0 && sessie && (
            <div className="ontvangst" style={{ ...vak, maxWidth: 560, margin: '8vh auto 0', padding: '1.4rem', display: 'grid', gap: '.9rem', justifyItems: 'start' }}>
              <strong style={{ color: '#e8e4dc', letterSpacing: '.06em' }}>Welkom bij STÆL</strong>
              <p style={{ color: '#a7a49c', margin: 0, lineHeight: 1.55, fontSize: '.9rem' }}>
                De Architect neemt u in vier stappen mee naar uw woning: uw smaak, uw kavel en programma, de modellen en de beelden.
              </p>
              <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
                <button type="button" className="nieuweset" onClick={() => kiesSpraakVoorkeur(true)}>Praten is prima</button>
                <button type="button" className="nieuweset" onClick={() => kiesSpraakVoorkeur(false)}>Ik typ liever</button>
              </div>
            </div>
          )}

          {stap === 1 && sessie && (
            <SmaakStap sessie={sessie} functies={functiesRef.current} meldArchitect={t => toonBericht('architect', t)} />
          )}

          {stap === 2 && sessie && (
            <KavelStap sessie={sessie} functies={functiesRef.current} kavelBron={kavelBron}
              tekenVraag={tekenVraag} meldArchitect={t => toonBericht('architect', t)} />
          )}

          {stap === 3 && sessie && (
            <ModellenStap sessie={sessie} functies={functiesRef.current}
              meldArchitect={t => toonBericht('architect', t)} />
          )}

          {stap > 3 && (
            <div style={{ ...vak, padding: '.8rem', color: '#a7a49c', fontSize: '.88rem' }}>
              Stap {stap} ({STAPPEN[stap - 1]}) wordt in het volgende bouwdeel ingericht; het gesprek en uw sessie lopen gewoon door.
            </div>
          )}
        </main>

        {/* het gesprek: eigen kolom rechts, op mobiel een uitklapbalk */}
        <aside className={'gesprekspaneel' + (gesprekOpen ? ' open' : '')}>
          <button type="button" className="gesprekgreep" onClick={() => zetGesprekOpen(o => !o)}
            aria-label={gesprekOpen ? 'Gesprek inklappen' : 'Gesprek uitklappen'}>
            <span className="ondertitelmini">{laatsteArchitect}</span>
            <span style={{ flex: 'none', color: '#e8873c' }}>{gesprekOpen ? '▾' : '▴'}</span>
          </button>
          <div className="gesprek" ref={gesprekRef}>
            {berichten.map((b, i) => (
              <div key={i} className={'beurt-' + b.rol} style={{
                justifySelf: b.rol === 'klant' ? 'end' : 'start',
                maxWidth: '92%', padding: '.5rem .75rem', borderRadius: 10,
                background: b.rol === 'klant' ? '#2a2317' : '#1d1d21',
                border: '1px solid ' + (b.rol === 'klant' ? '#4a3a20' : '#2c2c30'),
                color: '#e8e4dc', lineHeight: 1.45, fontSize: '.88rem',
                opacity: b.definitief ? 1 : .75,
              }}>
                {b.rol === 'architect' && <span style={{ display: 'block', fontSize: '.66rem', letterSpacing: '.09em', color: '#e8873c', marginBottom: '.15rem' }}>DE ARCHITECT</span>}
                {b.tekst}
              </div>
            ))}
            <div ref={onderaan} />
          </div>
          <div className="invoerbalk">
            <input value={invoer} onChange={e => zetInvoer(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') verstuur() }}
              placeholder="Typ uw antwoord aan de Architect"
              style={{ flex: '1 1 auto', minWidth: 0, background: '#1c1c1f', color: '#e8e4dc', border: '1px solid #3a3a3e', borderRadius: 6, padding: '.55rem .65rem' }} />
            <button type="button" className="nieuweset invoerknop" onClick={verstuur}>Verstuur</button>
            {status === 'spraak'
              ? <button type="button" className="nieuweset invoerknop" onClick={stopSpraak} title="Stop het spraakgesprek">⏹ Stop</button>
              : <button type="button" className="nieuweset invoerknop" onClick={startSpraak} title="Start het spraakgesprek">🎙</button>}
          </div>
          <p className="gesprekhint">
            Praten en typen zijn hetzelfde gesprek; u kunt altijd wisselen. Uw sessie is te hervatten via de link in de adresbalk.
          </p>
        </aside>
      </div>
    </div>
  )
}
