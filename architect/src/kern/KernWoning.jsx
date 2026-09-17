import * as THREE from 'three'
import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { Brush, Evaluator, SUBTRACTION } from 'three-bvh-csg'
import { leidGeometrieAf } from './afleiding.js'
import { MATERIALEN, materiaalKleur, KOZIJN } from './materialen.js'

const csg = new Evaluator()
const BASIS_URL = './materialen/'

// Domme renderer: tekent uitsluitend de primitieven die uit de gedeelde
// geometrie-afleiding komen. De gesloten-schil-validatie sampelt tegen
// exact dezelfde lijst, dus wat hier staat is wat gecontroleerd is.
// Fase 2: PBR-materialen uit de bibliotheek (materialen.js), HDRI-licht
// met zachte schaduwen; de geometrie zelf is ongewijzigd.

// ---- texturen: gedeeld beeld, eigen herhaal/rotatie per materiaal ----
const texCache = new Map()
function laadTex(url, srgb) {
  const key = url + (srgb ? '|s' : '')
  if (!texCache.has(key)) {
    const t = new THREE.TextureLoader().load(url)
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    if (srgb) t.colorSpace = THREE.SRGBColorSpace
    t.anisotropy = 4
    texCache.set(key, t)
  }
  return texCache.get(key)
}
function tex(url, srgb, repeat, rotatie) {
  const key = url + '|' + repeat.join(',') + '|' + (rotatie ? 1 : 0) + (srgb ? '|s' : '')
  if (!texCache.has(key)) {
    const t = laadTex(url, srgb).clone()
    t.repeat.set(repeat[0], repeat[1])
    if (rotatie) { t.rotation = Math.PI / 2; t.center.set(.5, .5) }
    t.needsUpdate = true
    texCache.set(key, t)
  }
  return texCache.get(key)
}

// procedurele naad-normalmaps: staande felsnaad en rabatgroef, met
// exacte hartafstand in meters; as 'x' voor gevels (verticale naden),
// 'y' voor dakvlakken (naden in de hellingrichting)
function naadTex(soort, as, afstand) {
  const key = 'naad|' + soort + '|' + as + '|' + afstand
  if (!texCache.has(key)) {
    const B = 256, H = 4
    const d = new Uint8Array(B * H * 4)
    for (let y = 0; y < H; y++) for (let x = 0; x < B; x++) {
      let n = 128
      if (soort === 'fels') {
        if (x < 3) n = 208
        else if (x < 6) n = 48
        else if (x < 8) n = 150
      } else {
        if (x < 3) n = 38
        else if (x < 6) n = 218
        else n = 128 + Math.round(9 * Math.sin(x * 1.7) * Math.cos(x * .31))
      }
      const i = (y * B + x) * 4
      d[i] = as === 'x' ? n : 128
      d[i + 1] = as === 'x' ? 128 : n
      d[i + 2] = 255
      d[i + 3] = 255
    }
    let t = new THREE.DataTexture(d, B, H)
    if (as === 'y') {
      // variatie moet in v lopen: zet de data om naar een staande strook
      const d2 = new Uint8Array(H * B * 4)
      for (let y = 0; y < B; y++) for (let x = 0; x < H; x++) {
        const bron = (0 * B + y) * 4, doel = (y * H + x) * 4
        d2[doel] = 128; d2[doel + 1] = d[bron]; d2[doel + 2] = 255; d2[doel + 3] = 255
      }
      t = new THREE.DataTexture(d2, H, B)
    }
    t.wrapS = t.wrapT = THREE.RepeatWrapping
    t.needsUpdate = true
    t.repeat.set(as === 'x' ? 1 / afstand : 1, as === 'x' ? 1 : 1 / afstand)
    texCache.set(key, t)
  }
  return texCache.get(key)
}

// ---- materialen ----
const matCache = new Map()
function bibMat(m, rol) {
  const def = MATERIALEN[m.mat]
  if (!def) return null
  const hex = m.hex || materiaalKleur(m.mat, m.kleur) || '#999999'
  const key = m.mat + '|' + hex
  if (matCache.has(key)) return matCache.get(key)
  const mat = new THREE.MeshStandardMaterial({
    color: hex,
    metalness: def.metalness ?? 0,
    roughness: def.ruwte ?? def.roughness ?? 1,
  })
  if (def.dir) {
    const rep = [1 / def.tegel[0], 1 / def.tegel[1]]
    if (def.kleurmap) mat.map = tex(BASIS_URL + def.dir + '/color.jpg', true, rep, def.rotatie)
    mat.roughnessMap = tex(BASIS_URL + def.dir + '/roughness.jpg', false, rep, def.rotatie)
    if (!def.felsNaad && !def.rabatNaad) {
      mat.normalMap = tex(BASIS_URL + def.dir + '/normal.jpg', false, rep, def.rotatie)
      mat.normalScale = new THREE.Vector2(.8, .8)
    }
  }
  if (def.felsNaad) {
    mat.normalMap = naadTex('fels', def.cat === 'dak' ? 'y' : 'x', def.felsNaad)
    mat.normalScale = new THREE.Vector2(.75, .75)
  }
  if (def.rabatNaad) {
    mat.normalMap = naadTex('rabat', 'x', def.rabatNaad)
    mat.normalScale = new THREE.Vector2(.55, .55)
  }
  matCache.set(key, mat)
  return mat
}
function basisMat(kleur, rol) {
  const sleutel = 'basis|' + kleur + '|' + rol
  if (!matCache.has(sleutel)) {
    const eig = rol === 'glas' ? { roughness: .07, metalness: .45, envMapIntensity: 1.25 }
      : ['kozijn', 'balkon', 'windveer', 'randprofiel', 'gording', 'balustrade', 'pergola', 'kolom'].includes(rol)
        ? { roughness: KOZIJN.roughness, metalness: KOZIJN.metalness }
        : rol === 'dak' || rol === 'nokvouw' ? { roughness: .6, metalness: .1 }
        : { roughness: .85, metalness: 0 }
    matCache.set(sleutel, new THREE.MeshStandardMaterial({ color: kleur, ...eig }))
  }
  return matCache.get(sleutel)
}
function matVoor(prim) {
  if (prim.mat) {
    const m = bibMat(prim.mat, prim.rol)
    if (m) return m
  }
  return basisMat(prim.kleur, prim.rol)
}

