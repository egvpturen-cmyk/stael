// PBR-materialenbibliotheek van STAEL (fase 2): pure data, geen three.
// Texturen zijn CC0 van ambientcg.com (1K JPG: color, normal, roughness)
// en staan in public/materialen/<dir>/. Naden van fels, rabatdelen en
// profielplaten komen uit normal maps; de fels- en rabatnaden maakt de
// renderer als procedurele normal map (exacte hartafstand).
//
// Twee kleurstrategieen per materiaal:
//   kleurmap: true  -> colormap van het asset, kleur als tint erover
//                      (voor naturel en verweerd materiaal)
//   kleurmap: false -> vlakke kleur op de normal/roughness van het
//                      asset (geverfd of gecoat werk: elke kleur kan,
//                      ook wit)
//
// Vaste regel: kozijnen zijn altijd slank en donker (KOZIJN hieronder).

export const KOZIJN = { kleur: '#1b1b1e', metalness: .35, roughness: .45 }

export const MATERIALEN = {
  // ---- gevels ----
  houtVerticaal: {
    naam: 'Hout geverfd, verticale delen', cat: 'gevel', dir: 'Wood062',
    kleurmap: false, tegel: [1.3, 1.3], rotatie: true, rabatNaad: .15, roughness: .78,
    kleuren: [
      { id: 'zwart', naam: 'Zwart gebrand', hex: '#33302b' },
      { id: 'bruinzwart', naam: 'Bruinzwart', hex: '#4c4136' },
      { id: 'grijs', naam: 'Grijs', hex: '#8e897f' },
      { id: 'warmbruin', naam: 'Warm bruin', hex: '#8a6b48' },
      { id: 'groengrijs', naam: 'Groengrijs', hex: '#636b5e' },
      { id: 'wit', naam: 'Wit', hex: '#e2ddd0' },
      { id: 'creme', naam: 'Creme', hex: '#d9cfba' },
    ],
  },
  houtNaturel: {
    naam: 'Hout naturel, verticale delen', cat: 'gevel', dir: 'Wood062',
    kleurmap: true, tegel: [1.3, 1.3], rotatie: true, rabatNaad: .15,
    kleuren: [
      { id: 'naturel', naam: 'Naturel', hex: '#ffffff' },
      { id: 'goud', naam: 'Goudbruin', hex: '#d9b884' },
      { id: 'verweerd', naam: 'Verweerd', hex: '#9a958d' },
      { id: 'donker', naam: 'Donker gebeitst', hex: '#6f6152' },
    ],
  },
  houtVerweerd: {
    naam: 'Hout verweerd, brede delen', cat: 'gevel', dir: 'WoodSiding001',
    kleurmap: true, tegel: [2, 2], rotatie: true,
    kleuren: [
      { id: 'origineel', naam: 'Donker verweerd', hex: '#ffffff' },
      { id: 'zwart', naam: 'Zwart', hex: '#6b665f' },
    ],
  },
  houtPlanken: {
    naam: 'Houten planken, geleefd', cat: 'gevel', dir: 'Planks012',
    kleurmap: true, tegel: [2.2, 2.2], rotatie: true,
    kleuren: [
      { id: 'origineel', naam: 'Warm bruin', hex: '#ffffff' },
      { id: 'donker', naam: 'Donker', hex: '#7c766c' },
    ],
  },
  felsGevel: {
    naam: 'Felsbekleding, staande naad', cat: 'gevel', dir: 'Metal032',
    kleurmap: true, tegel: [1.8, 1.8], felsNaad: .53, metalness: .55, ruwte: .5,
    kleuren: [
      { id: 'antraciet', naam: 'Antraciet', hex: '#43444a' },
      { id: 'zwart', naam: 'Zwart', hex: '#2e2e32' },
      { id: 'blauwgrijs', naam: 'Blauwgrijs', hex: '#69798a' },
      { id: 'groengrijs', naam: 'Groengrijs', hex: '#6e7a6e' },
      { id: 'zink', naam: 'Zinkgrijs', hex: '#aab0b6' },
      { id: 'brons', naam: 'Brons', hex: '#8a7256' },
    ],
  },
  profielStaal: {
    naam: 'Profielbeplating', cat: 'gevel', dir: 'CorrugatedSteel005',
    kleurmap: true, tegel: [1.1, 1.1], rotatie: true, metalness: .5,
    kleuren: [
      { id: 'antraciet', naam: 'Antraciet', hex: '#797c82' },
      { id: 'zwart', naam: 'Zwart', hex: '#54555a' },
      { id: 'zink', naam: 'Zinkgrijs', hex: '#c6cbd0' },
      { id: 'blauwgrijs', naam: 'Blauwgrijs', hex: '#94a4b2' },
    ],
  },
  corten: {
    naam: 'Cortenstaal', cat: 'gevel', dir: 'Rust004',
    kleurmap: true, tegel: [2.4, 2.4], metalness: .25,
    kleuren: [
      { id: 'corten', naam: 'Corten', hex: '#ffffff' },
      { id: 'donker', naam: 'Corten donker', hex: '#9b8371' },
    ],
  },
  zink: {
    naam: 'Zink, vlak', cat: 'gevel', dir: 'Metal012',
    kleurmap: true, tegel: [1.6, 1.6], metalness: .7,
    kleuren: [
      { id: 'natuur', naam: 'Zink natuur', hex: '#ffffff' },
      { id: 'antra', naam: 'Zink antra', hex: '#6e7278' },
    ],
  },
  stuc: {
    naam: 'Stucwerk', cat: 'gevel', dir: 'Plaster001',
    kleurmap: true, tegel: [2.2, 2.2],
    kleuren: [
      { id: 'wit', naam: 'Wit', hex: '#ffffff' },
      { id: 'gebrokenWit', naam: 'Gebroken wit', hex: '#e8e0ce' },
      { id: 'lichtgrijs', naam: 'Lichtgrijs', hex: '#c9c7c1' },
      { id: 'zand', naam: 'Zand', hex: '#d9c3a0' },
      { id: 'antraciet', naam: 'Antraciet', hex: '#55555a' },
    ],
  },
  witteSteen: {
    naam: 'Geschilderde steen', cat: 'gevel', dir: 'PaintedBricks001',
    kleurmap: true, tegel: [2.6, 2.6],
    kleuren: [
      { id: 'wit', naam: 'Wit', hex: '#ffffff' },
      { id: 'gebrokenWit', naam: 'Gebroken wit', hex: '#e4dccb' },
      { id: 'grijs', naam: 'Grijs', hex: '#b4b0a8' },
    ],
  },

  // ---- daken en daklijnen ----
  felsDak: {
    naam: 'Felsdak, staande naad', cat: 'dak', dir: 'Metal032',
    kleurmap: true, tegel: [1.8, 1.8], felsNaad: .53, metalness: .55, ruwte: .5,
    kleuren: [
      { id: 'antraciet', naam: 'Antraciet', hex: '#3a3b40' },
      { id: 'zwart', naam: 'Zwart', hex: '#2a2a2e' },
      { id: 'blauwgrijs', naam: 'Blauwgrijs', hex: '#5d6d7e' },
      { id: 'zink', naam: 'Zinkgrijs', hex: '#a0a6ac' },
      { id: 'groengrijs', naam: 'Groengrijs', hex: '#647064' },
      { id: 'wit', naam: 'Wit', hex: '#e2ded3' },
    ],
  },
  koperDak: {
    naam: 'Koper, dak en daklijnen', cat: 'dak', dir: 'Metal032',
    kleurmap: true, tegel: [1.6, 1.6], felsNaad: .43, metalness: .85, ruwte: .38,
    kleuren: [
      { id: 'koper', naam: 'Koper nieuw', hex: '#c47c48' },
      { id: 'verouderd', naam: 'Koper verouderd', hex: '#8a6244' },
    ],
  },
  profielDak: {
    naam: 'Profielplaat dak', cat: 'dak', dir: 'CorrugatedSteel005',
    kleurmap: true, tegel: [1.1, 1.1], rotatie: true, metalness: .5,
    kleuren: [
      { id: 'antraciet', naam: 'Antraciet', hex: '#75787e' },
      { id: 'zink', naam: 'Zinkgrijs', hex: '#c0c5ca' },
    ],
  },
  bitumen: {
    naam: 'Bitumen, plat dak', cat: 'dak', dir: null,
    roughness: .95,
    kleuren: [
      { id: 'zwart', naam: 'Zwart', hex: '#26262a' },
      { id: 'grijs', naam: 'Grijs', hex: '#4c4c50' },
    ],
  },

  // ---- accenten (kaders, lamellen, panelen, plinten) ----
  houtAccent: {
    naam: 'Hout, accenten', cat: 'accent', dir: 'Wood062',
    kleurmap: false, tegel: [1.1, 1.1], roughness: .68,
    kleuren: [
      { id: 'blank', naam: 'Blank', hex: '#c8ab7f' },
      { id: 'warm', naam: 'Warm', hex: '#a07a4f' },
      { id: 'zwart', naam: 'Zwart', hex: '#37332c' },
      { id: 'wit', naam: 'Witgeschilderd', hex: '#e2ddd0' },
    ],
  },
  verfAccent: {
    naam: 'Geverfd, accenten', cat: 'accent', dir: 'Wood062',
    kleurmap: false, tegel: [1.1, 1.1], roughness: .7,
    kleuren: [
      { id: 'zwart', naam: 'Zwart', hex: '#33302b' },
      { id: 'wit', naam: 'Wit', hex: '#e2ddd0' },
    ],
  },
  staalAccent: {
    naam: 'Staal, accenten', cat: 'accent', dir: null,
    metalness: .6, roughness: .4,
    kleuren: [
      { id: 'zwart', naam: 'Zwart staal', hex: '#26262a' },
      { id: 'wit', naam: 'Wit staal', hex: '#d8d4c9' },
      { id: 'koper', naam: 'Koper', hex: '#a56a40' },
    ],
  },

  // ---- terrein ----
  gras: {
    naam: 'Gras', cat: 'terrein', dir: 'Grass004',
    kleurmap: true, tegel: [9, 9],
    kleuren: [{ id: 'gras', naam: 'Gras', hex: '#a9b18f' }],
  },
  bestrating: {
    naam: 'Bestrating', cat: 'terrein', dir: 'PavingStones070',
    kleurmap: true, tegel: [2.4, 2.4],
    kleuren: [{ id: 'grijs', naam: 'Grijs', hex: '#ffffff' }],
  },
}

