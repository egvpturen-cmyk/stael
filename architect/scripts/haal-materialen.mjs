// Haalt CC0-texturen (1K JPG) op van ambientCG en bewaart per asset
// alleen de drie kaarten die de renderer gebruikt: Color, NormalGL en
// Roughness. Bron en licentie: https://ambientcg.com (CC0).
// Gebruik: node scripts/haal-materialen.mjs
import { execSync } from 'child_process'
import fs from 'fs'
import path from 'path'

const ASSETS = [
  'WoodSiding001', 'Planks012', 'Wood062',
  'Metal032', 'Metal012', 'Metal029', 'Rust004', 'CorrugatedSteel005',
  'Plaster001', 'PaintedBricks001',
  'Grass004', 'PavingStones070',
]

const DOEL = path.resolve('public/materialen')
const TMP = path.resolve('.matcache')
fs.mkdirSync(DOEL, { recursive: true })
fs.mkdirSync(TMP, { recursive: true })

for (const id of ASSETS) {
  const uitDir = path.join(DOEL, id)
  if (fs.existsSync(path.join(uitDir, 'color.jpg'))) { console.log(id, 'al aanwezig'); continue }
  const zip = path.join(TMP, id + '.zip')
  const map = path.join(TMP, id)
  console.log(id, 'downloaden...')
  execSync(`curl -sL -o "${zip}" "https://ambientcg.com/get?file=${id}_1K-JPG.zip"`, { stdio: 'inherit' })
  fs.mkdirSync(map, { recursive: true })
  execSync(`powershell -NoProfile -Command "Expand-Archive -LiteralPath '${zip}' -DestinationPath '${map}' -Force"`, { stdio: 'inherit' })
  fs.mkdirSync(uitDir, { recursive: true })
  const bestanden = fs.readdirSync(map)
  const pak = (patroon, naam) => {
    const b = bestanden.find(x => x.includes(patroon) && x.endsWith('.jpg'))
    if (b) fs.copyFileSync(path.join(map, b), path.join(uitDir, naam))
    return !!b
  }
  const ok = [
    pak('_Color', 'color.jpg'),
    pak('_NormalGL', 'normal.jpg'),
    pak('_Roughness', 'roughness.jpg'),
  ]
  console.log(id, ok.every(Boolean) ? 'compleet' : 'ONVOLLEDIG: ' + bestanden.join(', '))
}
fs.rmSync(TMP, { recursive: true, force: true })
console.log('klaar; texturen in public/materialen')
