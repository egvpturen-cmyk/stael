import * as THREE from 'three'
import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { leidGeometrieAf } from './afleiding.js'

// Domme renderer: tekent uitsluitend de primitieven die uit de gedeelde
// geometrie-afleiding komen. De gesloten-schil-validatie sampelt tegen
// exact dezelfde lijst, dus wat hier staat is wat gecontroleerd is.

const matCache = new Map()
function matVoor(kleur, rol) {
  const sleutel = kleur + '|' + rol
  if (!matCache.has(sleutel)) {
    const eig = rol === 'glas' ? { roughness: .14, metalness: .08 }
      : rol === 'dak' || rol === 'nokvouw' ? { roughness: .6, metalness: .1 }
      : rol === 'kozijn' || rol === 'balkon' || rol === 'windveer' || rol === 'randprofiel' || rol === 'gording' ? { roughness: .5, metalness: .2 }
      : { roughness: .85, metalness: 0 }
    matCache.set(sleutel, new THREE.MeshStandardMaterial({ color: kleur, ...eig }))
  }
  return matCache.get(sleutel)
}

function Prim({ prim }) {
  const geo = useMemo(() => {
    if (prim.vorm === 'box') return null
    const s = new THREE.Shape()
    prim.contour.forEach(([u, v], i) => i === 0 ? s.moveTo(u, v) : s.lineTo(u, v))
    s.closePath()
    for (const gat of prim.holes) {
      const h = new THREE.Path()
      gat.forEach(([u, v], i) => i === 0 ? h.moveTo(u, v) : h.lineTo(u, v))
      h.closePath()
      s.holes.push(h)
    }
    return new THREE.ExtrudeGeometry(s, { depth: prim.dikte, bevelEnabled: false })
  }, [prim])
  const m = matVoor(prim.kleur, prim.rol)
  return (
    <group position={prim.pos} rotation-y={prim.ry || 0}>
      {prim.vorm === 'box'
        ? <mesh material={m} rotation-z={prim.rz || 0}><boxGeometry args={prim.size} /></mesh>
        : <mesh material={m} geometry={geo} />}
    </group>
  )
}

export function KernGebouw({ model }) {
  const prims = useMemo(() => leidGeometrieAf(model), [model])
  const gras = useMemo(() => new THREE.MeshStandardMaterial({ color: '#3a4630', roughness: 1 }), [])
  const vol = model.volumes[0]
  return (
    <group>
      {prims.map((p, i) => <Prim key={i} prim={p} />)}
      <mesh material={gras} rotation={[-Math.PI / 2, 0, 0]} position={[0, -.01, 0]}>
        <circleGeometry args={[Math.max(vol.b, vol.d) * 1.4, 48]} />
      </mesh>
    </group>
  )
}

export default function KernCanvas({ model, camera }) {
  return (
    <Canvas dpr={[1, 1.75]} camera={{ position: camera.pos, fov: camera.fov ?? 40 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}>
      <color attach="background" args={['#1a1a1d']} />
      <ambientLight intensity={.35} color="#e8e4dc" />
      <hemisphereLight args={['#d8dde6', '#4a4438', 1.2]} />
      <directionalLight position={[14, 18, 9]} intensity={2.6} color="#ffe8d2" />
      <directionalLight position={[-10, 6, -8]} intensity={.8} color="#9fb2c8" />
      <KernGebouw model={model} />
      <OrbitControls target={camera.doel} enablePan={false} />
    </Canvas>
  )
}
