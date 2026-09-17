import * as THREE from 'three'
import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows, Line } from '@react-three/drei'
import { STAEL, KLEUREN } from './ontwerptaal.js'

const MAT = {
  // metalness laag houden: zonder environment-map reflecteert metaal zwart
  kozijn: new THREE.MeshStandardMaterial({ color: STAEL.kozijnKleur, roughness: .5, metalness: .2 }),
  glas: new THREE.MeshStandardMaterial({ color: '#33404a', roughness: .12, metalness: .3 }),
  staal: new THREE.MeshStandardMaterial({ color: '#26262a', roughness: .45, metalness: .35 }),
  gras: new THREE.MeshStandardMaterial({ color: '#3a4630', roughness: 1 }),
  terras: new THREE.MeshStandardMaterial({ color: '#6e685d', roughness: .95 }),
  houtAccent: new THREE.MeshStandardMaterial({ color: '#8a7a5e', roughness: .8 }),
  baksteen: new THREE.MeshStandardMaterial({ color: KLEUREN.baksteen, roughness: .95 }),
  licht: new THREE.MeshStandardMaterial({ color: KLEUREN.stucLicht, roughness: .9 }),
}
const stdMat = kleur => new THREE.MeshStandardMaterial({ color: kleur, roughness: .85 })
const dakMatVan = kleur => new THREE.MeshStandardMaterial({ color: kleur, roughness: .6, metalness: .12 })

// nokrand van het gevelprofiel: y van de dakrand op positie x
function randYOp(x, b, goot, nok, nokOffset = 0, marge = 0) {
  if (nok <= goot) return goot - marge
  const t = nokOffset
  if (x <= t) return goot + (nok - goot) * ((x + b / 2) / (t + b / 2)) - marge
  return goot + (nok - goot) * ((b / 2 - x) / (b / 2 - t)) - marge
}

// gevelprofiel (vijfhoek of rechthoek), geextrudeerd over de diepte
function Volume({ b, d, goot, nok, nokOffset = 0, kleur, plat }) {
  const geo = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-b / 2, 0); s.lineTo(b / 2, 0); s.lineTo(b / 2, goot)
    if (!plat && nok > goot) s.lineTo(nokOffset, nok)
    s.lineTo(-b / 2, goot); s.closePath()
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false })
    g.translate(0, 0, -d / 2)
    return g
  }, [b, d, goot, nok, nokOffset, plat])
  const mat = useMemo(() => stdMat(kleur), [kleur])
  return <mesh geometry={geo} material={mat} />
}

// dakplaten die de (eventueel asymmetrische) kap volgen; veranda trekt
// het dakvlak aan de kopzijde door op stalen kolommen
// veranda: 0 of {diepte, kolommen} (aantal kolommen per gootzijde)
function Dakplaten({ b, d, goot, nok, nokOffset = 0, overstek, kleur, plat, veranda = 0, zijLuifel = null }) {
  const vDiepte = veranda ? (veranda.diepte ?? veranda) : 0
  const vKolommen = veranda ? (veranda.kolommen ?? 2) : 2
  const mat = useMemo(() => dakMatVan(kleur), [kleur])
  const diepte = d + 2 * overstek + vDiepte
  const zMid = vDiepte / 2
  if (plat) {
    return (
      <mesh material={mat} position={[0, goot + .11, zMid]}>
        <boxGeometry args={[b + 2 * overstek, .22, diepte]} />
      </mesh>
    )
  }
  const zijden = [
    { van: [-b / 2, goot], tot: [nokOffset, nok], kant: -1 },
    { van: [nokOffset, nok], tot: [b / 2, goot], kant: 1 },
  ]
  return (
    <group>
      {zijden.map((zi, i) => {
        const dx = zi.tot[0] - zi.van[0], dy = zi.tot[1] - zi.van[1]
        let len = Math.hypot(dx, dy) + overstek * 1.4
        const hoek = Math.atan2(dy, dx)
        let cx = (zi.van[0] + zi.tot[0]) / 2, cy = (zi.van[1] + zi.tot[1]) / 2
        // zijwaarts doorgetrokken dakvlak (zijLuifel): een dakvlak loopt
        // langs zijn helling door voorbij de gevel, met schijfwand eronder
        if (zijLuifel && zijLuifel.kant === zi.kant) {
          const n = Math.hypot(dx, dy)
          const rx = (zi.kant === -1 ? zi.van[0] - zi.tot[0] : zi.tot[0] - zi.van[0]) / n
          const ry = (zi.kant === -1 ? zi.van[1] - zi.tot[1] : zi.tot[1] - zi.van[1]) / n
          len += zijLuifel.uit
          cx += rx * zijLuifel.uit / 2; cy += ry * zijLuifel.uit / 2
        }
        return (
          <mesh key={i} material={mat}
            position={[cx, cy + .12, zMid]}
            rotation={[0, 0, hoek]}>
            <boxGeometry args={[len, .14, diepte]} />
          </mesh>
        )
      })}
      {zijLuifel && !plat && (() => {
        // richting van nok naar goot aan deze kant, doorgetrokken voorbij de gevel
        const dx = zijLuifel.kant * b / 2 - nokOffset, dy = goot - nok
        const l = Math.hypot(dx, dy) || 1
        const wandX = zijLuifel.kant * b / 2 + (dx / l) * zijLuifel.uit
        const wandH = Math.max(1.2, goot + (dy / l) * zijLuifel.uit)
        return (
          <mesh material={stdMat(zijLuifel.wandKleur || '#31302c')}
            position={[wandX, wandH / 2, zijLuifel.wandZ ?? d / 2 - .9]}>
            <boxGeometry args={[.3, wandH, zijLuifel.wandDiepte ?? 1.5]} />
          </mesh>
        )
      })()}
      {vDiepte > 0 && [-1, 1].map(kant =>
        Array.from({ length: vKolommen }, (_, i) => {
          const z = vKolommen === 1 ? d / 2 + vDiepte - .5
            : d / 2 + .3 + (vDiepte - .8) * (i / (vKolommen - 1))
          return (
            <mesh key={kant + ':' + i} material={MAT.staal} position={[kant * (b / 2 - .25), goot / 2, z]}>
              <cylinderGeometry args={[.06, .06, goot, 10]} />
            </mesh>
          )
        }))}
      {vDiepte > 0 && (
        <mesh material={MAT.terras} position={[0, .02, d / 2 + vDiepte / 2 - .2]}>
          <boxGeometry args={[b - .4, .05, vDiepte + .6]} />
        </mesh>
      )}
    </group>
  )
}

