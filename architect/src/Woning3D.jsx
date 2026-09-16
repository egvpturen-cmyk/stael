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
function Dakplaten({ b, d, goot, nok, nokOffset = 0, overstek, kleur, plat, veranda = 0 }) {
  const mat = useMemo(() => dakMatVan(kleur), [kleur])
  const diepte = d + 2 * overstek + veranda
  const zMid = veranda / 2
  if (plat) {
    return (
      <mesh material={mat} position={[0, goot + .11, zMid]}>
        <boxGeometry args={[b + 2 * overstek, .22, diepte]} />
      </mesh>
    )
  }
  const zijden = [
    { van: [-b / 2, goot], tot: [nokOffset, nok] },
    { van: [nokOffset, nok], tot: [b / 2, goot] },
  ]
  return (
    <group>
      {zijden.map((zi, i) => {
        const dx = zi.tot[0] - zi.van[0], dy = zi.tot[1] - zi.van[1]
        const len = Math.hypot(dx, dy) + overstek * 1.4
        const hoek = Math.atan2(dy, dx)
        return (
          <mesh key={i} material={mat}
            position={[(zi.van[0] + zi.tot[0]) / 2, (zi.van[1] + zi.tot[1]) / 2 + .12, zMid]}
            rotation={[0, 0, hoek]}>
            <boxGeometry args={[len, .14, diepte]} />
          </mesh>
        )
      })}
      {veranda > 0 && [-1, 1].map(k => (
        <mesh key={k} material={MAT.staal} position={[k * (b / 2 - .25), goot / 2, d / 2 + veranda - .5]}>
          <cylinderGeometry args={[.06, .06, goot, 10]} />
        </mesh>
      ))}
      {veranda > 0 && (
        <mesh material={MAT.terras} position={[0, .02, d / 2 + veranda / 2 - .2]}>
          <boxGeometry args={[b - .4, .05, veranda + .6]} />
        </mesh>
      )}
    </group>
  )
}

// glazen kopgevel die de daklijn volgt, met stramienstijl, kader,
// lamellen en balkon als opties
function KopGevel({ b, goot, nok, nokOffset = 0, plat, z, stramien = 'stroken', kader, lamellen, balkon, ry = 0, xc = 0 }) {
  const gB = b * (stramien === 'vlak' ? .7 : .62)
  const marge = .3
  const geo = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-gB / 2, .06); s.lineTo(gB / 2, .06)
    s.lineTo(gB / 2, randYOp(gB / 2, b, goot, nok, nokOffset, marge))
    if (!plat && nok > goot) s.lineTo(nokOffset, randYOp(nokOffset, b, goot, nok, nokOffset, marge))
    s.lineTo(-gB / 2, randYOp(-gB / 2, b, goot, nok, nokOffset, marge))
    s.closePath()
    return new THREE.ShapeGeometry(s)
  }, [gB, b, goot, nok, nokOffset, plat])

  const afstandStijl = stramien === 'vlak' ? 1.9 : stramien === 'grid' ? 1.0 : .8
  const nStijl = Math.max(2, Math.round(gB / afstandStijl))
  const delen = []
  for (let i = 0; i <= nStijl; i++) {
    const x = -gB / 2 + (gB / nStijl) * i
    const h = randYOp(x, b, goot, nok, nokOffset, marge) - .06
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
    const kH = randYOp(0, b, goot, nok, nokOffset, marge - .1)
    delen.push(
      <group key="kader">
        {[-1, 1].map(k => (
          <mesh key={k} material={MAT.houtAccent} position={[k * (gB / 2 + .15), kH / 2, .06]}>
            <boxGeometry args={[.3, kH, .5]} />
          </mesh>
        ))}
      </group>
    )
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
    <group position={[xc, 0, z]} rotation={[0, ry, 0]}>
      <mesh geometry={geo} material={MAT.glas} />
      {delen}
    </group>
  )
}

