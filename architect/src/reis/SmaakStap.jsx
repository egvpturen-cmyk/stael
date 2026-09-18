import { useEffect, useRef, useState } from 'react'
import { COLLECTIE } from './collectie.js'

// Stap 1: de conceptcollectie als cinematische show (naar de
// goedgekeurde show-referentie), maar interactief: de klant bladert
// zelf met pijlen, swipe en toetsenbord, springt via de filmstrip en
// kiest 3 tot 5 favorieten. Autoplay is een rustige standby-modus die
// bij elke interactie stopt. Maximaal twee slides in de DOM
// (dubbelbuffer); favorieten en citaten lopen door dezelfde
// functielaag als de stem.

const DUUR = 7000            // autoplay-tempo, zoals de show
const STANDBY_NA = 30000     // autoplay hervat na een halve minuut rust
const beeldUrl = c => './collectie/' + c.bestand

const rustigAan = () => typeof matchMedia !== 'undefined'
  && matchMedia('(prefers-reduced-motion: reduce)').matches

// het lasvonken-doek uit de referentie: langzaam stijgende gloeiende
// deeltjes plus bursts aan het einde van de lasnaad; pauzeert wanneer
// het tabblad niet zichtbaar is en ontbreekt bij reduced motion
function startVonken(canvas, burstRef) {
  if (rustigAan()) { burstRef.current = () => {}; return () => {} }
  const cx = canvas.getContext('2d')
  let P = [], actief = true, raf = 0
  const maat = () => {
    const r = canvas.parentElement.getBoundingClientRect()
    canvas.width = r.width; canvas.height = r.height
  }
  maat()
  const her = () => maat()
  addEventListener('resize', her)
  const vonk = (bx, by) => {
    const b = bx !== undefined
    return {
      x: b ? bx : Math.random() * canvas.width,
      y: b ? by : canvas.height + 10,
      vx: (Math.random() - .5) * (b ? 3.2 : .35),
      vy: b ? -(Math.random() * 2.6 + .6) : -(Math.random() * .55 + .22),
      r: Math.random() * 1.7 + .5,
      l: 1, verval: b ? .012 + Math.random() * .012 : .0016 + Math.random() * .0022,
      k: Math.random() < .35 ? '232,180,140' : '201,138,94',
    }
  }
  for (let i = 0; i < 40; i++) { const p = vonk(); p.y = Math.random() * canvas.height; P.push(p) }
  burstRef.current = (x, y, n = 22) => { for (let i = 0; i < n; i++) P.push(vonk(x, y)) }
  const teken = () => {
    if (!actief) return
    if (document.hidden) { raf = requestAnimationFrame(teken); return }
    cx.clearRect(0, 0, canvas.width, canvas.height)
    if (P.length < 44 && Math.random() < .3) P.push(vonk())
    P = P.filter(p => p.l > 0 && p.y > -20)
    for (const p of P) {
      p.x += p.vx; p.y += p.vy; p.vy += p.verval > .01 ? .05 : -.0004; p.l -= p.verval
      cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, 7)
      cx.fillStyle = 'rgba(' + p.k + ',' + Math.max(p.l, 0) * .85 + ')'
      cx.shadowColor = 'rgba(' + p.k + ',.9)'; cx.shadowBlur = 8
      cx.fill(); cx.shadowBlur = 0
    }
    raf = requestAnimationFrame(teken)
  }
  raf = requestAnimationFrame(teken)
  return () => { actief = false; cancelAnimationFrame(raf); removeEventListener('resize', her) }
}

// de koperen lasnaad die zich onder de naam last, met vonkenkop en een
// burst op het doek wanneer hij de overkant haalt
function lasEffect(slideEl, showEl, burst) {
  const lijn = slideEl.querySelector('.lasnaad')
  if (!lijn) return
  const i = lijn.querySelector('i'), b = lijn.querySelector('b')
  if (rustigAan()) { i.style.width = '100%'; return }
  const breed = lijn.getBoundingClientRect().width
  const t0 = performance.now(), T = 900, start = 650
  b.style.opacity = 0
  const stap = t => {
    if (!slideEl.isConnected) return
    const u = Math.min((t - t0 - start) / T, 1)
    if (u >= 0) {
      const e = 1 - Math.pow(1 - u, 3)
      i.style.width = (e * 100) + '%'
      b.style.opacity = u < 1 ? 1 : 0
      b.style.transform = 'translateX(' + (e * breed - 4) + 'px)'
      if (u >= 1) {
        const r = lijn.getBoundingClientRect(), h = showEl.getBoundingClientRect()
        burst(r.left - h.left + breed, r.top - h.top + 1, 22)
        return
      }
    }
    requestAnimationFrame(stap)
  }
  requestAnimationFrame(stap)
}