// glazen kopgevel die de daklijn volgt, met stramienstijl, kader,
// lamellen en balkon als opties
function KopGevel({ b, goot, nok, nokOffset = 0, plat, z, stramien = 'stroken', kader, kaderKleur, lamellen, balkon, puiFactor = 0, puiX = 0, penanten = null, ry = 0, xc = 0 }) {
  const gB = b * (puiFactor || (stramien === 'vlak' ? .7 : .62))
  const marge = .3
  // x is lokaal binnen de pui; de echte gevelpositie is x + puiX
  const apexLokaal = nokOffset - puiX
  const geo = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-gB / 2, .06); s.lineTo(gB / 2, .06)
    s.lineTo(gB / 2, randYOp(gB / 2 + puiX, b, goot, nok, nokOffset, marge))
    if (!plat && nok > goot && apexLokaal > -gB / 2 && apexLokaal < gB / 2)
      s.lineTo(apexLokaal, randYOp(nokOffset, b, goot, nok, nokOffset, marge))
    s.lineTo(-gB / 2, randYOp(-gB / 2 + puiX, b, goot, nok, nokOffset, marge))
    s.closePath()
    return new THREE.ShapeGeometry(s)
  }, [gB, b, goot, nok, nokOffset, plat, puiX]) // eslint-disable-line react-hooks/exhaustive-deps

  const afstandStijl = stramien === 'vlak' ? 1.9 : stramien === 'grid' ? 1.0 : .8
  const nStijl = Math.max(2, Math.round(gB / afstandStijl))
  const delen = []
  if (penanten) {
    // brede houten penanten binnen de pui (afwisseling hout en glas)
    const pMat = stdMat(penanten.kleur || '#77644c')
    const n = penanten.n || 3
    for (let i = 1; i <= n; i++) {
      const x = -gB / 2 + (gB / (n + 1)) * i
      let h = randYOp(x + puiX, b, goot, nok, nokOffset, marge + .05)
      if (penanten.hMax) h = Math.min(h, penanten.hMax)
      delen.push(
        <mesh key={'p' + i} material={pMat} position={[x, h / 2 + .05, .06]}>
          <boxGeometry args={[penanten.breedte || .5, h, .1]} />
        </mesh>
      )
    }
  }
  for (let i = 0; i <= nStijl; i++) {
    const x = -gB / 2 + (gB / nStijl) * i
    const h = randYOp(x + puiX, b, goot, nok, nokOffset, marge) - .06
    delen.push(
      <mesh key={'s' + i} material={MAT.kozijn} position={[x, h / 2 + .06, .02]}>
        <boxGeometry args={[STAEL.kozijnDikte, h, STAEL.kozijnDikte * 1.6]} />
      </mesh>
    )
  }
  if (stramien === 'grid') {
    const nDwars = Math.max(2, Math.round(goot / 1.1))
    for (let j = 1; j <= nDwars; j++) {
      const y = (goot / (nDwars + 1)) * j + .3
      delen.push(
        <mesh key={'d' + j} material={MAT.kozijn} position={[0, y, .02]}>
          <boxGeometry args={[gB, STAEL.kozijnDikte, STAEL.kozijnDikte * 1.4]} />
        </mesh>
      )
    }
  } else {
    delen.push(
      <mesh key="regel" material={MAT.kozijn} position={[0, goot, .02]}>
        <boxGeometry args={[gB, STAEL.kozijnDikte, STAEL.kozijnDikte * 1.6]} />
      </mesh>
    )
  }
  if (kader) {
    // het kader volgt de daklijn: schuine balken langs de dakranden,
    // verticale stijlen tot aan de dakrand
    const kMat = kaderKleur ? stdMat(kaderKleur) : MAT.houtAccent
    const kDelen = []
    for (const kant of [-1, 1]) {
      const x = kant * (gB / 2 + .12)
      const h = randYOp(kant * gB / 2 + puiX, b, goot, nok, nokOffset, .02)
      kDelen.push(
        <mesh key={'v' + kant} material={kMat} position={[x, h / 2, .1]}>
          <boxGeometry args={[.28, h, .5]} />
        </mesh>
      )
    }
    const top = [[-gB / 2 - .12, apexLokaal], [apexLokaal, gB / 2 + .12]]
    if (!plat && nok > goot) {
      top.forEach(([x1, x2], i) => {
        const y1 = randYOp(Math.max(-b / 2, Math.min(b / 2, x1 + puiX)), b, goot, nok, nokOffset, .02)
        const y2 = randYOp(Math.max(-b / 2, Math.min(b / 2, x2 + puiX)), b, goot, nok, nokOffset, .02)
        const len = Math.hypot(x2 - x1, y2 - y1) + .3
        kDelen.push(
          <mesh key={'s' + i} material={kMat}
            position={[(x1 + x2) / 2, (y1 + y2) / 2 + .1, .1]}
            rotation={[0, 0, Math.atan2(y2 - y1, x2 - x1)]}>
            <boxGeometry args={[len, .26, .5]} />
          </mesh>
        )
      })
    } else {
      kDelen.push(
        <mesh key="boven" material={kMat} position={[0, randYOp(0, b, goot, nok, nokOffset, .02), .1]}>
          <boxGeometry args={[gB + .5, .26, .5]} />
        </mesh>
      )
    }
    delen.push(<group key="kader">{kDelen}</group>)
  }
  if (lamellen && nok > goot) {
    const lams = []
    for (let y = goot + .25; y < randYOp(nokOffset, b, goot, nok, nokOffset, marge + .25); y += .3) {
      const halfB = Math.min(gB / 2, (randYOp(nokOffset, b, goot, nok, nokOffset, 0) - y) / (nok - goot) * (b / 2) + gB * .18)
      lams.push(
        <mesh key={y} material={MAT.houtAccent} position={[nokOffset * .5, y, .12]}>
          <boxGeometry args={[Math.max(halfB * 2, .8), .09, .12]} />
        </mesh>
      )
    }
    delen.push(<group key="lamellen">{lams}</group>)
  }
  if (balkon) {
    delen.push(
      <group key="balkon" position={[0, 2.95, .55]}>
        <mesh material={MAT.staal}><boxGeometry args={[2.6, .12, 1.2]} /></mesh>
        <mesh material={MAT.kozijn} position={[0, .55, .56]}><boxGeometry args={[2.6, .05, .05]} /></mesh>
        {Array.from({ length: 13 }, (_, i) => (
          <mesh key={i} material={MAT.kozijn} position={[-1.25 + i * .208, .28, .56]}>
            <boxGeometry args={[.03, .55, .03]} />
          </mesh>
        ))}
      </group>
    )
  }
  return (
    <group position={[xc + puiX, 0, z]} rotation={[0, ry, 0]}>
      <mesh geometry={geo} material={MAT.glas} />
      {delen}
    </group>
  )
}

