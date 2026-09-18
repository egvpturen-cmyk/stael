// Het lasvonken-doek van de site en de collectieshow: langzaam
// stijgende gloeiende deeltjes plus bursts. Pauzeert wanneer het
// tabblad niet zichtbaar is en ontbreekt bij reduced motion.
export const rustigAan = () => typeof matchMedia !== 'undefined'
  && matchMedia('(prefers-reduced-motion: reduce)').matches

export function startVonken(canvas, burstRef) {
  if (rustigAan() || !canvas) { if (burstRef) burstRef.current = () => {}; return () => {} }
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
  if (burstRef) burstRef.current = (x, y, n = 22) => { for (let i = 0; i < n; i++) P.push(vonk(x, y)) }
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
