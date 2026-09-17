// Kennisbank ontwerptaal van STAEL, tweede versie (fase 1, verbreed).
// Opgebouwd uit web-research en de referentiebeelden in referenties/ en
// assets/. De referenties zijn vocabulaire, geen sjablonen: hieronder staan
// typologische principes (massastrategieen, accenten, creatieve elementen),
// geen kopieen van specifieke huizen. Nadrukkelijk niet: Amerikaanse
// villa's, natuursteen-stapelwanden, bergdecors, witte nieuwbouwdozen.

export const STAEL = {
  kozijnKleur: '#1b1b1e',      // kozijnen altijd slank en donker
  kozijnDikte: 0.08,
  // vrije overspanning van het portaalsysteem: 12 m is de door STAEL
  // bevestigde grens; 6 tot 9 m is de comfortabele default-range voor
  // gegenereerde varianten, groter mag waar het programma erom vraagt
  maxOverspanning: 12,
  overspanningComfort: [6, 9],
  verdiepingFactor: 1.75,
  loftVerdiepingFactor: 1.9,
}

export const REGELS_DEFAULT = {
  gootMax: 3.5,
  nokMax: 9,
  hellingMin: 30,
  hellingMax: 60,
}

// Materiaalstemming per typologie (fase 1: kleurvlakken, fase 2: echte texturen)
export const KLEUREN = {
  houtWarm: '#77644c', houtGrijs: '#6d6355', houtZwart: '#31302c',
  houtLicht: '#8a7a5e', houtBlank: '#b09a72', staalZwart: '#26262a',
  stucLicht: '#b9b2a4', wit: '#d8d4c9',
  felsAntraciet: '#232327', felsBlauwgrijs: '#3f4750', zink: '#4c4f54',
  koper: '#8a5637', baksteen: '#5f4c40',
}

export const TYPOLOGIEEN = [
  {
    id: 'schuurwoning', naam: 'Schuurwoning',
    kern: 'lage goot, forse kap, het silhouet van de polderschuur',
    dakvormen: ['zadel', 'mix'], ratio: [1.7, 2.2], goot: [2.3, 3.0],
    helling: [45, 55], overstek: 0.35, lagen: [1, 2],
    gevels: ['houtWarm', 'houtZwart', 'houtGrijs'], daken: ['felsAntraciet', 'felsBlauwgrijs', 'zink'],
    massas: ['enkel', 'kopstaart', 'dwarskap', 'asym'],
  },
  {
    id: 'langhuis', naam: 'Langhuis',
    kern: 'langgerekt volume onder een doorgaande kap, geleed ritme',
    dakvormen: ['zadel', 'mix'], ratio: [2.6, 3.4], goot: [2.6, 3.2],
    helling: [40, 48], overstek: 0.3, lagen: [1, 2],
    gevels: ['houtZwart', 'houtGrijs', 'houtWarm'], daken: ['zink', 'felsAntraciet', 'koper'],
    massas: ['enkel', 'kopstaart', 'asym'],
  },
  {
    id: 'loft', naam: 'Loftwoning',
    kern: 'twee lagen op een staalportaal, vrije overspanning',
    dakvormen: ['zadel', 'plat', 'mix'], ratio: [1.35, 1.7], goot: [5.9, 6.4],
    helling: [30, 36], overstek: 0.45, lagen: [2],
    gevels: ['houtGrijs', 'staalZwart', 'houtWarm'], daken: ['felsAntraciet', 'zink'],
    massas: ['enkel', 'stapel', 'asym'],
  },
  {
    id: 'paviljoen', naam: 'Paviljoen',
    kern: 'een laag onder een plat dak met royaal overstek op stalen kolommen',
    dakvormen: ['plat', 'mix'], ratio: [1.5, 2.0], goot: [3.0, 3.4],
    helling: [0, 0], overstek: 1.0, lagen: [1],
    gevels: ['houtZwart', 'staalZwart', 'houtGrijs'], daken: ['felsAntraciet'],
    massas: ['enkel'],
  },
]