export function materiaalKleur(matId, kleurId) {
  const m = MATERIALEN[matId]
  if (!m) return null
  const k = m.kleuren.find(x => x.id === kleurId) || m.kleuren[0]
  return k.hex
}

// samengestelde presets voor "verzin het voor mij" en de generator:
// combinaties uit de ontwerptaal, per sfeer een gevel, dak en accent
export const MATERIAALPRESETS = [
  { id: 'polderZwart', naam: 'Polder zwart', gevel: { mat: 'houtVerticaal', kleur: 'zwart' }, dak: { mat: 'felsDak', kleur: 'antraciet' }, accent: { mat: 'houtAccent', kleur: 'blank' } },
  { id: 'warmHout', naam: 'Warm hout', gevel: { mat: 'houtNaturel', kleur: 'goud' }, dak: { mat: 'felsDak', kleur: 'antraciet' }, accent: { mat: 'verfAccent', kleur: 'zwart' } },
  { id: 'verweerdGrijs', naam: 'Verweerd grijs', gevel: { mat: 'houtNaturel', kleur: 'verweerd' }, dak: { mat: 'felsDak', kleur: 'zink' }, accent: { mat: 'verfAccent', kleur: 'zwart' } },
  { id: 'blauwgrijsFels', naam: 'Blauwgrijs fels', gevel: { mat: 'stuc', kleur: 'wit' }, dak: { mat: 'felsDak', kleur: 'blauwgrijs' }, accent: { mat: 'houtAccent', kleur: 'blank' } },
  { id: 'zinkModern', naam: 'Zink modern', gevel: { mat: 'felsGevel', kleur: 'zink' }, dak: { mat: 'felsDak', kleur: 'zink' }, accent: { mat: 'staalAccent', kleur: 'zwart' } },
  { id: 'staalDonker', naam: 'Staal donker', gevel: { mat: 'felsGevel', kleur: 'antraciet' }, dak: { mat: 'felsDak', kleur: 'zwart' }, accent: { mat: 'houtAccent', kleur: 'blank' } },
  { id: 'cortenLandelijk', naam: 'Corten landelijk', gevel: { mat: 'corten', kleur: 'corten' }, dak: { mat: 'felsDak', kleur: 'antraciet' }, accent: { mat: 'staalAccent', kleur: 'zwart' } },
  { id: 'witSereen', naam: 'Wit sereen', gevel: { mat: 'stuc', kleur: 'wit' }, dak: { mat: 'felsDak', kleur: 'wit' }, accent: { mat: 'houtAccent', kleur: 'blank' } },
  { id: 'koperAccent', naam: 'Koperen daklijnen', gevel: { mat: 'houtVerticaal', kleur: 'bruinzwart' }, dak: { mat: 'felsDak', kleur: 'antraciet' }, daklijnen: { mat: 'koperDak', kleur: 'koper' }, accent: { mat: 'houtAccent', kleur: 'blank' } },
  { id: 'witteSteen', naam: 'Witte steen', gevel: { mat: 'witteSteen', kleur: 'wit' }, dak: { mat: 'felsDak', kleur: 'antraciet' }, accent: { mat: 'verfAccent', kleur: 'zwart' } },
]