// box met UV's in meters, zodat texturen wereldvast herhalen
function boxGeoWereldUV(size) {
  const g = new THREE.BoxGeometry(...size)
  const uv = g.attributes.uv
  const paren = [[2, 1], [2, 1], [0, 2], [0, 2], [0, 1], [0, 1]]
  for (let f = 0; f < 6; f++) {
    const [ua, va] = paren[f]
    for (let i = f * 4; i < f * 4 + 4; i++) {
      uv.setXY(i, uv.getX(i) * size[ua], uv.getY(i) * size[va])
    }
  }
  return g
}

function Prim({ prim }) {
  // rotatieconventie wereld = T . Ry . Rz . Rx = three euler 'YZX'
  const rot = prim.rot || [0, prim.ry || 0, prim.rz || 0]
  const { geo, wereldvast } = useMemo(() => {
    let g
    if (prim.vorm === 'box') {
      g = boxGeoWereldUV(prim.size)
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
  const m = matVoor(prim)
  if (wereldvast) return <mesh material={m} geometry={geo} castShadow receiveShadow />
  return (
    <mesh material={m} geometry={geo} position={prim.pos} castShadow receiveShadow
      rotation={new THREE.Euler(rot[0], rot[1], rot[2], 'YZX')} />
  )
}

export function KernGebouw({ model, kavel }) {
  const prims = useMemo(() => leidGeometrieAf(model), [model])
  const voet = model.volumes.reduce((s, v) => s + v.b * v.d, 0)
  // rustige kavelcontext: gras op de kavelmaat, lage erfgrenshaag,
  // bestraat pad naar de entree, veldgroen tot de horizon
  const kavelOpp = kavel || Math.max(500, voet * 3.2)
  const kb = Math.sqrt(kavelOpp * 1.35)
  const kd = kavelOpp / kb
  const maxZ = Math.max(...model.volumes.map(v => (v.pos ? v.pos[1] : 0) + v.d / 2))
  const padLen = Math.max(1.5, kd / 2 - maxZ - .3)
  const gras = bibMat({ mat: 'gras', kleur: 'gras' }, 'terrein') || basisMat('#5a6349', 'terrein')
  const straat = bibMat({ mat: 'bestrating', kleur: 'grijs' }, 'terrein') || basisMat('#8b8b86', 'terrein')
  const veld = basisMat('#66705a', 'terrein')
  const haag = basisMat('#3d4a36', 'haag')
  return (
    <group>
      {prims.map((p, i) => <Prim key={i} prim={p} />)}
      <mesh material={gras} rotation={[-Math.PI / 2, 0, 0]} position={[0, -.005, 0]} receiveShadow>
        <planeGeometry args={[kb, kd]} />
      </mesh>
      <mesh material={veld} rotation={[-Math.PI / 2, 0, 0]} position={[0, -.04, 0]} receiveShadow>
        <circleGeometry args={[240, 48]} />
      </mesh>
      {padLen > 1 && (
        <mesh material={straat} position={[0, .012, maxZ + .2 + padLen / 2]} receiveShadow>
          <boxGeometry args={[1.7, .025, padLen]} />
        </mesh>
      )}
      {[[0, -kd / 2], [0, kd / 2]].map(([x, z], i) => (
        <mesh key={'h' + i} material={haag} position={[x, .22, z]} castShadow receiveShadow>
          <boxGeometry args={[kb + .25, .45, .3]} />
        </mesh>
      ))}
      {[[-kb / 2, 0], [kb / 2, 0]].map(([x, z], i) => (
        <mesh key={'v' + i} material={haag} position={[x, .22, z]} castShadow receiveShadow>
          <boxGeometry args={[.3, .45, kd + .25]} />
        </mesh>
      ))}
    </group>
  )
}

export default function KernCanvas({ model, camera, kavel }) {
  const maat = Math.max(...model.volumes.map(v => Math.max(v.b, v.d))) + 8
  return (
    <Canvas shadows frameloop="demand" dpr={[1, 1.75]} camera={{ position: camera.pos, fov: camera.fov ?? 40 }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      onCreated={({ gl }) => { gl.toneMapping = THREE.ACESFilmicToneMapping; gl.toneMappingExposure = .85 }}>
      <Environment files="./omgeving/lucht.hdr" background backgroundBlurriness={.04} />
      <directionalLight castShadow position={[14, 20, 10]} intensity={2.4} color="#fff2df"
        shadow-mapSize-width={2048} shadow-mapSize-height={2048}
        shadow-radius={5} shadow-bias={-0.0004} shadow-normalBias={.02}
        shadow-camera-left={-maat} shadow-camera-right={maat}
        shadow-camera-top={maat} shadow-camera-bottom={-maat}
        shadow-camera-near={1} shadow-camera-far={60} />
      <KernGebouw model={model} kavel={kavel} />
      <OrbitControls target={camera.doel} enablePan={false} maxPolarAngle={Math.PI * .52} />
    </Canvas>
  )
}