// Massastrategieen (uit de referenties gedestilleerd) met toepasbaarheid
export const MASSAS = {
  enkel: { naam: 'enkelvoudig volume', zin: 'een helder enkelvoudig volume' },
  kopstaart: {
    naam: 'kop-en-staart', zin: 'een hoog kopgebouw met een langgerekte lagere staart',
    kan: s => !s.plat && s.d >= 11 && s.voet >= 90,
  },
  dwarskap: {
    naam: 'dwarskap', zin: 'kruisende kappen: een haaks dwarsvolume met eigen glazen kopgevel',
    kan: s => !s.plat && s.voet >= 100 && s.d >= 10,
  },
  asym: {
    naam: 'asymmetrische kap', zin: 'een asymmetrische kap met twee ongelijke dakvlakken',
    kan: s => !s.plat,
  },
  zwevend: {
    naam: 'zwevend volume', zin: 'een uitkragende glazen doos op slanke stalen kolommen',
    kan: s => s.lagen === 2,
  },
  stapel: {
    naam: 'gestapelde volumes', zin: 'twee gestapelde dozen met een verspringende uitkraging',
    kan: s => s.lagen === 2 && s.plat,
  },
}

// Stramienstijlen voor de glazen kopgevel
export const STRAMIENEN = {
  grid: { zin: 'kopgevel met fijnmazig grid' },
  stroken: { zin: 'kopgevel in verticale stroken' },
  vlak: { zin: 'kopgevel als groot glasvlak met enkele slanke stijlen' },
}

// Accenten en creatieve elementen, met toepasbaarheidsregels.
// kan(spec, prog) beslist of het element logisch is; sluit somt uit wat
// er niet mee te combineren valt (dosering, geen dubbele drukte).
export const ELEMENTEN = {
  schoorsteen: {
    zin: 'gemetseld schoorsteenmassief door de nok',
    kan: s => !s.plat && s.massa !== 'zwevend', sluit: [],
  },
  kader: {
    zin: 'houten kader rond de glazen kopgevel',
    kan: s => s.massa !== 'zwevend', sluit: ['lamellen', 'hoekpui'],
  },
  lamellen: {
    zin: 'houten lamellen voor de vide in de geveltop',
    kan: s => !s.plat || s.lagen === 2, sluit: ['kader'],
  },
  materiaalwissel: {
    zin: 'materiaalwissel per volume',
    kan: s => ['kopstaart', 'dwarskap', 'zwevend'].includes(s.massa), sluit: [],
  },
  balkon: {
    zin: 'uitkragend balkon met spijlenbalustrade in de kopgevel',
    kan: s => s.lagen === 2 && s.massa !== 'zwevend', sluit: ['hoekpui'],
  },
  veranda: {
    zin: 'doorgetrokken dakvlak als veranda op stalen kolommen',
    kan: (s, p) => !s.plat && p.kavel - s.voet >= 120, sluit: ['entreeLuifel'],
  },
  bijgebouw: {
    zin: 'losse berging met carport naast de woning',
    kan: (s, p) => p.kavel - s.voet >= 250, sluit: [],
  },
  hoekpui: {
    zin: 'glazen pui die om de hoek doorloopt',
    kan: s => s.massa !== 'dwarskap', sluit: ['kader', 'balkon'],
  },
  langsPui: {
    zin: 'brede glazen pui in de langsgevel',
    kan: () => true, sluit: [],
  },
  dakramen: {
    zin: 'dakramen in het dakvlak',
    kan: s => !s.plat && s.lagen === 2, sluit: [],
  },
  dakkapel: {
    zin: 'dakkapel in het dakvlak',
    kan: s => !s.plat && s.lagen === 2 && s.helling >= 45 && ['enkel', 'asym'].includes(s.massa), sluit: ['dakramen'],
  },
  entreeLuifel: {
    zin: 'entreeluifel op slanke stalen kolommen',
    kan: () => true, sluit: ['veranda', 'entreeKader'],
  },
  entreeKader: {
    zin: 'teruggelegde entree in een contrasterend kader',
    kan: () => true, sluit: ['entreeLuifel'],
  },
}

// ---------------------------------------------------------------------
// Herijkte compositieregels, afgeleid uit de 13 geslaagde nabouwsels op
// /kalibratie. Vakmansregels gelden als harde ondergrens: kaders volgen
// de daklijn, raamstroken lopen van plint tot goot, een balkon vraagt
// een pui erachter, en per kopgevel is er precies een dominant thema.

