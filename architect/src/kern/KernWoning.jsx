import * as THREE from 'three'
import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'
import { leidGeometrieAf } from './afleiding.js'

const csg = new Evaluator()

// Domme renderer: tekent uitsluitend de primitieven die uit de gedeelde
// geometrie-afleiding komen. De gesloten-schil-validatie sampelt tegen
// exact dezelfde lijst, dus wat hier staat is wat gecontroleerd is.

const matCache = new Map()
function matVoor(kleur, rol) {
  const sleutel = kleur + '|' + rol
  if (!matCache.has(sleutel)) {
    const eig = rol === 'glas' ? { roughness: .14, metalness: .08 }
      : rol === 'dak' || rol === 'nokvouw' ? { roughness: .6, metalness: .1 }
      : rol === 'kozijn' || rol === 'balkon' || rol === 'windveer' || rol === 'randprofiel' || rol === 'gording' || rol === 'balustrade' || rol === 'pergola' || rol === 'kolom' ? { roughness: .5, metalness: .2 }
      : { roughness: .85, metalness: 0 }
    matCache.set(sleutel, new THREE.MeshStandardMaterial({ color: kleur, ...eig }))
  }
  return matCache.get(sleutel)
}

function Prim({ prim }) {
  // rotatieconventie wereld = T . Ry . Rz . Rx = three euler 'YZX'
  const rot = prim.rot || [0, prim.ry || 0, prim.rz || 0]
  const { geo, wereldvast } = useMemo(() => {
    let g
    if (prim.vorm === 'box') {
      g = new THREE.BoxGeometry(...prim.size)
    } else {
      const s = new THREE.Shape()
      prim.contour.forEach(([u, v], i) => i === 0 ? s.moveTo(u, v) : s.lineTo(u, v))
      s.closePath()
      for (const gat of prim.holes) {
        const h = new THREE.Path()
        gat.forEach(([u, v], i) => i === 0 ? h.moveTo(u, v) : h.lineTo(u, v))
        h.closePath()
        s.holes.push(h)
      }
      g = new THREE.ExtrudeGeometry(s, { depth: prim.dikte, bevelEnabled: false })
    }
    if (!prim.snijvlakken || !prim.snijvlakken.length) return { geo: g, wereldvast: false }
    // echte boolean-snede op de halfruimten uit het model (three-bvh-csg):
    // dezelfde vlakken waar de validator tegen sampelt
    const mtx = new THREE.Matrix4().compose(
      new THREE.Vector3(...prim.pos),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(rot[0], rot[1], rot[2], 'YZX')),
      new THREE.Vector3(1, 1, 1))
    let brush = new Brush(g.clone().applyMatrix4(mtx))
    brush.updateMatrixWorld()
    for (const s of prim.snijvlakken) {
      const n = new THREE.Vector3(...s.n).normalize()
      const blok = new Brush(new THREE.BoxGeometry(80, 40, 80))
      blok.position.set(s.p[0] - n.x * 20, s.p[1] - n.y * 20, s.p[2] - n.z * 20)
      blok.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n)
      blok.updateMatrixWorld()
      brush = csg.evaluate(brush, blok, SUBTRACTION)
      brush.updateMatrixWorld()
    }
    return { geo: brush.geometry, wereldvast: true }
  }, [prim]) // eslint-disable-line react-hooks/exhaustive-deps
  const m = matVoor(prim.kleur, prim.rol)
  if (wereldvast) return <mesh material={m} geometry={geo} />
  return (
    <mesh material={m} geometry={geo} position={prim.pos}
      rotation={new THREE.Euler(rot[0], rot[1], rot[2], 'YZX')} />
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