// plintband: onderste geveldeel in een tweede materiaal, rondom
function Plint({ spec }) {
  if (!spec.plint) return null
  const { b, d } = spec
  const h = spec.plint.h
  const mat = stdMat(spec.plint.kleur)
  return (
    <group>
      <mesh material={mat} position={[0, h / 2, d / 2 + .02]}><boxGeometry args={[b + .02, h, .05]} /></mesh>
      <mesh material={mat} position={[0, h / 2, -d / 2 - .02]}><boxGeometry args={[b + .02, h, .05]} /></mesh>
      <mesh material={mat} position={[b / 2 + .02, h / 2, 0]}><boxGeometry args={[.05, h, d + .02]} /></mesh>
      <mesh material={mat} position={[-b / 2 - .02, h / 2, 0]}><boxGeometry args={[.05, h, d + .02]} /></mesh>
    </group>
  )
}

// vrij lamellenveld voor een gevel (zonwering voor een pui of vide)
function LamellenVelden({ spec }) {
  if (!spec.lamellenVelden) return null
  return spec.lamellenVelden.map((v, i) => {
    const mat = stdMat(v.kleur || KLEUREN.houtBlank)
    const lats = []
    for (let y = v.y0; y <= v.y1; y += v.stap || .3) {
      lats.push(
        <mesh key={y} material={mat} position={[v.x || 0, y, spec.d / 2 + (v.uit ?? .3)]}>
          <boxGeometry args={[v.w, .08, .12]} />
        </mesh>
      )
    }
    return <group key={i}>{lats}</group>
  })
}

