// Kalibratiepresets op de GEBOUWMODEL-KERN: per referentie een
// handvertaling van het oude preset-nabouwsel naar kern-parameters.
// Dit is intern kalibratie- en testmateriaal; deze specs verschijnen
// NOOIT als klantvariant. Elke rij is een regressietest: na elke
// kernwijziging horen alle nabouwsels op /kalibratie valide te zijn en
// er goed uit te zien. De status geslaagd geeft uitsluitend STAEL zelf,
// via de statusknoppen (lokaal opgeslagen).
//
// Waar de kern een oud accent (nog) niet kent, staat dat in de notitie:
// die onderdelen wachten op fase 2 (materialen per volume) of vervallen
// bewust onder de element-afheidswet (accenten zonder functie).
//
// camera: pos/doel in meters, kopgevel is +z.

export const KALIBRATIE_KERN = [
  {
    nr: 2, beeld: '2.png', status: 'review',
    naam: 'Kop-en-staart, zwart met blank kader',
    notitie: 'Meting: staart ± 2,4x de kopdiepte, pui ± 0,9x de gevelbreedte. Hoekpui en mini-veranda wachten op een kern-detail.',
    camera: { pos: [-12.9, 4, 16.5], doel: [0, 3.6, 0], fov: 40 },
    params: {
      seed: 2,
      volume: { b: 7.6, d: 17.5, goot: 3.4, helling: 50 },
      massa: { type: 'kopstaart', dKop: 5.2, gootK: 4.6, krimp: .8 },
      sparingen: [{ wand: 'kop+', vorm: 'contour', x: 0, breedte: 6.7, marge: .2, stramien: 'grid' }],
      raamRitme: { n: 4, w: .9, plint: .3 },
      gevelElementen: [{ wand: 'kop+', type: 'kader', kleur: '#b09a72' }],
      kleuren: { gevel: '#31302c', dak: '#232327' },
    },
  },
  {
    nr: 4, beeld: '4.png', status: 'review',
    naam: 'Dwarskap in blauwgrijs fels',
    notitie: 'Dwarsnok net onder de hoofdnok, kilkeper in het dal. Materiaalwissel per volume volgt in fase 2.',
    camera: { pos: [14.1, 3.5, 15.6], doel: [0, 3.2, 0], fov: 40 },
    params: {
      seed: 4,
      volume: { b: 6.6, d: 12, goot: 3.2, helling: 50 },
      massa: { type: 'dwarskap', kant: 1, b2: 4.2, goot2: 3.0, helling2: 57, uitsteek: 3.4, z: 3.0 },
      sparingen: [{ wand: 'dwars:kop+', vorm: 'contour', x: 0, breedte: 3.2, marge: .2, stramien: 'grid' }],
      raamRitme: { n: 5, w: .85, plint: .3 },
      gevelElementen: [],
      kleuren: { gevel: '#b9b2a4', dak: '#3f4750' },
    },
  },
  {
    nr: 8, beeld: '8.webp', status: 'review',
    naam: 'Schuurwoning met kap doorgetrokken als veranda',
    notitie: 'Meting: lengte ± 2,1x breedte, veranda ± 0,2x de lengte, kolommen zichtbaar.',
    camera: { pos: [13, 3, 22.5], doel: [0, 3.2, 0], fov: 40 },
    params: {
      seed: 8,
      volume: { b: 8.2, d: 17, goot: 3.0, helling: 48 },
      uitbouw: { type: 'veranda', diepte: 3.4, kolommen: 3 },
      sparingen: [{ wand: 'kop+', vorm: 'contour', x: 0, breedte: 6.5, marge: .2, stramien: 'grid' }],
      raamRitme: { n: 5, w: .9, plint: .3 },
      gevelElementen: [],
      kleuren: { gevel: '#6d6355', dak: '#232327' },
    },
  },
  {
    nr: 1, beeld: '1.png', status: 'review',
    naam: 'Schuurwoning, hout met zwart kader',
    notitie: 'Houten gevel met zwart kader, penanten met diepte op de begane grond, zijluifel met schijfwand.',
    camera: { pos: [2.8, 3, 19.8], doel: [0, 3.2, 0], fov: 40 },
    params: {
      seed: 1,
      volume: { b: 8.4, d: 10.5, goot: 3.2, helling: 46 },
      sparingen: [{ wand: 'kop+', vorm: 'contour', x: 0, breedte: 6.2, marge: .2, stramien: 'vlak' }],
      raamRitme: { n: 4, w: .9, plint: .3 },
      gevelElementen: [
        { wand: 'kop+', type: 'kader', kleur: '#31302c' },
        { wand: 'kop+', type: 'penanten', n: 3, b: .4, span: 5, hMax: 3.4, kleur: '#77644c' },
      ],
      uitbouw: { type: 'zijluifel', kant: -1, uit: 2.0, wandKleur: '#31302c' },
      kleuren: { gevel: '#77644c', dak: '#232327' },
    },
  },
  {
    nr: 3, beeld: '3.png', status: 'review',
    naam: 'Zwarte schuurwoning met lamellen in de top',
    notitie: 'Lamellen exact geclipt op de daklijn. De losse witte sierpanelen vervallen onder de element-afheidswet (geen functie).',
    camera: { pos: [-9, 3, 15.6], doel: [0, 2.8, 0], fov: 40 },
    params: {
      seed: 3,
      volume: { b: 7, d: 11, goot: 2.4, helling: 56, nokOffset: .9 },
      sparingen: [{ wand: 'kop+', vorm: 'contour', x: 0, breedte: 3.5, marge: .2, stramien: 'stroken' }],
      raamRitme: { n: 4, w: .85, plint: .3 },
      gevelElementen: [
        { wand: 'kop+', type: 'lamellenveld', grens: 'dakcontour', v0: 2.7, v1: 5.4, kleur: '#84705a' },
      ],
      kleuren: { gevel: '#26262a', dak: '#232327' },
    },
  },
  {
    nr: 7, beeld: '7.jpg', status: 'review',
    naam: 'Witte kap over inpandige veranda',
    notitie: 'Portaalkader met dikte dat over de veranda doorloopt. Het houten sierpaneel wacht op een functionele drager (fase 2).',
    camera: { pos: [1.3, 2.4, 19], doel: [0, 2.6, 0], fov: 40 },
    params: {
      seed: 7,
      volume: { b: 10.5, d: 10, goot: 2.6, helling: 36, nokOffset: -.9, dakDikte: .45 },
      uitbouw: { type: 'portaal', uit: 2.1 },
      sparingen: [{ wand: 'kop+', vorm: 'contour', x: 0, breedte: 8.6, marge: .2, stramien: 'vlak' }],
      raamRitme: { n: 4, w: .9, plint: .3 },
      gevelElementen: [],
      kleuren: { gevel: '#d8d4c9', dak: '#d8d4c9' },
    },
  },
  {
    nr: 6, beeld: '6.jpg', status: 'review',
    naam: 'Kop met garagevolume en lamellenveld',
    notitie: 'Verschoven pui, lamellenveld boven de entree, geschakelde garage als aanbouwmassa.',
    camera: { pos: [-8.8, 3.2, 18], doel: [0, 3.4, 0], fov: 40 },
    params: {
      seed: 6,
      volume: { b: 8, d: 12, goot: 3.4, helling: 52 },
      massa: { type: 'aanbouw', kant: -1, b: 3.8, d: 5.2, h: 2.9, z: 3.4 },
      sparingen: [{ wand: 'kop+', vorm: 'contour', x: 1.7, breedte: 3.5, marge: .2, stramien: 'grid' }],
      raamRitme: { n: 4, w: .9, plint: .3 },
      gevelElementen: [
        { wand: 'kop+', type: 'lamellenveld', grens: 'dakcontour', v0: 3.6, v1: 5.1, kleur: '#84705a' },
      ],
      kleuren: { gevel: '#6d6355', dak: '#232327' },
    },
  },
  {
    nr: 13, beeld: '13.jpg', status: 'review',
    naam: 'Wit dakkader met balkon in de kopgevel',
    notitie: 'Balkon met spijlenbalustrade en deur op de dorpel; wit portaalkader en plint in blank hout.',
    camera: { pos: [4.6, 3, 18.4], doel: [0, 3.4, 0], fov: 40 },
    params: {
      seed: 13,
      volume: { b: 7.8, d: 10, goot: 3.4, helling: 54 },
      massa: { type: 'aanbouw', kant: -1, b: 3.4, d: 6, h: 3.0, z: -1.5 },
      uitbouw: { type: 'portaal', uit: .5 },
      sparingen: [{ wand: 'kop+', vorm: 'contour', x: 0, breedte: 3.9, marge: .2, stramien: 'grid' }],
      raamRitme: { n: 4, w: .9, plint: .3 },
      gevelElementen: [
        { wand: 'kop+', type: 'balkon', u: 0, breedte: 3, vloer: 2.9, diepte: 1.4 },
      ],
      plint: { h: 3.0, kleur: '#b09a72' },
      kleuren: { gevel: '#31302c', dak: '#232327' },
    },
  },
  {
    nr: 9, beeld: '9.jpg', status: 'review',
    naam: 'Zwarte doos met lamellen voor de pui',
    notitie: 'Lamellen met diepte voor de verdiepingspui. De kleine dakopbouw vervalt: zonder dakterras heeft hij in de kern geen functie.',
    camera: { pos: [4.9, 3.2, 15.2], doel: [0, 3.2, 0], fov: 40 },
    params: {
      seed: 9,
      volume: { b: 6.8, d: 8.5, goot: 6.4, plat: true },
      sparingen: [{ wand: 'kop+', vorm: 'contour', x: 0, breedte: 5.4, marge: .25, stramien: 'vlak' }],
      raamRitme: { n: 2, w: 1.1, plint: .3 },
      gevelElementen: [
        { wand: 'kop+', type: 'lamellenveld', grens: 'pui', v0: 3.2, v1: 5.6, uit: .35, kleur: '#84705a' },
      ],
      kleuren: { gevel: '#26262a', dak: '#232327' },
    },
  },
  {
    nr: 5, beeld: '5.png', status: 'review',
    naam: 'Zwevende glazen doos op kolommen',
    notitie: 'De bovendoos zweeft op een kleine kern plus hoekkolommen; glasbanden per laag. Het regelmatige kolomstramien uit de foto volgt later.',
    camera: { pos: [7.1, 2.8, 17.6], doel: [0, 3.4, 0], fov: 40 },
    params: {
      seed: 5,
      volume: { b: 2.6, d: 3.4, goot: 3 },
      massa: { type: 'stapel', h1: 2.7, h2: 3.4, b2: 7.2, d2: 13, dx: 1.6, dz: 3.2, terras: false },
      sparingen: [],
      gevelElementen: [],
      kleuren: { gevel: '#26262a', dak: '#232327' },
    },
  },
  {
    nr: 10, beeld: '10.jpg', status: 'review',
    naam: 'Gestapelde dozen, donker op wit',
    notitie: 'Carport-inham: de bovendoos kraagt uit over de open hoek met kolommen. Donker-op-wit materiaalwissel volgt in fase 2.',
    camera: { pos: [8.1, 3, 18.3], doel: [0, 3.2, 0], fov: 40 },
    params: {
      seed: 10,
      volume: { b: 7.2, d: 10, goot: 3.1 },
      massa: { type: 'stapel', h1: 3.1, h2: 3.1, b2: 8.2, d2: 10, dx: -2.9, dz: 0, terras: false },
      sparingen: [],
      gevelElementen: [],
      kleuren: { gevel: '#26262a', dak: '#232327' },
    },
  },
  {
    nr: 12, beeld: '12.jpg', status: 'review',
    naam: 'Grote uitkraging met vensterkader',
    notitie: 'Meting: uitkraging ± 0,4x de diepte. De kern eist kolommen onder de vrije hoeken; het losse vensterkader volgt in fase 2.',
    camera: { pos: [8.5, 2.8, 14.7], doel: [0, 3.4, 0], fov: 40 },
    params: {
      seed: 12,
      volume: { b: 7.5, d: 8, goot: 2.9 },
      massa: { type: 'stapel', h1: 2.9, h2: 3.4, b2: 7.5, d2: 8, dx: 0, dz: 3.4, terras: false },
      sparingen: [],
      gevelElementen: [],
      kleuren: { gevel: '#26262a', dak: '#232327' },
    },
  },
  {
    nr: 11, beeld: '11.jpg', status: 'review',
    naam: 'Glazen doos met pergola en dakterras',
    notitie: 'Teruggelegde bovendoos met terras, balustrade en terrasdeur; pergola-lamellendak op het terras tegen de bovendoos.',
    camera: { pos: [16, 3.4, 7], doel: [0, 3.4, 0], fov: 40 },
    params: {
      seed: 11,
      volume: { b: 9, d: 8, goot: 3 },
      massa: {
        type: 'stapel', h1: 3.0, h2: 3.0, b2: 7, d2: 8, dx: -1, dz: 0,
        terras: true, pergola: { kant: 1, z: 0 },
      },
      sparingen: [],
      gevelElementen: [],
      kleuren: { gevel: '#26262a', dak: '#232327' },
    },
  },
]