// Dominante kopgevel-thema's (er wordt er altijd precies een gekozen)
export const KOPTHEMAS = {
  puiStrak: { gewicht: 3, zin: 'een strakke glazen kopgevel', kan: () => true },
  puiKader: { gewicht: 3, zin: 'een kader langs de daklijn rond de pui', kan: s => s.massa !== 'stapel' },
  puiLamellen: { gewicht: 2, zin: 'houten lamellen voor de vide', kan: s => !s.plat && s.massa !== 'stapel' },
  puiPenanten: { gewicht: 2, zin: 'houten penanten in de pui', kan: s => !s.plat && s.massa !== 'stapel' },
  portaal: { gewicht: 2, zin: 'een portaalkader dat de dakcontour tot de grond doortrekt', kan: (s, p) => !s.plat && s.massa === 'enkel' && p.kavel - s.voet >= 80 },
  lamellenVeld: { gewicht: 2, zin: 'een lamellenveld voor de verdiepingspui', kan: s => s.plat && s.lagen === 2 },
}

// Secundaire elementen (een of twee per variant, gedoseerd)
export const SECUNDAIR = {
  balkon: {
    gewicht: 2, zin: 'een balkon met spijlenbalustrade voor de pui',
    kan: s => s.lagen === 2 && ['puiStrak', 'puiKader', 'puiPenanten'].includes(s.kopThema) && s.massa !== 'stapel',
    sluit: ['erker'],
  },
  veranda: {
    gewicht: 2, zin: 'het dakvlak doorgetrokken als veranda op stalen kolommen',
    kan: (s, p) => !s.plat && s.kopThema !== 'portaal' && p.kavel - s.voet >= 120,
    sluit: ['zijLuifel', 'entreeLuifel'],
  },
  zijLuifel: {
    gewicht: 1, zin: 'een zijwaarts doorgetrokken dakvlak met schijfwand',
    kan: (s, p) => !s.plat && s.massa === 'enkel' && p.kavel - s.voet >= 100,
    sluit: ['veranda'],
  },
  aanbouw: {
    gewicht: 2, zin: 'een geschakelde berging met doorgestoken luifel',
    kan: (s, p) => s.massa !== 'stapel' && p.kavel - s.voet >= 200,
    sluit: ['bijgebouw'],
  },
  bijgebouw: {
    gewicht: 1, zin: 'een losse berging met carport',
    kan: (s, p) => p.kavel - s.voet >= 300,
    sluit: ['aanbouw'],
  },
  plint: {
    gewicht: 1, zin: 'een materiaalwissel per laag',
    kan: s => s.lagen === 2 && !s.plat && s.massa === 'enkel',
    sluit: [],
  },
  dakramen: {
    gewicht: 1, zin: 'dakramen in het dakvlak',
    kan: s => !s.plat && s.lagen === 2,
    sluit: ['dakkapel'],
  },
  dakkapel: {
    gewicht: 1, zin: 'een dakkapel in het dakvlak',
    kan: s => !s.plat && s.lagen === 2 && s.helling >= 45 && ['enkel', 'asym'].includes(s.massa),
    sluit: ['dakramen'],
  },
  dakOpbouw: {
    gewicht: 1, zin: 'een kleine dakopbouw',
    kan: s => s.plat && s.massa === 'enkel',
    sluit: [],
  },
  lamellenEntree: {
    gewicht: 1, zin: 'een lamellenveld boven de entree',
    kan: s => s.lagen === 2 && !s.plat && s.kopThema !== 'puiLamellen',
    sluit: [],
  },
  schoorsteen: {
    gewicht: 1, zin: 'een gemetseld schoorsteenmassief door de nok',
    kan: s => !s.plat,
    sluit: [],
  },
  pergola: {
    gewicht: 1, zin: 'een pergola-lamellendak op stalen kolommen tegen de gevel',
    kan: (s, p) => p.kavel - s.voet >= 80,
    sluit: ['veranda', 'zijLuifel'],
  },
  erker: {
    gewicht: 1, zin: 'een uitstekende glazen erker op de hoek',
    kan: s => !s.plat && s.massa !== 'stapel',
    sluit: ['balkon'],
  },
  entreeKader: {
    gewicht: 1, zin: 'een teruggelegde entree in een contrasterend kader',
    kan: s => s.kopThema !== 'portaal',
    sluit: ['entreeLuifel'],
  },
  entreeLuifel: {
    gewicht: 1, zin: 'een entreeluifel op slanke stalen kolommen',
    kan: s => s.kopThema !== 'portaal',
    sluit: ['entreeKader', 'veranda'],
  },
}

export function typologieenVoor(dakvorm, lagen) {
  return TYPOLOGIEEN.filter(t =>
    t.dakvormen.includes(dakvorm) && (lagen === 1 ? t.lagen.includes(1) : true))
}