// kleine opbouw op een plat dak
function DakOpbouw({ spec }) {
  if (!spec.dakOpbouw) return null
  const o = spec.dakOpbouw
  return (
    <group position={[o.x || 0, spec.nok + o.h / 2 + .1, o.z || 0]}>
      <mesh material={stdMat(o.kleur || spec.gevel)}><boxGeometry args={[o.b, o.h, o.d]} /></mesh>
      <mesh material={MAT.staal} position={[0, o.h / 2 + .06, 0]}><boxGeometry args={[o.b + .2, .12, o.d + .2]} /></mesh>
    </group>
  )
}

// geschakelde platte aanbouwvolumes (garage, berging, entreeblok),
// met een dakplaat die als luifel kan doorsteken
function AanbouwVolumes({ spec }) {
  if (!spec.aanbouwen) return null
  return spec.aanbouwen.map((a, i) => (
    <group key={i} position={[a.x, 0, a.z]}>
      <mesh material={stdMat(a.kleur || spec.gevel)} position={[0, a.h / 2, 0]}>
        <boxGeometry args={[a.b, a.h, a.d]} />
      </mesh>
      <mesh material={MAT.staal} position={[(a.dakUitX || 0) / 2, a.h + .08, (a.dakUitZ || 0) / 2]}>
        <boxGeometry args={[a.b + .4 + Math.abs(a.dakUitX || 0), .16, a.d + .4 + Math.abs(a.dakUitZ || 0)]} />
      </mesh>
      {a.deur && (
        <mesh material={MAT.kozijn} position={[0, 1.1, a.d / 2 + .05]}>
          <boxGeometry args={[Math.min(a.b - .8, 2.4), 2.2, .08]} />
        </mesh>
      )}
    </group>
  ))
}

// gevelpanelen: dichte vlakken op kop- of langsgevel (schuifpaneel,
// gevelaccent, garagedeur), als dunne platen net voor de gevel
function Panelen({ spec }) {
  if (!spec.panelen) return null
  return spec.panelen.map((p, i) => {
    const mat = stdMat(p.kleur)
    if (p.vlak === 'kop') {
      return (
        <mesh key={i} material={mat} position={[p.x || 0, p.y, spec.d / 2 + (p.uit ?? .08)]}>
          <boxGeometry args={[p.w, p.h, .07]} />
        </mesh>
      )
    }
    const kant = p.vlak === 'rechts' ? 1 : -1
    return (
      <mesh key={i} material={mat} position={[kant * (spec.b / 2 + .07), p.y, p.z || 0]}>
        <boxGeometry args={[.07, p.h, p.w]} />
      </mesh>
    )
  })
}

// portaalkader: de contour van de kap doorgetrokken tot de grond op een
// vooruitgeschoven lijn (wit betonkader of houten portaal voor de gevel)
function Portaal({ spec }) {
  if (!spec.portaal) return null
  const { b, d, goot, nok } = spec
  const off = spec.nokOffset || 0
  const kMat = stdMat(spec.portaal.kleur || '#d8d4c9')
  const z = d / 2 + spec.portaal.uit
  const dik = spec.portaal.dik ?? .45
  const delen = []
  for (const kant of [-1, 1]) {
    const x = kant * (b / 2 - dik / 2 + .05)
    const h = randYOp(x, b, goot, nok, off, -.06)
    delen.push(
      <mesh key={'s' + kant} material={kMat} position={[x, h / 2, z]}>
        <boxGeometry args={[dik, h, .6]} />
      </mesh>
    )
  }
  const top = [[-b / 2 + dik / 2, off], [off, b / 2 - dik / 2]]
  top.forEach(([x1, x2], i) => {
    const y1 = randYOp(x1, b, goot, nok, off, -.06)
    const y2 = randYOp(x2, b, goot, nok, off, -.06)
    const len = Math.hypot(x2 - x1, y2 - y1) + .5
    delen.push(
      <mesh key={'t' + i} material={kMat}
        position={[(x1 + x2) / 2, (y1 + y2) / 2 + .12, z]}
        rotation={[0, 0, Math.atan2(y2 - y1, x2 - x1)]}>
        <boxGeometry args={[len, .4, .6]} />
      </mesh>
    )
  })
  return <group>{delen}</group>
}

