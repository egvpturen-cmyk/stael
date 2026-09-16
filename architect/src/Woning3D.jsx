import * as THREE from 'three'
import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, ContactShadows, Line } from '@react-three/drei'
import { STAEL } from './ontwerptaal.js'

const MAT = {
  // metalness laag houden: zonder environment-map reflecteert metaal zwart
  kozijn: new THREE.MeshStandardMaterial({ color: STAEL.kozijnKleur, roughness: .5, metalness: .2 }),
  glas: new THREE.MeshStandardMaterial({ color: '#33404a', roughness: .12, metalness: .3 }),
  staal: new THREE.MeshStandardMaterial({ color: '#26262a', roughness: .45, metalness: .35 }),
  gras: new THREE.MeshStandardMaterial({ color: '#3a4630', roughness: 1 }),
  terras: new THREE.MeshStandardMaterial({ color: '#6e685d', roughness: .95 }),
}

function Romp({ spec }) {
  const { b, d, goot, nok, plat } = spec
  const geo = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-b / 2, 0); s.lineTo(b / 2, 0); s.lineTo(b / 2, goot)
    if (!plat) s.lineTo(0, nok)
    s.lineTo(-b / 2, goot); s.closePath()
    const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false })
    g.translate(0, 0, -d / 2)
    return g
  }, [b, d, goot, nok, plat])
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: spec.typologie.gevel, roughness: .85 }), [spec.typologie.gevel])
  return <mesh geometry={geo} material={mat} />
}

function Dak({ spec }) {
  const { b, d, goot, nok, plat, overstek } = spec
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: spec.typologie.dak, roughness: .6, metalness: .12 }), [spec.typologie.dak])
  if (plat) {
    const rand = spec.typologie.id === 'paviljoen' ? .32 : .2
    return (
      <group>
        <mesh material={mat} position={[0, goot + rand / 2, 0]}>
          <boxGeometry args={[b + 2 * overstek, rand, d + 2 * overstek]} />
        </mesh>
        {spec.typologie.id === 'paviljoen' && kolommen(b, d, overstek, goot)}
      </group>
    )
  }
  const hoek = Math.atan2(nok - goot, b / 2)
  const dakL = Math.hypot(b / 2, nok - goot) + overstek * 1.4
  return (
    <group>
      {[[-1, 1], [1, -1]].map(([kant, rot]) => (
        <mesh key={kant} material={mat}
          position={[kant * b / 4, goot + (nok - goot) / 2 + .12, 0]}
          rotation={[0, 0, rot * hoek]}>
          <boxGeometry args={[dakL, .14, d + 2 * overstek]} />
        </mesh>
      ))}
    </group>
  )
}

function kolommen(b, d, overstek, goot) {
  const xs = [-b / 2 - overstek + .3, b / 2 + overstek - .3]
  const zs = [-d / 2 - overstek + .3, d / 2 + overstek - .3]
  const out = []
  xs.forEach(x => zs.forEach(z => out.push(
    <mesh key={x + ':' + z} material={MAT.staal} position={[x, goot / 2, z]}>
      <cylinderGeometry args={[.06, .06, goot, 10]} />
    </mesh>
  )))
  return out
}

// dubbelhoge glazen kopgevel met slanke donkere stijlen;
// het glas volgt de daklijn zodat het nooit boven de kap uitsteekt
function KopGevel({ spec }) {
  const { b, d, goot, nok, plat } = spec
  const soort = spec.typologie.glas.kop
  const gB = b * (soort === 'strook' ? .84 : soort === 'vide' ? .7 : .62)
  const z = d / 2 + .04
  const marge = .3
  const randY = x => plat
    ? goot - .45
    : goot + (nok - goot) * (1 - Math.abs(x) / (b / 2)) - marge

  const geo = useMemo(() => {
    const s = new THREE.Shape()
    s.moveTo(-gB / 2, .06); s.lineTo(gB / 2, .06)
    s.lineTo(gB / 2, randY(gB / 2))
    if (!plat) s.lineTo(0, randY(0))
    s.lineTo(-gB / 2, randY(-gB / 2))
    s.closePath()
    return new THREE.ShapeGeometry(s)
  }, [gB, goot, nok, plat]) // eslint-disable-line react-hooks/exhaustive-deps

  const stijlen = Math.max(2, Math.round(gB / 1.05))
  const posts = []
  for (let i = 0; i <= stijlen; i++) {
    const x = -gB / 2 + (gB / stijlen) * i
    const h = randY(x) - .06
    posts.push(
      <mesh key={i} material={MAT.kozijn} position={[x, h / 2 + .06, z + .02]}>
        <boxGeometry args={[STAEL.kozijnDikte, h, STAEL.kozijnDikte * 1.6]} />
      </mesh>
    )
  }
  return (
    <group>
      <mesh geometry={geo} material={MAT.glas} position={[0, 0, z]} />
      <mesh material={MAT.kozijn} position={[0, goot, z + .02]}>
        <boxGeometry args={[gB, STAEL.kozijnDikte, STAEL.kozijnDikte * 1.6]} />
      </mesh>
      {posts}
    </group>
  )
}

// vensterritme op de langsgevels
function LangsGevel({ spec }) {
  const { b, d, goot, stramien } = spec
  const volglas = spec.typologie.glas.langs === 'strook'
  const ramen = []
  for (const kant of [-1, 1]) {
    for (let i = 0; i < stramien; i++) {
      const z = -d / 2 + d * ((i + .5) / stramien)
      const h = volglas ? goot - .55 : (spec.typologie.id === 'loft' ? goot - 1.1 : Math.min(goot - .55, 2.1))
      const w = volglas ? d / stramien - .35 : 1.0
      const y = h / 2 + (volglas ? .05 : .45)
      ramen.push(
        <group key={kant + ':' + i} position={[kant * (b / 2 + .04), y, z]} rotation={[0, kant * Math.PI / 2, 0]}>
          <mesh material={MAT.glas}><planeGeometry args={[w, h]} /></mesh>
          <mesh material={MAT.kozijn} position={[0, 0, -.015]}>
            <boxGeometry args={[w + STAEL.kozijnDikte * 2, h + STAEL.kozijnDikte * 2, .03]} />
          </mesh>
        </group>
      )
    }
  }
  return <group>{ramen}</group>
}

function Aanbouw({ spec }) {
  if (!spec.aanbouw) return null
  const { b, d } = spec
  const a = spec.aanbouw
  const mat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#2b2a26', roughness: .9 }), [])
  return (
    <group position={[-(b / 2 + a.b / 2 - .02), 0, d / 2 - a.d / 2 - .4]}>
      <mesh material={mat} position={[0, a.h / 2, 0]}>
        <boxGeometry args={[a.b, a.h, a.d]} />
      </mesh>
      <mesh material={MAT.staal} position={[0, a.h + .09, 0]}>
        <boxGeometry args={[a.b + .5, .18, a.d + .5]} />
      </mesh>
    </group>
  )
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
      <mesh material={MAT.terras} position={[0, .015, spec.d / 2 + 2.1]}>
        <boxGeometry args={[spec.b * .8, .05, 3.4]} />
      </mesh>
    </group>
  )
}

export function Woning({ spec, programma }) {
  return (
    <group>
      <Romp spec={spec} />
      <Dak spec={spec} />
      <KopGevel spec={spec} />
      <LangsGevel spec={spec} />
      <Aanbouw spec={spec} />
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
      <group position={[0, 0, 0]}>
        <Woning spec={spec} programma={programma} />
      </group>
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
