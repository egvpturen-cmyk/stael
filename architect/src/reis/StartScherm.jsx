import { useEffect, useRef, useState } from 'react'
import { startVonken, rustigAan } from './vonken.js'

// Het startscherm van de reis: dezelfde intro als de website (de zoom
// door de AE van het logo, met de lasvonken en het donkere doek), maar
// de zoom eindigt hier in het startscherm van de reis: het logo boven
// en een grote koperen knop. Het mechanisme is overgenomen van de
// site, inclusief de GPU-begrenzing van de eindschaal en de meting van
// de maskerpositie op het eindlogo (mobiele centrering). Een klik
// tijdens de animatie slaat hem over; bij hervatten of reduced motion
// speelt hij niet.

export default function StartScherm({ hervatten, onStart }) {
  const wrapRef = useRef(null)
  const fotoRef = useRef(null)
  const startLogoRef = useRef(null)
  const doekRef = useRef(null)
  const vlakRef = useRef(null)
  const canvasRef = useRef(null)
  const eindLogoRef = useRef(null)
  const klaarRef = useRef(false)
  const [klaar, zetKlaar] = useState(false)

  useEffect(() => {
    const stopVonken = startVonken(canvasRef.current, null)
    const wrap = wrapRef.current, foto = fotoRef.current, startLogo = startLogoRef.current
    const doek = doekRef.current, vlak = vlakRef.current, eindLogo = eindLogoRef.current

    // maskerpositie en zoomoorsprong gemeten op de eindpositie van het
    // logo, zodat de zoom ook op mobiel exact in de AE eindigt
    function zoomOrigin() {
      const wrapR = wrap.getBoundingClientRect(), logoR = eindLogo.getBoundingClientRect()
      const left = logoR.left - wrapR.left, top = logoR.top - wrapR.top, w = logoR.width
      wrap.style.webkitMaskPosition = left + 'px ' + top + 'px'
      wrap.style.maskPosition = left + 'px ' + top + 'px'
      wrap.style.webkitMaskSize = w + 'px auto'
      wrap.style.maskSize = w + 'px auto'
      startLogo.style.left = left + 'px'; startLogo.style.top = top + 'px'; startLogo.style.width = w + 'px'
      const ox = left + .57 * w, oy = top + .66 * w // midden van de AE in het vierkante logobeeld
      wrap.style.transformOrigin = ox + 'px ' + oy + 'px'
      foto.style.transformOrigin = ox + 'px ' + oy + 'px'
    }

    function eindstand() {
      klaarRef.current = true
      wrap.style.visibility = 'hidden'
      startLogo.style.opacity = 0
      vlak.style.opacity = 1
      doek.style.opacity = 1
      zetKlaar(true)
    }

    if (hervatten || rustigAan()) { eindstand(); return () => stopVonken() }

    zoomOrigin()
    addEventListener('resize', zoomOrigin)
    // begrens de eindschaal: anders wordt de gemaskeerde laag op
    // mobiel groter dan de GPU-limiet
    const maxS = Math.min(Math.max(14000 / (Math.max(innerWidth, innerHeight) * Math.min(devicePixelRatio || 1, 3)), 8), 42)
    const t0 = performance.now()
    let raf = 0
    function frame(t) {
      if (klaarRef.current) return
      const ms = t - t0
      if (ms < 700) { // massief logo fadet in
        startLogo.style.opacity = ms / 700
        wrap.style.opacity = 0
      } else if (ms < 1500) { // crossfade: logo naar foto door de letters
        const k = (ms - 700) / 800
        startLogo.style.opacity = 1 - k
        wrap.style.opacity = k
      } else { // zoom door de AE naar binnen
        startLogo.style.opacity = 0
        wrap.style.opacity = 1
        const p = Math.min((ms - 1500) / 2300, 1)
        const e = p < .5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
        const s = 1 + Math.pow(e, 1.45) * maxS
        wrap.style.transform = 'scale(' + s + ')'
        foto.style.transform = 'scale(' + (1 / s) + ')'
        doek.style.opacity = e > .62 ? Math.min((e - .62) / .3, 1) : 0
        vlak.style.opacity = e > .7 ? Math.min((e - .7) / .28, 1) : 0
        if (e > .82) zetKlaar(true)
        if (p >= 1) { eindstand(); return }
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    const slaOverBijKlik = () => { if (!klaarRef.current) { cancelAnimationFrame(raf); eindstand() } }
    const el = wrap.parentElement
    el.addEventListener('pointerdown', slaOverBijKlik)
    return () => {
      cancelAnimationFrame(raf)
      removeEventListener('resize', zoomOrigin)
      el.removeEventListener('pointerdown', slaOverBijKlik)
      stopVonken()
    }
  }, [])

  return (
    <div className="introscherm">
      <canvas className="vonken" ref={canvasRef} />
      <div className="introwrap" ref={wrapRef}>
        <div className="introfoto" ref={fotoRef} />
      </div>
      <img className="introstartlogo" ref={startLogoRef} src="./intro/logo.png" alt="" />
      <div className="introvlak" ref={vlakRef} />
      <div className="introdoek" ref={doekRef} />
      <div className={'introeinde' + (klaar ? ' zichtbaar' : '')}>
        <img className="introeindlogo" ref={eindLogoRef} src="./intro/logo.png" alt="STÆL" />
        <button type="button" className="startknop" onClick={onStart}>
          {hervatten ? 'Verder met uw ontwerpreis' : 'Ontmoet de architect'}
        </button>
      </div>
    </div>
  )
}