// dichte kopgevel met kader langs de daklijn, twee staande ramen,
// een verdiepingsraam en een deur (voor volumes zonder grote pui)
function KopGevelDicht({ b, goot, nok, nokOffset = 0, z, kaderKleur }) {
  const kMat = kaderKleur ? stdMat(kaderKleur) : MAT.houtAccent
  const delen = []
  for (const kant of [-1, 1]) {
    const x = kant * (b / 2 - .35)
    const h = randYOp(x, b, goot, nok, nokOffset, .04)
    delen.push(
      <mesh key={'k' + kant} material={kMat} position={[x, h / 2, .06]}>
        <boxGeometry args={[.55, h, .18]} />
      </mesh>
    )
  }
  const raam = (x, y, w, h, key) => (
    <group key={key} position={[x, y, .05]}>
      <mesh material={MAT.glas}><planeGeometry args={[w, h]} /></mesh>
      <mesh material={MAT.kozijn} position={[0, 0, -.015]}>
        <boxGeometry args={[w + .14, h + .14, .03]} />
      </mesh>
    </group>
  )
  delen.push(raam(-b / 4, 1.5, .95, 2.0, 'r1'))
  delen.push(raam(b / 6, 1.5, .95, 2.0, 'r2'))
  delen.push(raam(0, goot + (nok - goot) * .45, .9, 1.3, 'r3'))
  delen.push(
    <group key="deur" position={[b / 2 - 1.5, 1.15, .05]}>
      <mesh material={MAT.kozijn}><boxGeometry args={[1.0, 2.3, .08]} /></mesh>
    </group>
  )
  return <group position={[0, 0, z]}>{delen}</group>
}

// vensterritme op de langsgevels: raamstroken van plint tot goot
function LangsGevels({ spec, b, d, goot }) {
  const ramen = []
  const n = spec.stramienN
  for (const kant of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const z = -d / 2 + d * ((i + .5) / n)
      const h = goot - .65
      const y = h / 2 + .3
      ramen.push(
        <group key={kant + ':' + i} position={[kant * (b / 2 + .04), y, z]} rotation={[0, kant * Math.PI / 2, 0]}>
          <mesh material={MAT.glas}><planeGeometry args={[1.0, h]} /></mesh>
          <mesh material={MAT.kozijn} position={[0, 0, -.015]}>
            <boxGeometry args={[1.0 + STAEL.kozijnDikte * 2, h + STAEL.kozijnDikte * 2, .03]} />
          </mesh>
        </group>
      )
    }
  }
  return <group>{ramen}</group>
}

// ---------- massastrategieen ----------

const verandaVan = spec => spec.veranda || (spec.elementen.includes('veranda') ? { diepte: 2.4, kolommen: 2 } : 0)

function MassaEnkel({ spec }) {
  const { b, d, goot, nok, plat } = spec
  const off = spec.nokOffset || 0
  return (
    <group>
      <Volume b={b} d={d} goot={goot} nok={nok} nokOffset={off} kleur={spec.gevel} plat={plat} />
      <Dakplaten b={b} d={d} goot={goot} nok={nok} nokOffset={off} overstek={spec.overstek}
        kleur={spec.dak} plat={plat} veranda={verandaVan(spec)} zijLuifel={spec.zijLuifel} />
      <KopGevel b={b} goot={goot} nok={nok} nokOffset={off} plat={plat} z={d / 2 + .04}
        stramien={spec.kop.stramien} kader={spec.kop.kader} kaderKleur={spec.kop.kaderKleur}
        lamellen={spec.kop.lamellen} puiFactor={spec.kop.puiFactor} puiX={spec.kop.puiX || 0}
        penanten={spec.kop.penanten}
        balkon={spec.elementen.includes('balkon')} />
      <LangsGevels spec={spec} b={b} d={d} goot={goot} />
      {spec.typologie.id === 'paviljoen' && [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([kx, kz]) => (
        <mesh key={kx + ':' + kz} material={MAT.staal}
          position={[kx * (b / 2 + spec.overstek - .3), goot / 2, kz * (d / 2 + spec.overstek - .3)]}>
          <cylinderGeometry args={[.06, .06, goot, 10]} />
        </mesh>
      ))}
    </group>
  )
}

function MassaKopstaart({ spec }) {
  const { b, d, goot, nok } = spec
  const ks = spec.kopstaart
  const bS = b * ks.krimp
  const gootS = Math.min(goot, ks.gootK - .9)
  const nokS = Math.min(nok - .6, gootS + Math.tan(spec.helling * Math.PI / 180) * bS / 2)
  const dS = d - ks.dKop
  const kleurStaart = spec.gevel2 || spec.gevel
  return (
    <group>
      {/* kopgebouw aan de voorzijde */}
      <group position={[0, 0, (d - ks.dKop) / 2]}>
        <Volume b={b} d={ks.dKop} goot={ks.gootK} nok={ks.nokK} kleur={spec.gevel} />
        <Dakplaten b={b} d={ks.dKop} goot={ks.gootK} nok={ks.nokK} overstek={spec.overstek} kleur={spec.dak}
          veranda={verandaVan(spec)} />
        <KopGevel b={b} goot={ks.gootK} nok={ks.nokK} z={ks.dKop / 2 + .04}
          stramien={spec.kop.stramien} kader={spec.kop.kader} kaderKleur={spec.kop.kaderKleur}
          lamellen={spec.kop.lamellen} puiFactor={spec.kop.puiFactor}
          balkon={spec.elementen.includes('balkon')} />
      </group>
      {/* langgerekte lagere staart */}
      <group position={[0, 0, -ks.dKop / 2]}>
        <Volume b={bS} d={dS} goot={gootS} nok={nokS} kleur={kleurStaart} />
        <Dakplaten b={bS} d={dS} goot={gootS} nok={nokS} overstek={spec.overstek * .8} kleur={spec.dak} />
        <LangsGevels spec={spec} b={bS} d={dS} goot={gootS} />
      </group>
    </group>
  )
}