function Slide({ c, actief, weg, favoriet, opFavoriet, citaat, zetCitaat, opNoteer }) {
  return (
    <div className={'showslide' + (actief ? ' actief' : '') + (weg ? ' weg' : '')}>
      <div className="beeldkader">
        <img src={beeldUrl(c)} alt={c.naam} />
      </div>
      <div className="showtekst">
        <div className="spook">{String(c.nummer).padStart(2, '0')}</div>
        <div className="nr">N° {String(c.nummer).padStart(2, '0')}</div>
        <div className="naam">{c.naam}</div>
        <div className="lasnaad"><i /><b /></div>
        <div className="matkop">M A T E R I A L E N</div>
        <div className="mat">{c.materialen}</div>
        <div className="txt">{c.beschrijving}</div>
        <div className="favoriets">
          <button type="button" className={'favorietknop' + (favoriet ? ' gekozen' : '')}
            onClick={() => opFavoriet(c)}>
            {favoriet ? '✓ FAVORIET' : 'KIES ALS FAVORIET'}
          </button>
          {favoriet && (
            <div className="citaatrij">
              <input value={citaat} placeholder="Wat spreekt u hierin aan?"
                onChange={e => zetCitaat(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') opNoteer(c) }} />
              <button type="button" onClick={() => opNoteer(c)}>Noteer</button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function SmaakStap({ sessie, functies, meldArchitect }) {
  const [idx, zetIdx] = useState(0)
  const [vorigIdx, zetVorigIdx] = useState(null)
  const [citaten, zetCitaten] = useState({})
  const [melding, zetMelding] = useState(null)
  const showRef = useRef(null)
  const canvasRef = useRef(null)
  const burstRef = useRef(() => {})
  const autoplayTimer = useRef(null)
  const standbyTimer = useRef(null)
  const wegTimer = useRef(null)
  const touch = useRef(null)
  const favorieten = sessie.smaak.favorieten

  // vonkendoek starten en netjes opruimen
  useEffect(() => {
    const stop = startVonken(canvasRef.current, burstRef)
    return stop
  }, [])

  // bladeren: altijd direct; de oude slide fadet een seconde uit en
  // verdwijnt dan uit de DOM zodat er nooit meer dan twee staan
  const toon = nieuw => {
    const doel = (nieuw + COLLECTIE.length) % COLLECTIE.length
    if (doel === idx) return
    zetVorigIdx(idx)
    zetIdx(doel)
    zetMelding(null)
    clearTimeout(wegTimer.current)
    wegTimer.current = setTimeout(() => zetVorigIdx(null), 1050)
    const volgende = COLLECTIE[(doel + 1) % COLLECTIE.length]
    if (volgende) { const im = new Image(); im.src = beeldUrl(volgende) }
  }

  // lasnaad aansteken op de vers gemonteerde actieve slide
  useEffect(() => {
    const el = showRef.current?.querySelector('.showslide.actief')
    if (el) lasEffect(el, showRef.current, (x, y, n) => burstRef.current(x, y, n))
  }, [idx])

  // autoplay als standby: loopt tot de klant iets doet, en hervat pas
  // na een halve minuut zonder interactie
  const stopAutoplay = () => { clearTimeout(autoplayTimer.current); autoplayTimer.current = null }
  const planAutoplay = () => {
    stopAutoplay()
    if (rustigAan()) return
    autoplayTimer.current = setTimeout(function tik() {
      zetIdx(h => {
        const doel = (h + 1) % COLLECTIE.length
        zetVorigIdx(h)
        clearTimeout(wegTimer.current)
        wegTimer.current = setTimeout(() => zetVorigIdx(null), 1050)
        return doel
      })
      autoplayTimer.current = setTimeout(tik, DUUR)
    }, DUUR)
  }
  const interactie = () => {
    stopAutoplay()
    clearTimeout(standbyTimer.current)
    standbyTimer.current = setTimeout(planAutoplay, STANDBY_NA)
  }
  useEffect(() => {
    planAutoplay()
    return () => { stopAutoplay(); clearTimeout(standbyTimer.current); clearTimeout(wegTimer.current) }
  }, [])

  // toetsenbord hoort bij de show, maar nooit terwijl de klant typt
  useEffect(() => {
    const opToets = e => {
      const tag = e.target?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (e.key === 'ArrowRight') { interactie(); toon(idx + 1) }
      if (e.key === 'ArrowLeft') { interactie(); toon(idx - 1) }
    }
    addEventListener('keydown', opToets)
    return () => removeEventListener('keydown', opToets)
  })

  async function opFavoriet(c) {
    interactie()
    const aan = !favorieten.includes(c.nummer)
    const r = await functies.voerUit('favorietKiezen', { nummer: c.nummer, aan })
    if (!r.ok) { zetMelding(r.fout); return }
    zetMelding(null)
    if (aan) meldArchitect('Mooi, ' + c.naam + ' staat bij uw favorieten. Wat spreekt u erin aan: de vorm, het materiaal of de sfeer?')
  }

  async function opNoteer(c) {
    const tekst = (citaten[c.nummer] || '').trim()
    if (!tekst) return
    interactie()
    await functies.voerUit('smaakToevoegen', { favoriet: c.nummer, familie: c.familie, citaat: tekst })
    zetCitaten(v => ({ ...v, [c.nummer]: '' }))
    meldArchitect('Genoteerd bij ' + c.naam + ': "' + tekst + '"')
  }

  async function rondAf() {
    interactie()
    const klaar = await functies.voerUit('stapAfronden', { stap: 1 })
    if (!klaar.ok) { zetMelding(klaar.fout); return }
    await functies.voerUit('naarStap', { stap: 2 })
    meldArchitect('Mooi, uw smaakprofiel staat. Dan gaan we nu naar uw kavel en programma.')
  }

  const opTouchStart = e => { touch.current = e.touches[0].clientX }
  const opTouchEnd = e => {
    if (touch.current === null) return
    const dx = e.changedTouches[0].clientX - touch.current
    touch.current = null
    if (Math.abs(dx) > 40) { interactie(); toon(dx < 0 ? idx + 1 : idx - 1) }
  }

  const c = COLLECTIE[idx]
  const vorig = vorigIdx !== null && vorigIdx !== idx ? COLLECTIE[vorigIdx] : null

  return (
    <div style={{ display: 'grid', gap: '.7rem' }}>
      <div className="smaakbalk">
        <span className="stand">
          Kies 3 tot 5 ontwerpen die u aanspreken ({favorieten.length} gekozen)
        </span>
        <button type="button" className="nieuweset" disabled={favorieten.length < 3 || favorieten.length > 5}
          onClick={rondAf}>Smaak afronden</button>
      </div>

      <div className="smaakshow" ref={showRef} onTouchStart={opTouchStart} onTouchEnd={opTouchEnd}>
        <canvas className="vonken" ref={canvasRef} />
        <div className="showkop">
          <span className="teller"><b>{String(idx + 1).padStart(2, '0')}</b> / {COLLECTIE.length}</span>
          <span className="teller"><b>{favorieten.length}</b> FAVORIET{favorieten.length === 1 ? '' : 'EN'}</span>
        </div>
        <div className="showpodium">
          {vorig && (
            <Slide key={'weg-' + vorig.nummer} c={vorig} weg
              favoriet={favorieten.includes(vorig.nummer)}
              opFavoriet={() => {}} citaat="" zetCitaat={() => {}} opNoteer={() => {}} />
          )}
          <Slide key={c.nummer} c={c} actief
            favoriet={favorieten.includes(c.nummer)}
            opFavoriet={opFavoriet}
            citaat={citaten[c.nummer] || ''}
            zetCitaat={t => zetCitaten(v => ({ ...v, [c.nummer]: t }))}
            opNoteer={opNoteer} />
        </div>
        {melding && <div className="showmelding">{melding}</div>}
        <div className="showvoet">
          <span className="hint">PIJLTJES = BLADEREN · SWIPE OP TOUCH</span>
          <div className="showknoppen">
            <button type="button" aria-label="Vorige" onClick={() => { interactie(); toon(idx - 1) }}>&#8592;</button>
            <button type="button" aria-label="Volgende" onClick={() => { interactie(); toon(idx + 1) }}>&#8594;</button>
          </div>
        </div>
      </div>

      <div className="filmstrip">
        {COLLECTIE.map((k, i) => (
          <button key={k.nummer} type="button"
            className={(i === idx ? 'actief ' : '') + (favorieten.includes(k.nummer) ? 'fav' : '')}
            title={k.naam + ' (nr ' + k.nummer + ')'}
            onClick={() => { interactie(); toon(i) }}>
            <img src={beeldUrl(k)} alt={k.naam} loading="lazy" />
          </button>
        ))}
      </div>
    </div>
  )
}
