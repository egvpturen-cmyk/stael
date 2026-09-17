// Kalibratiepresets: handmatige nabouwsels van de referentiebeelden in
// referenties/. Dit is intern kalibratie- en testmateriaal; deze specs
// verschijnen NOOIT als klantvariant. Elke preset dient als regressietest:
// na elke generatorwijziging moeten alle geslaagde nabouwsels er op de
// kalibratiepagina (/kalibratie) nog goed uitzien.
//
// status: 'geslaagd' | 'bezig' | 'open'
// camera: azimut in graden vanaf de kopgevel, hoogte en afstand in meters.

export const KALIBRATIE = [
  {
    nr: 2, beeld: '2.png', status: 'geslaagd',
    naam: 'Kop-en-staart, zwart met blank kader',
    notitie: 'Kopstaart, grid en kader waren er al. Uitgebreid: kader in kleur langs de daklijn, uitstekende glazen erker, dakuitstek zonder kolommen, instelbare puibreedte.',
    camera: { azimut: -38, hoogte: 4.5, afstand: 27 },
    params: {
      id: 'ref2', typologie: 'schuurwoning', massa: 'kopstaart', lagen: 2,
      b: 7.6, d: 15, goot: 3.4, helling: 50,
      kopstaart: { dKop: 5.2, gootK: 4.6, nokK: 8.4, krimp: .8 },
      gevel: 'houtZwart', dak: 'felsAntraciet', stramien: 'grid',
      kader: { kleur: 'houtBlank' }, elementen: ['kader', 'hoekpui'],
      hoekpuiKant: -1, veranda: { diepte: 1.0, kolommen: 0 }, puiFactor: .8,
    },
  },
  {
    nr: 4, beeld: '4.png', status: 'geslaagd',
    naam: 'Dwarskap in blauwgrijs fels',
    notitie: 'Uitgebreid: dichte kopgevel met kaders, ramen en deur; dakraamzijde instelbaar; orientatie van het dwarsvolume gecorrigeerd (glazen gevel wees naar binnen).',
    camera: { azimut: 42, hoogte: 3.5, afstand: 27 },
    params: {
      id: 'ref4', typologie: 'schuurwoning', massa: 'dwarskap', lagen: 2,
      b: 7.0, d: 13, goot: 3.0, helling: 48, kopPui: false, dakraamKant: -1,
      dwars: { b2: 4.4, d2: 8.6, goot2: 3.0, nok2: 6.4, z: 3.2 },
      gevel: 'stucLicht', gevel2: 'felsBlauwgrijs', dak: 'felsBlauwgrijs',
      stramien: 'grid', kader: { kleur: 'houtWarm' },
      elementen: ['dakramen', 'materiaalwissel'],
    },
  },
  {
    nr: 8, beeld: '8.webp', status: 'geslaagd',
    naam: 'Schuurwoning met kap doorgetrokken als veranda',
    notitie: 'Vrijwel direct haalbaar; uitgebreid met een instelbaar aantal verandakolommen per gootzijde.',
    camera: { azimut: 34, hoogte: 3.5, afstand: 30 },
    params: {
      id: 'ref8', typologie: 'langhuis', massa: 'enkel', lagen: 2,
      b: 8.2, d: 14, goot: 3.0, helling: 48,
      gevel: 'houtGrijs', dak: 'felsAntraciet', stramien: 'grid',
      veranda: { diepte: 3.4, kolommen: 3 }, elementen: [],
    },
  },
  {
    nr: 1, beeld: '1.png', status: 'geslaagd',
    naam: 'Schuurwoning, hout met zwart kader',
    notitie: 'Uitgebreid: houten penanten in de pui (met maximumhoogte), zijwaarts doorgetrokken dakvlak met schijfwand.',
    camera: { azimut: 8, hoogte: 3, afstand: 22 },
    params: {
      id: 'ref1', typologie: 'schuurwoning', massa: 'enkel', lagen: 2,
      b: 8.4, d: 10.5, goot: 3.2, helling: 46,
      gevel: 'houtWarm', dak: 'felsAntraciet', stramien: 'vlak', puiFactor: .84,
      kader: { kleur: 'houtZwart' },
      penanten: { n: 3, breedte: .55, kleur: 'houtWarm', hMax: 3.4 },
      zijLuifel: { kant: -1, uit: 2.0, wandKleur: 'houtZwart' },
      veranda: { diepte: .5, kolommen: 0 },
      elementen: ['kader'],
    },
  },
  {
    nr: 3, beeld: '3.png', status: 'geslaagd',
    naam: 'Zwarte schuurwoning met lamellen in de top',
    notitie: 'Uitgebreid: gevelpanelen (licht accentvlak op de kop, garagedeur in de langsgevel); asymmetrie en lamellen bestonden al.',
    camera: { azimut: -30, hoogte: 3, afstand: 22 },
    params: {
      id: 'ref3', typologie: 'schuurwoning', massa: 'enkel', lagen: 2,
      b: 7.0, d: 11, goot: 2.4, helling: 56, nokOffset: .9,
      gevel: 'staalZwart', dak: 'felsAntraciet', stramien: 'stroken', puiFactor: .5,
      lamellen: true,
      panelen: [
        { vlak: 'kop', x: 2.6, y: 2.0, w: 1.5, h: 3.9, kleur: 'wit' },
        { vlak: 'links', z: 3.2, y: 1.2, w: 2.5, h: 2.4, kleur: 'wit' },
      ],
      elementen: ['lamellen'],
    },
  },
  {
    nr: 7, beeld: '7.jpg', status: 'geslaagd',
    naam: 'Witte kap over inpandige veranda',
    notitie: 'Uitgebreid: portaalkader (dakcontour doorgetrokken tot de grond op de vooruitgeschoven gevellijn) plus schuifpaneel via gevelpanelen.',
    camera: { azimut: 4, hoogte: 2.6, afstand: 24 },
    params: {
      id: 'ref7', typologie: 'schuurwoning', massa: 'enkel', lagen: 1,
      b: 10.5, d: 10, goot: 2.6, helling: 36, nokOffset: -.9,
      gevel: 'wit', dak: 'wit', stramien: 'vlak', puiFactor: .82,
      portaal: { uit: 2.4, kleur: 'wit' },
      veranda: { diepte: 2.4, kolommen: 0 },
      panelen: [{ vlak: 'kop', x: -.6, y: 2.3, w: 2.3, h: 4.4, kleur: 'houtWarm', uit: .3 }],
      elementen: [],
    },
  },
  {
    nr: 6, beeld: '6.jpg', status: 'geslaagd',
    naam: 'Kop met garagevolume en lamellenveld',
    notitie: 'Verschoven grid-pui, lamellenveld boven de entree, geschakelde garage met doorgestoken luifel.',
    camera: { azimut: -26, hoogte: 3.5, afstand: 26 },
    params: {
      id: 'ref6', typologie: 'schuurwoning', massa: 'enkel', lagen: 2,
      b: 8.0, d: 12, goot: 3.4, helling: 52,
      gevel: 'houtGrijs', dak: 'felsAntraciet', stramien: 'grid',
      puiFactor: .44, puiX: 1.7,
      lamellenVelden: [{ x: -1.6, y0: 3.3, y1: 5.1, w: 2.2, uit: .12 }],
      panelen: [{ vlak: 'kop', x: -1.6, y: 1.4, w: 1.1, h: 2.6, kleur: 'houtZwart', uit: .1 }],
      aanbouwen: [{ x: -6.0, z: 3.4, b: 3.8, d: 5.2, h: 2.9, kleur: 'houtGrijs', dakUitX: 2.4, deur: true }],
      elementen: [],
    },
  },
  {
    nr: 13, beeld: '13.jpg', status: 'geslaagd',
    naam: 'Wit dakkader met balkon in de kopgevel',
    notitie: 'Wit portaalkader, plint in blank hout, balkon voor de pui, geschakeld plat volume.',
    camera: { azimut: 14, hoogte: 3, afstand: 23 },
    params: {
      id: 'ref13', typologie: 'schuurwoning', massa: 'enkel', lagen: 2,
      b: 7.8, d: 10, goot: 3.4, helling: 54,
      gevel: 'houtZwart', dak: 'felsAntraciet', stramien: 'grid', puiFactor: .5,
      portaal: { uit: .5, kleur: 'wit' },
      plint: { h: 3.0, kleur: 'houtBlank' },
      aanbouwen: [{ x: -5.6, z: -1.5, b: 3.4, d: 6, h: 3.0, kleur: 'houtZwart' }],
      elementen: ['balkon'],
    },
  },
  {
    nr: 9, beeld: '9.jpg', status: 'geslaagd',
    naam: 'Zwarte doos met lamellen voor de pui',
    notitie: 'Lamellenveld voor de verdiepingspui, kleine dakopbouw, strokenpui beneden.',
    camera: { azimut: 18, hoogte: 3.5, afstand: 21 },
    params: {
      id: 'ref9', typologie: 'loft', massa: 'enkel', lagen: 2, plat: true,
      b: 6.8, d: 8.5, goot: 6.4, stramienN: 2,
      gevel: 'staalZwart', dak: 'felsAntraciet', stramien: 'vlak', puiFactor: .8,
      lamellenVelden: [{ x: 0, y0: 3.2, y1: 5.6, w: 5.6, uit: .35, kleur: 'houtBlank' }],
      dakOpbouw: { b: 2.2, d: 2.6, h: 1.2, x: -1.6, z: -2.0 },
      elementen: [],
    },
  },
  {
    nr: 5, beeld: '5.png', status: 'geslaagd',
    naam: 'Zwevende glazen doos op kolommen',
    notitie: 'Open onderbouw met kern en kolommen, glasband rond het hele bovenvolume.',
    camera: { azimut: 22, hoogte: 3, afstand: 25 },
    params: {
      id: 'ref5', typologie: 'loft', massa: 'stapel', lagen: 2, plat: true,
      b: 7.2, d: 13, goot: 6.1,
      stapel: {
        onder: { open: true, h: 2.7, kleur: 'staalZwart', kern: { b: 2.6, d: 3.4, x: -1.6, z: -3.2 } },
        boven: { b: 7.2, d: 13, h: 3.4, kleur: 'staalZwart' },
        glasband: { y0: 3.0, y1: 5.5 },
        kolommen: [-5.2, 0, 5.2].flatMap(z => [{ x: -3.2, z }, { x: 3.2, z }]),
      },
      gevel: 'staalZwart', dak: 'felsAntraciet', stramien: 'stroken', elementen: [],
    },
  },
  {
    nr: 10, beeld: '10.jpg', status: 'geslaagd',
    naam: 'Gestapelde dozen, donker op wit',
    notitie: 'Donkere bovendoos kraagt zijwaarts uit over de carport-inham, wit ondervolume met brede pui.',
    camera: { azimut: 24, hoogte: 3, afstand: 27 },
    params: {
      id: 'ref10', typologie: 'loft', massa: 'stapel', lagen: 2, plat: true,
      b: 8.2, d: 10, goot: 6.2,
      stapel: {
        onder: { b: 8.2, d: 10, h: 3.1, kleur: 'wit' },
        boven: { b: 8.2, d: 10, h: 3.1, x: -2.4, kleur: 'staalZwart' },
        kolommen: [{ x: -6.0, z: 3.8 }],
      },
      glasPanelen: [
        { vlak: 'kop', x: 1.0, y: 1.6, w: 5.2, h: 2.6, z: 5.06 },
        { vlak: 'kop', x: -4.5, y: 4.7, w: 1.7, h: 1.9, z: 5.06 },
        { vlak: 'links', x: -6.56, y: 4.7, z: 1.2, w: 2.2, h: 1.9 },
      ],
      gevel: 'staalZwart', dak: 'felsAntraciet', stramien: 'vlak', elementen: [],
    },
  },
  {
    nr: 12, beeld: '12.jpg', status: 'geslaagd',
    naam: 'Grote uitkraging met vensterkader',
    notitie: 'Bovendoos kraagt fors uit naar voren, groot vierkant raam met dik kader in de uitkragende kop.',
    camera: { azimut: 30, hoogte: 3, afstand: 23 },
    params: {
      id: 'ref12', typologie: 'loft', massa: 'stapel', lagen: 2, plat: true,
      b: 7.5, d: 8, goot: 6.3,
      stapel: {
        onder: { b: 7.5, d: 8, h: 2.9, kleur: 'staalZwart' },
        boven: { b: 7.5, d: 8, h: 3.4, z: 2.4, kleur: 'staalZwart' },
      },
      glasPanelen: [
        { vlak: 'kop', x: -.5, y: 4.8, w: 3.2, h: 2.2, z: 6.46, kader: .24 },
        { vlak: 'kop', x: -2.2, y: 1.3, w: 1.2, h: 2.4, z: 4.06 },
      ],
      gevel: 'staalZwart', dak: 'felsAntraciet', stramien: 'vlak', elementen: [],
    },
  },
  {
    nr: 11, beeld: '11.jpg', status: 'geslaagd',
    naam: 'Glazen doos met pergola en dakterras',
    notitie: 'Teruggelegde bovendoos met terras en balustrade, pergola-lamellendak kraagt uit over het terras.',
    camera: { azimut: 20, hoogte: 3.2, afstand: 24 },
    params: {
      id: 'ref11', typologie: 'loft', massa: 'stapel', lagen: 2, plat: true,
      b: 8, d: 9, goot: 6.2,
      stapel: {
        onder: { b: 8, d: 9, h: 3.0, kleur: 'staalZwart' },
        boven: { b: 8, d: 7, h: 3.0, z: -1.0, kleur: 'staalZwart' },
        glasband: { y0: 3.3, y1: 5.6 },
        glasbandOnder: { y0: .25, y1: 2.75 },
      },
      balustrades: [{ x: 0, y: 3.1, z: 3.9, w: 7.4 }],
      pergola: { x: 0, y: 6.4, b: 8.6, d: 4.5, z: 2.2, stap: .5 },
      gevel: 'staalZwart', dak: 'felsAntraciet', stramien: 'grid', elementen: [],
    },
  },
]
