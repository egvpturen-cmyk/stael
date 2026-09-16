// Kennisbank ontwerptaal van STAEL, eerste versie (fase 1).
// Opgebouwd uit web-research (sept 2026: schuurwoning-typologie met lage goot
// en zadeldak, langhuis als langgerekt volume onder een doorgaande kap,
// staalportalen met vrije overspanningen tot ca. 9,5 m, gangbare
// bestemmingsplan-marges met dakhelling 30 tot 60 graden) en geijkt op de
// STAEL-referentiebeelden in assets/ (huis1 t/m huis6, render.jpg):
// schuurwoningen en langhuizen in de polder, fels- en koperdaken, hout,
// dubbelhoge glasgevels. Nadrukkelijk niet: Amerikaanse villa's,
// natuursteen-stapelwanden, bergdecors, witte nieuwbouwdozen.

// Vaste STAEL-regels, gelden voor elke typologie
export const STAEL = {
  kozijnKleur: '#1b1b1e',      // kozijnen altijd slank en donker
  kozijnDikte: 0.08,
  maxOverspanning: 9.5,        // vrije overspanning staalportaal in meters
  verdiepingFactor: 1.75,      // bruto-oppervlaktewinst van een kaplaag
  loftVerdiepingFactor: 1.9,   // volwaardige verdieping in een loftvolume
}

// Gangbare bestemmingsplan-defaults (instelbaar per kavel in de UI)
export const REGELS_DEFAULT = {
  gootMax: 3.5,
  nokMax: 9,
  hellingMin: 30,
  hellingMax: 60,
}

// Typologieen: elke variant die de generator toont is een toepassing
// van een van deze regelsets op het programma van de klant.
export const TYPOLOGIEEN = [
  {
    id: 'schuurwoning',
    naam: 'Schuurwoning',
    beschrijving: 'Lage goot, forse kap, dubbelhoge glazen kopgevel. Het silhouet van de polderschuur, strak gedetailleerd.',
    dakvormen: ['zadel', 'mix'],
    ratio: [1.7, 2.2],          // diepte gedeeld door breedte
    goot: [2.3, 3.0],           // karakteristiek laag
    helling: [45, 55],
    overstek: 0.35,
    glas: { kop: 'dubbelhoog', langs: 'stramien' },
    lagen: [1, 2],              // 2e laag in de kap
    gevel: '#77644c',           // thermisch gemodificeerd hout
    dak: '#232327',             // felsdak antraciet
  },
  {
    id: 'langhuis',
    naam: 'Langhuis',
    beschrijving: 'Langgerekt volume onder een doorgaande kap, geleed met een ritme van slanke gevelopeningen. Verwant aan het Zeeuwse en Hollandse langhuis.',
    dakvormen: ['zadel', 'mix'],
    ratio: [2.6, 3.4],
    goot: [2.6, 3.2],
    helling: [40, 48],
    overstek: 0.3,
    glas: { kop: 'dubbelhoog', langs: 'ritme' },
    lagen: [1, 2],
    gevel: '#31302c',           // zwart gebeitst hout
    dak: '#4c4f54',             // zink
  },
  {
    id: 'loft',
    naam: 'Loftwoning',
    beschrijving: 'Twee volwaardige lagen op een staalportaal: vrije overspanning, geen dragende binnenwanden, glasgevel van vloer tot nok.',
    dakvormen: ['zadel', 'plat', 'mix'],
    ratio: [1.35, 1.7],
    goot: [5.9, 6.4],           // twee volwaardige lagen
    helling: [30, 36],
    overstek: 0.45,
    glas: { kop: 'vide', langs: 'stramien' },
    lagen: [2],
    gevel: '#6d6355',           // verweerd hout met stalen plint
    dak: '#232327',
  },
  {
    id: 'paviljoen',
    naam: 'Paviljoen',
    beschrijving: 'Eén laag onder een plat dak met een royaal overstek op slanke stalen kolommen. Glas rondom, wonen in het landschap.',
    dakvormen: ['plat', 'mix'],
    ratio: [1.5, 2.0],
    goot: [3.0, 3.4],
    helling: [0, 0],
    overstek: 1.0,
    glas: { kop: 'strook', langs: 'strook' },
    lagen: [1],
    gevel: '#3a382f',
    dak: '#232327',
  },
]

// Voorkeursvolgorde per gekozen dakvorm; de eerste typologie levert
// ook een tweede, anders geproportioneerde variant zodat er altijd
// echt iets te kiezen valt.
export function typologieenVoor(dakvorm, lagen) {
  const past = TYPOLOGIEEN.filter(t =>
    t.dakvormen.includes(dakvorm) && (lagen === 1 ? t.lagen.includes(1) : true))
  return past
}
