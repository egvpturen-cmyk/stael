// Genereert uit bibliotheek/stael-collectie.json (de bron) twee
// identieke JavaScript-modules: een voor de app en een voor de API.
// Zo kennen de Architect (server) en de smaakstap (app) exact dezelfde
// collectie; de gesprekstest controleert de gelijkheid. Kopieert ook
// de collectiebeelden (webp) uit bibliotheek/ naar public/collectie/
// en ruimt daar alles op wat niet meer in de bron staat: er is een
// bron en dat is de webp-set plus de JSON.
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const hier = path.dirname(fileURLToPath(import.meta.url))
const bibliotheek = path.resolve(hier, '../../bibliotheek')
const bron = path.join(bibliotheek, 'stael-collectie.json')
const data = JSON.parse(fs.readFileSync(bron, 'utf8'))

const doelMap = path.resolve(hier, '../public/collectie')
fs.mkdirSync(doelMap, { recursive: true })
const horenErbij = new Set(data.map(c => c.bestand))
for (const naam of fs.readdirSync(doelMap)) {
  if (!horenErbij.has(naam)) fs.unlinkSync(path.join(doelMap, naam))
}
for (const c of data) {
  fs.copyFileSync(path.join(bibliotheek, c.bestand), path.join(doelMap, c.bestand))
}

const inhoud = `// GEGENEREERD uit bibliotheek/stael-collectie.json door
// architect/scripts/sync-collectie.mjs; niet met de hand bewerken.
export const COLLECTIE = ${JSON.stringify(data, null, 1)}

// compacte samenvatting voor de systeemprompt van de Architect
export function collectieContext() {
  return 'DE CONCEPTCOLLECTIE (nummer | naam | familie | materialen):\\n'
    + COLLECTIE.map(c => c.nummer + ' | ' + c.naam + ' | ' + c.familie + ' | ' + c.materialen).join('\\n')
}
`
fs.writeFileSync(path.resolve(hier, '../src/reis/collectie.js'), inhoud)
fs.writeFileSync(path.resolve(hier, '../../api/collectie.js'), inhoud)
console.log('collectie.js gegenereerd voor app en api:', data.length, 'ontwerpen;',
  'webbeelden gesynct naar public/collectie/')