// vensterritme op de langsgevels
function LangsGevels({ spec, b, d, goot }) {
  const ramen = []
  const n = spec.stramienN
  for (const kant of [-1, 1]) {
    for (let i = 0; i < n; i++) {
      const z = -d / 2 + d * ((i + .5) / n)
      const h = spec.lagen === 2 && spec.typologie.id === 'loft' ? goot - 1.1 : Math.min(goot - .55, 2.1)
      const y = h / 2 + .45
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

function MassaEnkel({ spec }) {
  const { b, d, goot, nok, plat } = spec
  const off = spec.nokOffset || 0
  const veranda = spec.elementen.includes('veranda') ? 2.4 : 0
  return (
    <group>
      <Volume b={b} d={d} goot={goot} nok={nok} nokOffset={off} kleur={spec.gevel} plat={plat} />
      <Dakplaten b={b} d={d} goot={goot} nok={nok} nokOffset={off} overstek={spec.overstek}
        kleur={spec.dak} plat={plat} veranda={veranda} />
      <KopGevel b={b} goot={goot} nok={nok} nokOffset={off} plat={plat} z={d / 2 + .04}
        stramien={spec.kop.stramien} kader={spec.kop.kader} lamellen={spec.kop.lamellen}
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
          veranda={spec.elementen.includes('veranda') ? 2.2 : 0} />
        <KopGevel b={b} goot={ks.gootK} nok={ks.nokK} z={ks.dKop / 2 + .04}
          stramien={spec.kop.stramien} kader={spec.kop.kader} lamellen={spec.kop.lamellen}
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
        veranda={spec.elementen.includes('veranda') ? 2.2 : 0} />
      <KopGevel b={b} goot={goot} nok={nok} z={d / 2 + .04}
        stramien={spec.kop.stramien} kader={spec.kop.kader} lamellen={spec.kop.lamellen}
        balkon={spec.elementen.includes('balkon')} />
      <LangsGevels spec={spec} b={b} d={d} goot={goot} />
      {/* haaks dwarsvolume met eigen glazen kopgevel op de flank */}
      <group position={[groepX, 0, dw.z]} rotation={[0, -Math.PI / 2, 0]}>
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
    const hp = Math.min(goot - .4, 2.8)
    delen.push(
      <group key="hoekpui">
        <mesh material={MAT.glas} position={[b / 2 - 1.5, hp / 2 + .05, d / 2 + .05]}>
          <planeGeometry args={[2.8, hp]} />
        </mesh>
        <group position={[b / 2 + .05, hp / 2 + .05, d / 2 - 1.5]} rotation={[0, Math.PI / 2, 0]}>
          <mesh material={MAT.glas}><planeGeometry args={[2.8, hp]} /></mesh>
        </group>
        <mesh material={MAT.kozijn} position={[b / 2 + .03, hp / 2 + .05, d / 2 + .03]}>
          <boxGeometry args={[.1, hp, .1]} />
        </mesh>
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
    const off = spec.nokOffset || 0
    const hoekR = Math.atan2(nok - goot, b / 2 - off)
    const x = (off + b / 2) / 2
    const y = randYOp(x, b, goot, nok, off, 0) + .12
    for (let i = 0; i < 2; i++) {
      delen.push(
        <mesh key={'dakraam' + i} material={MAT.glas}
          position={[x, y, -d / 4 + i * (d / 2.2)]}
          rotation={[0, 0, -hoekR]}>
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
      <Kavel spec={spec} programma={programma} />
    </group>
  )
}

export default function Woning3D({ spec, programma, groot = false }) {
  const afstand = Math.max(spec.b, spec.d) * (groot ? 1.7 : 2.0) + 7
  return (
    <Canvas
      dpr={[1, 1.75]}
      shadows={false}
      camera={{ position: [afstand * .78, afstand * .4, afstand * .62], fov: 38 }}
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
        target={[0, spec.nok / 2.4, 0]}
        enablePan={false}
        minDistance={afstand * .45}
        maxDistance={afstand * 1.7}
        maxPolarAngle={Math.PI / 2 - .04} />
    </Canvas>
  )
}
