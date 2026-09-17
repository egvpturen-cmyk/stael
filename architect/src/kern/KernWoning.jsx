import * as THREE from 'three'
import { useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { WAND_DIKTE } from './model.js'

// Domme renderer: tekent uitsluitend wat het gevalideerde model zegt.
// Sparingen zijn echte openingen (gaten in de wandvorm), geen vlakken
// die voor de gevel geplakt worden.

const mat = (kleur, r = .85, m = 0) => new THREE.MeshStandardMaterial({ color: kleur, roughness: r, metalness: m })

function wandGeometrie(wand) {
  const s = new THREE.Shape()
  wand.contour.forEach(([u, v], i) => i === 0 ? s.moveTo(u, v) : s.lineTo(u, v))
  s.closePath()
  for (const sp of wand.sparingen) {
    const gat = new THREE.Path()
    const pts = sp.poly || [
      [sp.rect.u - sp.rect.w / 2, sp.rect.v], [sp.rect.u + sp.rect.w / 2, sp.rect.v],
      [sp.rect.u + sp.rect.w / 2, sp.rect.v + sp.rect.h], [sp.rect.u - sp.rect.w / 2, sp.rect.v + sp.rect.h],
    ]
    pts.forEach(([u, v], i) => i === 0 ? gat.moveTo(u, v) : gat.lineTo(u, v))
    gat.closePath()
    s.holes.push(gat)
  }
  return new THREE.ExtrudeGeometry(s, { depth: WAND_DIKTE, bevelEnabled: false })
}

// kozijnvulling in een sparing: omtrekprofielen langs de randen, glas
// terugliggend in de opening (negge)
function Vulling({ sp, kleuren }) {
  const kozijn = useMemo(() => mat(kleuren.kozijn, .5), [kleuren.kozijn])
  const glasM = useMemo(() => {
    const m = mat(kleuren.glas, .14, .08)
    m.side = THREE.DoubleSide
    return m
  }, [kleuren.glas])
  const pts = sp.poly || [
    [sp.rect.u - sp.rect.w / 2, sp.rect.v], [sp.rect.u + sp.rect.w / 2, sp.rect.v],
    [sp.rect.u + sp.rect.w / 2, sp.rect.v + sp.rect.h], [sp.rect.u - sp.rect.w / 2, sp.rect.v + sp.rect.h],
  ]
  const glasGeo = useMemo(() => {
    const s = new THREE.Shape()
    pts.forEach(([u, v], i) => i === 0 ? s.moveTo(u, v) : s.lineTo(u, v))
    s.closePath()
    return new THREE.ShapeGeometry(s)
  }, [JSON.stringify(pts)]) // eslint-disable-line react-hooks/exhaustive-deps

  const profielen = []
  for (let i = 0; i < pts.length; i++) {
    const [u1, v1] = pts[i], [u2, v2] = pts[(i + 1) % pts.length]
    const len = Math.hypot(u2 - u1, v2 - v1)
    // het kozijn zit midden in de sparing, zoals in echte bouw
    profielen.push(
      <mesh key={'p' + i} material={kozijn}
        position={[(u1 + u2) / 2, (v1 + v2) / 2, WAND_DIKTE / 2]}
        rotation={[0, 0, Math.atan2(v2 - v1, u2 - u1)]}>
        <boxGeometry args={[len, .09, .18]} />
      </mesh>
    )
  }
  // stijlen bij een pui, per stramien
  if (sp.type === 'pui') {
    const us = pts.map(p => p[0])
    const u0 = Math.min(...us), u1 = Math.max(...us)
    const stap = sp.stramien === 'grid' ? 1.05 : sp.stramien === 'vlak' ? 1.9 : .85
    const n = Math.max(2, Math.round((u1 - u0) / stap))
    for (let i = 1; i < n; i++) {
      const u = u0 + ((u1 - u0) / n) * i
      const vTop = randVanPoly(pts, u)
      profielen.push(
        <mesh key={'s' + i} material={kozijn} position={[u, (vTop + pts[0][1]) / 2, WAND_DIKTE / 2]}>
          <boxGeometry args={[.07, vTop - pts[0][1] - .06, .14]} />
        </mesh>
      )
    }
  }
  return (
    <group>
      <mesh geometry={glasGeo} material={glasM} position={[0, 0, WAND_DIKTE / 2 - .06]} />
      {profielen}
    </group>
  )
}

// bovenrand van de sparingpolygon op positie u: interpoleer over de
// bovenranden (de segmenten tussen de punten na de onderrand)
function randVanPoly(pts, u) {
  let beste = Math.max(...pts.map(p => p[1]))
  for (let i = 2; i < pts.length - 1; i++) {
    const [u1, v1] = pts[i], [u2, v2] = pts[i + 1]
    if (u >= Math.min(u1, u2) && u <= Math.max(u1, u2) && Math.abs(u2 - u1) > .001)
      beste = v1 + (v2 - v1) * ((u - u1) / (u2 - u1))
  }
  return beste
}

function Wand({ wand, model }) {
  const geo = useMemo(() => wandGeometrie(wand), [wand])
  const m = useMemo(() => mat(model.kleuren.gevel), [model.kleuren.gevel])
  const vol = model.volumes[0]
  let positie = [0, 0, 0], rotatie = [0, 0, 0]
  if (wand.type === 'kop') {
    positie = [0, 0, wand.richting === 1 ? vol.d / 2 - WAND_DIKTE : -vol.d / 2]
  } else {
    rotatie = [0, wand.kant === 1 ? -Math.PI / 2 : Math.PI / 2, 0]
    positie = [wand.kant * vol.b / 2, 0, 0]
  }
  return (
    <group position={positie} rotation={rotatie}>
      <mesh geometry={geo} material={m} />
      {wand.sparingen.map(sp => <Vulling key={sp.id} sp={sp} kleuren={model.kleuren} />)}
    </group>
  )
}

// vlakmeetkunde van een dakvlak: richting nok->goot, normaal, lengte
function vlakMaat(vlak) {
  const [gu, gv] = vlak.goot2D, [nu, nv] = vlak.nok2D
  const dx = gu - nu, dy = gv - nv
  const n0 = Math.hypot(dx, dy)
  const ux = dx / n0, uy = dy / n0
  let nx = -uy, ny = ux
  if (ny < 0) { nx = -nx; ny = -ny }
  return { nu, nv, ux, uy, nx, ny, n0, hoek: Math.atan2(dy, dx) }
}

function Dakvlak({ vlak, model }) {
  const vol = model.volumes[0]
  const m = useMemo(() => mat(model.kleuren.dak, .6, .1), [model.kleuren.dak])
  const { nu, nv, ux, uy, nx, ny, n0, hoek } = vlakMaat(vlak)
  // het vlak loopt van de nok tot inzet binnen de gevel (strak) of tot
  // voorbij de gevel (kolossaal overstek)
  const len = n0 - vlak.inzetLangs + vlak.overstekLangs
  const cx = nu + ux * (len / 2) + nx * (vlak.dikte / 2)
  const cy = nv + uy * (len / 2) + ny * (vlak.dikte / 2)
  const diepte = vol.d + 2 * vlak.overstekKop
  return (
    <mesh material={m} position={[cx, cy, 0]} rotation={[0, 0, hoek]}>
      <boxGeometry args={[len, vlak.dikte, diepte]} />
    </mesh>
  )
}

function Randafwerking({ rand, model }) {
  const vol = model.volumes[0]
  const gevelM = useMemo(() => mat(model.kleuren.gevel), [model.kleuren.gevel])
  const kozijn = useMemo(() => mat(model.kleuren.kozijn, .5), [model.kleuren.kozijn])
  const dak = useMemo(() => mat(model.kleuren.dak, .55, .1), [model.kleuren.dak])
  const staal = useMemo(() => mat('#26262a', .45, .3), [])
  const diepte = vol.d + 2 * vol.overstekKop

  if (rand.type === 'nokvouw') {
    // een doorlopend knikprofiel: de vouwlijn ligt exact op de noklijn,
    // de flanken sluiten strak op beide plaatbovenvlakken aan.
    // Het profiel komt kant-en-klaar uit het model.
    const s = new THREE.Shape()
    rand.profiel.forEach(([x, y], i) => i === 0 ? s.moveTo(x, y) : s.lineTo(x, y))
    s.closePath()
    const geo = new THREE.ExtrudeGeometry(s, { depth: rand.diepte, bevelEnabled: false })
    geo.translate(0, 0, -rand.diepte / 2)
    return <mesh geometry={geo} material={dak} />
  }
  if (rand.type === 'boeideel') {
    // strak: de gevel loopt als boeideel door tot boven de dakrand,
    // een vlak met de gevelbeplating; de goot ligt verholen daarachter
    const vlak = model.dakvlakken.find(v => v.kant === rand.kant)
    const dikV = vlak.dikte / Math.cos(Math.atan2(vol.nok - vol.goot, vol.b / 2 - Math.abs(vol.nokOffset)))
    const h = dikV + .12
    return (
      <mesh material={gevelM} position={[rand.kant * (vol.b / 2 + .005), vol.goot + h / 2 - .01, 0]}>
        <boxGeometry args={[.04, h, vol.d]} />
      </mesh>
    )
  }
  if (rand.type === 'boeikop') {
    // strak: dun doorlopend boeideel langs de daklijn van de kopgevel;
    // bij de nok ingekort met de vouwbreedte zodat hij exact tot in de
    // vouw loopt in plaats van erbovenuit te kruisen
    return model.dakvlakken.map(vlak => {
      const { nu, nv, ux, uy, nx, ny, n0, hoek } = vlakMaat(vlak)
      const trim = rand.nokTrim ?? 0
      const len = n0 - vlak.inzetLangs - trim + .04
      const h = vlak.dikte + .12
      const cx = nu + ux * (trim + len / 2 - .04) + nx * (vlak.dikte / 2 + .01)
      const cy = nv + uy * (trim + len / 2 - .04) + ny * (vlak.dikte / 2 + .01)
      return (
        <mesh key={vlak.id} material={gevelM}
          position={[cx, cy, rand.richting * (vol.d / 2 + .005)]}
          rotation={[0, 0, hoek]}>
          <boxGeometry args={[len, h, .04]} />
        </mesh>
      )
    })
  }
  if (rand.type === 'randprofiel') {
    // kolossaal: dun randprofiel aan het einde van het overstek
    const vlak = model.dakvlakken.find(v => v.kant === rand.kant)
    const { nu, nv, ux, uy, n0 } = vlakMaat(vlak)
    const eind = n0 - vlak.inzetLangs + vlak.overstekLangs
    const eu = nu + ux * eind, ev = nv + uy * eind
    return (
      <mesh material={kozijn} position={[eu, ev + vlak.dikte / 2 + .01, 0]}>
        <boxGeometry args={[.04, .12, diepte]} />
      </mesh>
    )
  }
  if (rand.type === 'windveer') {
    // kolossaal: slanke windveer langs de daklijn op de koprand,
    // bij de nok ingekort tot in de vouw
    return model.dakvlakken.map(vlak => {
      const { nu, nv, ux, uy, nx, ny, n0, hoek } = vlakMaat(vlak)
      const trim = rand.nokTrim ?? 0
      const len = n0 - vlak.inzetLangs + vlak.overstekLangs - trim + .04
      const cx = nu + ux * (trim + len / 2 - .04) + nx * (vlak.dikte / 2)
      const cy = nv + uy * (trim + len / 2 - .04) + ny * (vlak.dikte / 2)
      return (
        <mesh key={vlak.id} material={kozijn}
          position={[cx, cy, rand.richting * (vol.d / 2 + vlak.overstekKop - .025)]}
          rotation={[0, 0, hoek]}>
          <boxGeometry args={[len, vlak.dikte + .06, .05]} />
        </mesh>
      )
    })
  }
  if (rand.type === 'gordingen') {
    // kolossaal: zichtbare slanke profielen onder het overstek
    const vlak = model.dakvlakken.find(v => v.kant === rand.kant)
    const { nu, nv, ux, uy, nx, ny, n0, hoek } = vlakMaat(vlak)
    const n = Math.max(2, Math.round(vol.d / .9))
    const len = vlak.overstekLangs + 1.1
    // keper eindigt gelijk met de dakrand en steekt binnendoor terug
    const sCentrum = n0 - vlak.inzetLangs + vlak.overstekLangs - len / 2
    const cx = nu + ux * sCentrum + nx * -.08
    const cy = nv + uy * sCentrum + ny * -.08
    const kepers = []
    for (let i = 0; i <= n; i++) {
      const z = -vol.d / 2 + (vol.d / n) * i
      kepers.push(
        <mesh key={i} material={staal} position={[cx, cy, z]} rotation={[0, 0, hoek]}>
          <boxGeometry args={[len, .12, .06]} />
        </mesh>
      )
    }
    return <group>{kepers}</group>
  }
  return null
}

export function KernGebouw({ model }) {
  return (
    <group>
      {model.wanden.map(w => <Wand key={w.id} wand={w} model={model} />)}
      {model.dakvlakken.map(v => <Dakvlak key={v.id} vlak={v} model={model} />)}
      {model.randafwerking.map((r, i) => <Randafwerking key={i} rand={r} model={model} />)}
      <mesh material={useMemo(() => mat('#3a4630', 1), [])} rotation={[-Math.PI / 2, 0, 0]} position={[0, -.01, 0]}>
        <circleGeometry args={[Math.max(model.volumes[0].b, model.volumes[0].d) * 1.4, 48]} />
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