function MassaDwarskap({ spec }) {
  const { b, d, goot, nok } = spec
  const dw = spec.dwars
  const groepX = b / 2 + b * .35 - dw.d2 / 2
  return (
    <group>
      <Volume b={b} d={d} goot={goot} nok={nok} kleur={spec.gevel} />
      <Dakplaten b={b} d={d} goot={goot} nok={nok} overstek={spec.overstek} kleur={spec.dak}
        veranda={verandaVan(spec)} />
      {spec.kopPui !== false ? (
        <KopGevel b={b} goot={goot} nok={nok} z={d / 2 + .04}
          stramien={spec.kop.stramien} kader={spec.kop.kader} kaderKleur={spec.kop.kaderKleur}
          lamellen={spec.kop.lamellen} puiFactor={spec.kop.puiFactor}
          balkon={spec.elementen.includes('balkon')} />
      ) : (
        <KopGevelDicht b={b} goot={goot} nok={nok} z={d / 2 + .04} kaderKleur={spec.kop.kaderKleur} />
      )}
      <LangsGevels spec={spec} b={b} d={d} goot={goot} />
      {/* haaks dwarsvolume met eigen glazen kopgevel op de flank */}
      <group position={[groepX, 0, dw.z]} rotation={[0, Math.PI / 2, 0]}>
        <Volume b={dw.b2} d={dw.d2} goot={dw.goot2} nok={dw.nok2} kleur={spec.gevel2 || spec.gevel} />
        <Dakplaten b={dw.b2} d={dw.d2} goot={dw.goot2} nok={dw.nok2} overstek={spec.overstek * .8} kleur={spec.dak} />
        <KopGevel b={dw.b2} goot={dw.goot2} nok={dw.nok2} z={dw.d2 / 2 + .04} stramien={spec.kop.stramien} />
      </group>
    </group>
  )
}

function MassaZwevend({ spec }) {
  const zw = spec.zwevend
  const { b, d } = spec
  const bO = b * zw.onderKrimp, dO = d * zw.onderKrimp
  const topH = spec.nok - zw.onderH
  const zTop = zw.overhang / 2
  const bandY = zw.onderH + topH / 2
  return (
    <group>
      {/* onderbouw, deels open */}
      <mesh material={useMemo(() => stdMat(spec.gevel2 || spec.gevel), [spec.gevel2, spec.gevel])}
        position={[0, zw.onderH / 2, -zw.overhang / 2]}>
        <boxGeometry args={[bO, zw.onderH, dO]} />
      </mesh>
      {/* zwevende glazen doos */}
      <mesh material={useMemo(() => stdMat(spec.gevel), [spec.gevel])} position={[0, zw.onderH + topH / 2, zTop]}>
        <boxGeometry args={[b, topH, d]} />
      </mesh>
      <mesh material={MAT.staal} position={[0, spec.nok + .1, zTop]}>
        <boxGeometry args={[b + .5, .2, d + .5]} />
      </mesh>
      {/* glasband rondom de doos met slanke stijlen */}
      {[[0, 0, d / 2 + .03, 0], [0, 0, -d / 2 - .03, Math.PI], [b / 2 + .03, 0, 0, Math.PI / 2], [-b / 2 - .03, 0, 0, -Math.PI / 2]].map(([x, , z, ry], i) => {
        const breed = (i < 2 ? b : d) - .3
        const nS = Math.max(3, Math.round(breed / 1.1))
        return (
          <group key={i} position={[x, bandY, z + (i < 2 ? 0 : 0)]} rotation={[0, ry, 0]}>
            <mesh material={MAT.glas}><planeGeometry args={[breed, topH - .5]} /></mesh>
            {Array.from({ length: nS + 1 }, (_, j) => (
              <mesh key={j} material={MAT.kozijn} position={[-breed / 2 + (breed / nS) * j, 0, .02]}>
                <boxGeometry args={[STAEL.kozijnDikte, topH - .5, STAEL.kozijnDikte]} />
              </mesh>
            ))}
          </group>
        )
      })}
      {/* slanke stalen kolommen onder de uitkraging */}
      {[-1, 1].map(k => (
        <mesh key={k} material={MAT.staal} position={[k * (b / 2 - .4), zw.onderH / 2, d / 2 + zTop - .4]}>
          <cylinderGeometry args={[.07, .07, zw.onderH, 10]} />
        </mesh>
      ))}
    </group>
  )
}

