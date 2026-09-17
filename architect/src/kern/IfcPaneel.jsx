import * as THREE from 'three'
import { useEffect, useState, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'

// Vergelijkpaneel: de gerealiseerde STAEL-woning uit het IFC-bestand,
// geconverteerd naar een compacte mesh (scripts/ifc-analyse.mjs).

let cache = null
async function laadIfc() {
  if (cache) return cache
  const meta = await (await fetch('./ifc/meta.json')).json()
  const buf = await (await fetch('./ifc/model.bin')).arrayBuffer()
  const data = new Int16Array(buf)
  const groepen = meta.groepen.map(g => {
    const pos = new Float32Array(g.aantal * 3)
    for (let i = 0; i < g.aantal * 3; i++) pos[i] = data[(g.offset * 3) + i] * meta.schaal
    const geo = new THREE.BufferGeometry()
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3))
    geo.computeVertexNormals()
    const kleur = new THREE.Color(g.kleur[0] / 255, g.kleur[1] / 255, g.kleur[2] / 255)
    return { geo, mat: new THREE.MeshStandardMaterial({ color: kleur, roughness: .7, metalness: .15 }) }
  })
  cache = { groepen, laagsteY: meta.laagsteY }
  return cache
}

export default function IfcPaneel({ camera }) {
  const [model, zetModel] = useState(null)
  const [fout, zetFout] = useState(null)
  useEffect(() => { laadIfc().then(zetModel).catch(e => zetFout(String(e))) }, [])
  if (fout) return <div className="kernfouten">IFC laden mislukt: {fout}</div>
  if (!model) return <div className="kernladen">IFC-model laden…</div>
  return (
    <Canvas dpr={[1, 1.5]} frameloop="demand" camera={{ position: camera.pos, fov: camera.fov ?? 40 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}>
      <color attach="background" args={['#1a1a1d']} />
      <ambientLight intensity={.4} color="#e8e4dc" />
      <hemisphereLight args={['#d8dde6', '#4a4438', 1.1]} />
      <directionalLight position={[14, 18, 9]} intensity={2.4} color="#ffe8d2" />
      <directionalLight position={[-10, 6, -8]} intensity={.9} color="#9fb2c8" />
      <group position={[0, -model.laagsteY, 0]}>
        {model.groepen.map((g, i) => <mesh key={i} geometry={g.geo} material={g.mat} />)}
      </group>
      <OrbitControls target={camera.doel} />
    </Canvas>
  )
}
