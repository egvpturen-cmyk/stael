import { useEffect, useRef, useState } from 'react'

// mount de inhoud (een WebGL-canvas) pas wanneer het vak bijna in beeld
// is: pagina's met veel zichten blijven zo binnen de contextlimiet van
// de browser en het scrollen blijft vloeiend
export default function LuiCanvas({ children }) {
  const ref = useRef(null)
  const [zichtbaar, zetZichtbaar] = useState(false)
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => zetZichtbaar(e.isIntersecting), { rootMargin: '260px' })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [])
  return <div ref={ref} style={{ position: 'absolute', inset: 0 }}>{zichtbaar ? children : null}</div>
}
