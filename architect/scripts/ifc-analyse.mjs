// Analyse en conversie van de STAEL-referentiewoning (IFC4, tessellated).
// 1. meet hoofdmaten, dakhelling, plaatdiktes en dakranddetail
// 2. exporteert de geometrie als compacte binaire mesh voor het
//    vergelijkpaneel op /kern (public/ifc/model.bin + meta.json)
// Gebruik: node scripts/ifc-analyse.mjs ../referenties/ifc/staelwoning.ifc

import { createReadStream, writeFileSync, mkdirSync } from 'fs'
import { createInterface } from 'readline'

const pad = process.argv[2] || '../referenties/ifc/staelwoning.ifc'

const puntlijsten = new Map()   // id -> Float64Array plat xyz
const faces = new Map()         // id -> int[] indices (1-based)
const facesets = []             // { id, puntlijst, faceIds }
const stijlen = new Map()       // stijlId -> [r,g,b]
const stijlItem = new Map()     // geomId -> stijlId
const rgb = new Map()           // colourId -> [r,g,b]

const rl = createInterface({ input: createReadStream(pad), crlfDelay: Infinity })
const idVan = s => parseInt(s.slice(1))

for await (const regel of rl) {
  const m = regel.match(/^#(\d+)= IFC([A-Z0-9]+)\((.*)\);?\s*$/)
  if (!m) continue
  const id = parseInt(m[1]), type = m[2], rest = m[3]
  if (type === 'CARTESIANPOINTLIST3D') {
    const nums = rest.match(/-?\d+\.?\d*(?:E-?\d+)?/g).map(Number)
    puntlijsten.set(id, nums)
  } else if (type === 'INDEXEDPOLYGONALFACE' || type === 'INDEXEDPOLYGONALFACEWITHVOIDS') {
    const buiten = rest.match(/\(([^)]*)\)/)
    faces.set(id, buiten[1].split(',').map(Number))
  } else if (type === 'POLYGONALFACESET') {
    const refs = rest.match(/#\d+/g).map(idVan)
    facesets.push({ id, puntlijst: refs[0], faceIds: refs.slice(1) })
  } else if (type === 'COLOURRGB') {
    const nums = rest.match(/-?\d+\.?\d*(?:E-?\d+)?/g).map(Number)
    rgb.set(id, nums.slice(-3))
  } else if (type === 'SURFACESTYLERENDERING') {
    const ref = rest.match(/#\d+/)
    stijlen.set(id, ref ? idVan(ref[0]) : null) // -> colourId
  } else if (type === 'SURFACESTYLE') {
    const refs = rest.match(/#\d+/g)
    if (refs) stijlen.set(id, stijlen.get(idVan(refs[0])))
  } else if (type === 'STYLEDITEM') {
    const refs = rest.match(/#\d+/g)
    if (refs && refs.length >= 2) stijlItem.set(idVan(refs[0]), idVan(refs[1]))
  }
}

// ---- per faceset: bbox ----
let setInfo = facesets.map(fs => {
  const nums = puntlijsten.get(fs.puntlijst) || []
  let mn = [1e9, 1e9, 1e9], mx = [-1e9, -1e9, -1e9]
  for (let i = 0; i < nums.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      if (nums[i + a] < mn[a]) mn[a] = nums[i + a]
      if (nums[i + a] > mx[a]) mx[a] = nums[i + a]
    }
  }
  const dim = [mx[0] - mn[0], mx[1] - mn[1], mx[2] - mn[2]]
  const c = [(mn[0] + mx[0]) / 2, (mn[1] + mx[1]) / 2, (mn[2] + mx[2]) / 2]
  return { fs, mn, mx, dim, c, dun: Math.min(...dim), diag: Math.hypot(...dim) }
})

// hoofdcluster: het model bevat ook elementen ver van het gebouw
// (werkvloeren, hulpstukken); neem de mediaan van de set-centra en
// houd alles binnen 20 m daarvan
const medi = as => {
  const v = setInfo.map(s => s.c[as]).sort((a, b) => a - b)
  return v[Math.floor(v.length / 2)]
}
const centrum = [medi(0), medi(1)]
const buiten = setInfo.filter(s => Math.hypot(s.c[0] - centrum[0], s.c[1] - centrum[1]) > 20).length
setInfo = setInfo.filter(s => Math.hypot(s.c[0] - centrum[0], s.c[1] - centrum[1]) <= 20)
const hoofdset = new Set(setInfo.map(s => s.fs.id))
console.log('== CLUSTER ==', buiten, 'sets buiten het hoofdcluster genegeerd,', setInfo.length, 'behouden')

let min = [1e9, 1e9, 1e9], max = [-1e9, -1e9, -1e9]
const zHist = new Map()
for (const s of setInfo) {
  const nums = puntlijsten.get(s.fs.puntlijst)
  for (let i = 0; i < nums.length; i += 3) {
    for (let a = 0; a < 3; a++) {
      if (nums[i + a] < min[a]) min[a] = nums[i + a]
      if (nums[i + a] > max[a]) max[a] = nums[i + a]
    }
    const z = Math.round(nums[i + 2] * 20) / 20
    zHist.set(z, (zHist.get(z) || 0) + 1)
  }
}

console.log('== HOOFDMATEN GEBOUW (meters) ==')
console.log('voetafdruk X:', (max[0] - min[0]).toFixed(2), ' Y:', (max[1] - min[1]).toFixed(2), ' hoogte:', (max[2] - min[2]).toFixed(2))
console.log('laagste z=', min[2].toFixed(2), ' nok/top z=', max[2].toFixed(2))

const topZ = [...zHist.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12)
  .sort((a, b) => a[0] - b[0])
console.log('== Z-HISTOGRAM (piekvlakken: vloeren, goot, nok) ==')
topZ.forEach(([z, n]) => console.log('  z=' + z.toFixed(2) + '  (' + n + ' punten)'))

// as-aligned dunne platen: gevelbeplating (dikte horizontaal) en
// vlakke platen (dikte verticaal)
const dunne = setInfo.filter(s => s.dun > 0 && s.dun < .005 && s.diag > .8)
const gevelPl = dunne.filter(s => s.dim[2] > 1 && (s.dun === s.dim[0] || s.dun === s.dim[1]))
console.log('== GEVELBEPLATING (dun, verticaal) ==', gevelPl.length, 'sets')
if (gevelPl.length) {
  const dk = new Map()
  gevelPl.forEach(s => { const d = Math.round(s.dun * 1000 * 2) / 2; dk.set(d, (dk.get(d) || 0) + 1) })
  console.log('  diktes:', [...dk.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([d, n]) => d + 'mm x' + n).join(', '))
  const topjes = gevelPl.map(s => s.mx[2]).sort((a, b) => a - b)
  console.log('  bovenkant gevelbeplating: mediaan z=' + topjes[Math.floor(topjes.length / 2)].toFixed(2)
    + ', max z=' + topjes[topjes.length - 1].toFixed(2))
}

// hellende dakelementen: groot, hoog, en scheef (bbox-hoogte groot
// maar geen verticale plaat en geen vlakke vloer)
const nokZ = max[2]
const dakK = setInfo.filter(s => s.mx[2] > nokZ - 3.2 && s.diag > 2.5
  && s.dim[2] > .4 && s.dim[2] < 3.4 && Math.max(s.dim[0], s.dim[1]) > 2)
if (dakK.length) {
  const hellingen = dakK.map(s => {
    const run = Math.min(...[s.dim[0], s.dim[1]].filter(d => d > .5))
    return Math.atan2(s.dim[2], run) * 180 / Math.PI
  }).filter(h => h > 3 && h < 80).sort((a, b) => a - b)
  console.log('== HELLENDE DAKELEMENTEN ==', dakK.length, 'sets; helling: min',
    hellingen[0]?.toFixed(1), 'mediaan', hellingen[Math.floor(hellingen.length / 2)]?.toFixed(1),
    'max', hellingen[hellingen.length - 1]?.toFixed(1), 'graden')
  let dMin = [1e9, 1e9], dMax = [-1e9, -1e9]
  dakK.forEach(s => {
    dMin[0] = Math.min(dMin[0], s.mn[0]); dMin[1] = Math.min(dMin[1], s.mn[1])
    dMax[0] = Math.max(dMax[0], s.mx[0]); dMax[1] = Math.max(dMax[1], s.mx[1])
  })
  // onderbouw-bbox: grote elementen onder de gootzone
  const onder = setInfo.filter(s => s.mx[2] < nokZ - 3.2 && s.diag > 2)
  if (onder.length) {
    let gMin = [1e9, 1e9], gMax = [-1e9, -1e9]
    onder.forEach(s => {
      gMin[0] = Math.min(gMin[0], s.mn[0]); gMin[1] = Math.min(gMin[1], s.mn[1])
      gMax[0] = Math.max(gMax[0], s.mx[0]); gMax[1] = Math.max(gMax[1], s.mx[1])
    })
    console.log('== DAKRAND T.O.V. ONDERBOUW (meters, + is overstek) ==')
    console.log('  x-: ' + (gMin[0] - dMin[0]).toFixed(3) + '  x+: ' + (dMax[0] - gMax[0]).toFixed(3)
      + '  y-: ' + (gMin[1] - dMin[1]).toFixed(3) + '  y+: ' + (dMax[1] - gMax[1]).toFixed(3))
  }
}

// ---- export vergelijkmesh ----
const groepen = new Map() // kleurHex -> posities[]
let driehoeken = 0
for (const s of setInfo) {
  const { fs } = s
  if (s.diag < .35) continue // bouten, ringen en klein bevestigingswerk
  const nums = puntlijsten.get(fs.puntlijst)
  if (!nums) continue
  const stijl = stijlItem.get(fs.id)
  const kleurId = stijl != null ? stijlen.get(stijl) : null
  const kleur = kleurId != null && rgb.get(kleurId) ? rgb.get(kleurId) : [.7, .7, .72]
  const hex = kleur.map(c => Math.round(c * 255)).join(',')
  if (!groepen.has(hex)) groepen.set(hex, [])
  const uit = groepen.get(hex)
  for (const fid of fs.faceIds) {
    const idx = faces.get(fid)
    if (!idx || idx.length < 3) continue
    for (let i = 1; i < idx.length - 1; i++) {
      for (const j of [0, i, i + 1]) {
        const p = (idx[j] - 1) * 3
        uit.push(nums[p], nums[p + 2], -nums[p + 1]) // z-omhoog -> y-omhoog
      }
      driehoeken++
    }
  }
}
mkdirSync('public/ifc', { recursive: true })
const meta = []
let totaal = 0
for (const [hex, pos] of groepen) { meta.push({ kleur: hex.split(',').map(Number), offset: totaal, aantal: pos.length / 3 }); totaal += pos.length / 3 }
// Int16-kwantisatie op de gebouw-bbox houdt het bestand klein genoeg
// voor het vergelijkpaneel; resolutie < 1 mm bij deze maten
const cx = (min[0] + max[0]) / 2, cy = (min[2] + max[2]) / 2, cz = -(min[1] + max[1]) / 2
const schaal = Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]) / 2 / 32000
const buf = new Int16Array(totaal * 3)
let cursor = 0
for (const [, pos] of groepen) {
  for (let i = 0; i < pos.length; i += 3) {
    buf[cursor++] = Math.round((pos[i] - cx) / schaal)
    buf[cursor++] = Math.round((pos[i + 1] - cy) / schaal)
    buf[cursor++] = Math.round((pos[i + 2] - cz) / schaal)
  }
}
writeFileSync('public/ifc/model.bin', Buffer.from(buf.buffer))
writeFileSync('public/ifc/meta.json', JSON.stringify({
  groepen: meta, driehoeken, schaal,
  maat: Math.max(max[0] - min[0], max[1] - min[1], max[2] - min[2]),
  hoogte: max[2] - min[2], laagsteY: min[2] - cy,
}))
console.log('== EXPORT ==', driehoeken, 'driehoeken,', meta.length, 'kleurgroepen,',
  (buf.byteLength / 1e6).toFixed(1) + ' MB -> public/ifc/model.bin')