// ---------- creatieve elementen ----------

function Elementen({ spec }) {
  const { b, d, goot, nok } = spec
  const delen = []
  const el = naam => spec.elementen.includes(naam)

  if (el('schoorsteen')) {
    delen.push(
      <mesh key="schoorsteen" material={MAT.baksteen} position={[(spec.nokOffset || 0) * .6, nok - .2, -d * .18]}>
        <boxGeometry args={[.9, 2.2, .9]} />
      </mesh>
    )
  }
  if (el('bijgebouw')) {
    const x = -(b / 2 + 4.2)
    delen.push(
      <group key="bijgebouw" position={[x, 0, d * .12]}>
        <mesh material={stdMat(spec.gevel2 || KLEUREN.houtZwart)} position={[-1.4, 1.35, 0]}>
          <boxGeometry args={[2.8, 2.7, 3.2]} />
        </mesh>
        <mesh material={MAT.staal} position={[0, 2.75, 0]}>
          <boxGeometry args={[6.2, .16, 3.6]} />
        </mesh>
        {[[2.7, -1.5], [2.7, 1.5]].map(([kx, kz]) => (
          <mesh key={kx + ':' + kz} material={MAT.staal} position={[kx, 1.35, kz]}>
            <cylinderGeometry args={[.05, .05, 2.7, 8]} />
          </mesh>
        ))}
      </group>
    )
  }
  if (el('hoekpui') && spec.massa !== 'zwevend') {
    // uitstekende glazen erker op de hoek van de kopgevel
    const kant = spec.hoekpuiKant || 1
    const hp = Math.min(goot - .4, 2.7)
    const eB = 2.9, eD = .85
    const xc = kant * (b / 2 - eB / 2 + .2)
    delen.push(
      <group key="hoekpui" position={[xc, 0, d / 2]}>
        <mesh material={MAT.glas} position={[0, hp / 2 + .05, eD]}>
          <planeGeometry args={[eB, hp]} />
        </mesh>
        {[-1, 1].map(k => (
          <group key={k} position={[k * eB / 2, hp / 2 + .05, eD / 2]} rotation={[0, k * Math.PI / 2, 0]}>
            <mesh material={MAT.glas}><planeGeometry args={[eD, hp]} /></mesh>
          </group>
        ))}
        <mesh material={MAT.staal} position={[0, hp + .12, eD / 2]}>
          <boxGeometry args={[eB + .15, .14, eD + .15]} />
        </mesh>
        {[[-eB / 2, eD], [eB / 2, eD]].map(([x, z], i) => (
          <mesh key={i} material={MAT.kozijn} position={[x, hp / 2 + .05, z]}>
            <boxGeometry args={[.09, hp, .09]} />
          </mesh>
        ))}
      </group>
    )
  }
  if (el('langsPui') && spec.massa !== 'zwevend') {
    const w = Math.min(4.5, d * .35), hp = Math.min(goot - .5, 2.9)
    delen.push(
      <group key="langspui" position={[-(b / 2 + .05), hp / 2 + .05, d * .1]} rotation={[0, -Math.PI / 2, 0]}>
        <mesh material={MAT.glas}><planeGeometry args={[w, hp]} /></mesh>
        <mesh material={MAT.kozijn} position={[0, 0, -.02]}>
          <boxGeometry args={[w + .16, hp + .16, .04]} />
        </mesh>
      </group>
    )
  }
  if (el('dakramen') && !spec.plat) {
    const kant = spec.dakraamKant || 1
    const off = spec.nokOffset || 0
    const xRand = kant * b / 2
    const hoek = Math.atan2(nok - goot, Math.abs(xRand - off))
    const x = (off + xRand) / 2
    const y = randYOp(x, b, goot, nok, off, 0) + .12
    for (let i = 0; i < 2; i++) {
      delen.push(
        <mesh key={'dakraam' + i} material={MAT.glas}
          position={[x, y, -d / 4 + i * (d / 2.2)]}
          rotation={[0, 0, -kant * hoek]}>
          <boxGeometry args={[1.1, .06, .9]} />
        </mesh>
      )
    }
  }
  if (el('dakkapel') && !spec.plat && ['enkel', 'asym'].includes(spec.massa)) {
    const off = spec.nokOffset || 0
    const x = (off + b / 2) / 2
    const y = randYOp(x, b, goot, nok, off, 0) - .55
    delen.push(
      <group key="dakkapel" position={[x, y, d * .1]}>
        <mesh material={stdMat(spec.gevel)}><boxGeometry args={[2.0, 1.3, 1.5]} /></mesh>
        <mesh material={MAT.staal} position={[0, .7, 0]}><boxGeometry args={[2.2, .1, 1.7]} /></mesh>
        <mesh material={MAT.glas} position={[1.01, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[1.3, 1.0]} />
        </mesh>
      </group>
    )
  }
  if (el('entreeLuifel')) {
    delen.push(
      <group key="luifel" position={[-(b / 2 + .8), 0, d / 2 - 1.6]}>
        <mesh material={MAT.staal} position={[0, 2.35, 0]}><boxGeometry args={[1.7, .08, 2.0]} /></mesh>
        {[-1, 1].map(k => (
          <mesh key={k} material={MAT.staal} position={[-.7, 1.18, k * .85]}>
            <cylinderGeometry args={[.045, .045, 2.35, 8]} />
          </mesh>
        ))}
        <mesh material={MAT.kozijn} position={[.78, 1.15, 0]}>
          <boxGeometry args={[.06, 2.3, 1.1]} />
        </mesh>
      </group>
    )
  }
  if (el('entreeKader')) {
    delen.push(
      <group key="entreekader" position={[-(b / 2 + .02), 0, d / 2 - 1.6]}>
        <mesh material={MAT.licht} position={[.1, 1.3, 0]}>
          <boxGeometry args={[.5, 2.6, 1.8]} />
        </mesh>
        <mesh material={MAT.kozijn} position={[.15, 1.2, 0]}>
          <boxGeometry args={[.55, 2.2, 1.1]} />
        </mesh>
      </group>
    )
  }
  return <group>{delen}</group>
}

function Kavel({ spec, programma }) {
  const kavelZ = Math.sqrt(programma.kavel)
  const vlakZ = Math.sqrt(programma.bouwvlak)
  const pts = useMemo(() => {
    const h = vlakZ * .8
    return [[-h, .02, -h], [h, .02, -h], [h, .02, h], [-h, .02, h], [-h, .02, -h]]
  }, [vlakZ])
  return (
    <group>
      <mesh material={MAT.gras} rotation={[-Math.PI / 2, 0, 0]} position={[0, -.01, 0]}>
        <circleGeometry args={[kavelZ * .8, 48]} />
      </mesh>
      <Line points={pts} color="#c98a5e" lineWidth={1} transparent opacity={.55} />
      {!spec.elementen.includes('veranda') && (
        <mesh material={MAT.terras} position={[0, .015, spec.d / 2 + 2.1]}>
          <boxGeometry args={[spec.b * .8, .05, 3.4]} />
        </mesh>
      )}
    </group>
  )
}

const MASSA_COMP = {
  enkel: MassaEnkel,
  kopstaart: MassaKopstaart,
  dwarskap: MassaDwarskap,
  asym: MassaEnkel,      // asymmetrie zit in nokOffset
  zwevend: MassaZwevend,
}

export function Woning({ spec, programma }) {
  const Massa = MASSA_COMP[spec.massa] || MassaEnkel
  return (
    <group>
      <Massa spec={spec} />
      <Elementen spec={spec} />
      <Panelen spec={spec} />
      <Portaal spec={spec} />
      <Plint spec={spec} />
      <LamellenVelden spec={spec} />
      <DakOpbouw spec={spec} />
      <AanbouwVolumes spec={spec} />
      <Kavel spec={spec} programma={programma} />
    </group>
  )
}

export default function Woning3D({ spec, programma, groot = false, camera = null }) {
  const afstand = camera?.afstand ?? Math.max(spec.b, spec.d) * (groot ? 1.7 : 2.0) + 7
  // camera-override voor de kalibratiepagina: azimut in graden vanaf de kopgevel
  const az = camera ? camera.azimut * Math.PI / 180 : null
  const pos = camera
    ? [afstand * Math.sin(az), camera.hoogte ?? afstand * .35, afstand * Math.cos(az)]
    : [afstand * .78, afstand * .4, afstand * .62]
  return (
    <Canvas
      dpr={[1, 1.75]}
      shadows={false}
      camera={{ position: pos, fov: camera?.fov ?? 38 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}>
      <color attach="background" args={['#1a1a1d']} />
      <fog attach="fog" args={['#1a1a1d', afstand * 1.6, afstand * 3.6]} />
      <ambientLight intensity={.35} color="#e8e4dc" />
      <hemisphereLight args={['#d8dde6', '#4a4438', 1.2]} />
      <directionalLight position={[14, 18, 9]} intensity={2.6} color="#ffe8d2" />
      <directionalLight position={[-10, 6, -8]} intensity={.8} color="#9fb2c8" />
      <Woning spec={spec} programma={programma} />
      <ContactShadows position={[0, .005, 0]} opacity={.55} scale={Math.max(spec.b, spec.d) * 2.4} blur={2.6} far={12} resolution={512} />
      <OrbitControls
        target={[0, camera?.doelY ?? spec.nok / 2.4, 0]}
        enablePan={false}
        minDistance={afstand * .45}
        maxDistance={afstand * 1.7}
        maxPolarAngle={Math.PI / 2 - .04} />
    </Canvas>
  )
}
