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
    nr: 1, beeld: '1.png', status: 'open',
    naam: 'Schuurwoning, hout met zwart kader',
    notitie: 'Nog niet nagebouwd.',
    camera: { azimut: 20, hoogte: 3.5, afstand: 24 },
    params: {
      id: 'ref1', typologie: 'schuurwoning', massa: 'enkel', lagen: 2,
      b: 8.4, d: 10.5, goot: 3.4, helling: 44,
      gevel: 'houtWarm', dak: 'felsAntraciet', stramien: 'vlak',
      kader: { kleur: 'houtZwart' }, elementen: ['kader'],
    },
  },
  {
    nr: 3, beeld: '3.png', status: 'open',
    naam: 'Zwarte schuurwoning met lamellen in de top',
    notitie: 'Nog niet nagebouwd.',
    camera: { azimut: 26, hoogte: 3, afstand: 22 },
    params: {
      id: 'ref3', typologie: 'schuurwoning', massa: 'enkel', lagen: 2,
      b: 6.6, d: 11, goot: 2.6, helling: 54,
      gevel: 'staalZwart', dak: 'felsAntraciet', stramien: 'stroken',
      lamellen: true, elementen: ['lamellen'],
    },
  },
  {
    nr: 7, beeld: '7.jpg', status: 'open',
    naam: 'Witte kap over inpandige veranda',
    notitie: 'Nog niet nagebouwd; inpandige veranda ontbreekt in de generator.',
    camera: { azimut: 0, hoogte: 2.5, afstand: 24 },
    params: {
      id: 'ref7', typologie: 'schuurwoning', massa: 'enkel', lagen: 1,
      b: 10, d: 11, goot: 2.4, helling: 38,
      gevel: 'wit', dak: 'zink', stramien: 'vlak',
      kader: { kleur: 'wit' }, elementen: ['kader'],
    },
  },
  {
    nr: 6, beeld: '6.jpg', status: 'open',
    naam: 'Kop met garagevolume en lamellenveld',
    notitie: 'Nog niet nagebouwd; aangebouwd plat volume ontbreekt.',
    camera: { azimut: -28, hoogte: 3.5, afstand: 24 },
    params: {
      id: 'ref6', typologie: 'schuurwoning', massa: 'enkel', lagen: 2,
      b: 7.4, d: 12, goot: 3.2, helling: 50,
      gevel: 'houtGrijs', dak: 'felsAntraciet', stramien: 'grid',
      lamellen: true, elementen: ['lamellen'],
    },
  },
  {
    nr: 13, beeld: '13.jpg', status: 'open',
    naam: 'Wit dakkader met balkon in de kopgevel',
    notitie: 'Nog niet nagebouwd; gevelbanden per laag ontbreken.',
    camera: { azimut: 12, hoogte: 3, afstand: 22 },
    params: {
      id: 'ref13', typologie: 'schuurwoning', massa: 'enkel', lagen: 2,
      b: 7.8, d: 10, goot: 3.6, helling: 52,
      gevel: 'houtZwart', dak: 'felsAntraciet', stramien: 'grid',
      kader: { kleur: 'wit' }, elementen: ['kader', 'balkon'],
    },
  },
  {
    nr: 9, beeld: '9.jpg', status: 'open',
    naam: 'Zwarte doos met lamellen voor de pui',
    notitie: 'Nog niet nagebouwd; lamellenveld op de verdieping en dakopbouw ontbreken.',
    camera: { azimut: 18, hoogte: 3.5, afstand: 20 },
    params: {
      id: 'ref9', typologie: 'loft', massa: 'enkel', lagen: 2, plat: true,
      b: 6.8, d: 8.5, goot: 6.4,
      gevel: 'staalZwart', dak: 'felsAntraciet', stramien: 'stroken', elementen: [],
    },
  },
  {
    nr: 5, beeld: '5.png', status: 'open',
    naam: 'Zwevende glazen doos op kolommen',
    notitie: 'Nog niet nagebouwd.',
    camera: { azimut: 22, hoogte: 3.5, afstand: 24 },
    params: {
      id: 'ref5', typologie: 'loft', massa: 'zwevend', lagen: 2, plat: true,
      b: 7.5, d: 13, goot: 6.4,
      zwevend: { onderH: 2.7, overhang: 1.6, onderKrimp: .55 },
      gevel: 'staalZwart', gevel2: 'staalZwart', dak: 'felsAntraciet',
      stramien: 'stroken', elementen: [],
    },
  },
  {
    nr: 10, beeld: '10.jpg', status: 'open',
    naam: 'Gestapelde dozen, donker op wit',
    notitie: 'Nog niet nagebouwd; gestapelde massa met zijwaartse uitkraging ontbreekt.',
    camera: { azimut: 24, hoogte: 3, afstand: 26 },
    params: {
      id: 'ref10', typologie: 'loft', massa: 'zwevend', lagen: 2, plat: true,
      b: 8.5, d: 12, goot: 6.2,
      zwevend: { onderH: 3.0, overhang: 1.8, onderKrimp: .8 },
      gevel: 'staalZwart', gevel2: 'wit', dak: 'felsAntraciet',
      stramien: 'vlak', elementen: [],
    },
  },
  {
    nr: 12, beeld: '12.jpg', status: 'open',
    naam: 'Grote uitkraging met vensterkader',
    notitie: 'Nog niet nagebouwd; forse uitkraging met groot raamkader ontbreekt.',
    camera: { azimut: 30, hoogte: 3, afstand: 22 },
    params: {
      id: 'ref12', typologie: 'loft', massa: 'zwevend', lagen: 2, plat: true,
      b: 7.5, d: 10, goot: 6.4,
      zwevend: { onderH: 3.0, overhang: 2.6, onderKrimp: .75 },
      gevel: 'staalZwart', gevel2: 'staalZwart', dak: 'felsAntraciet',
      stramien: 'vlak', elementen: [],
    },
  },
  {
    nr: 11, beeld: '11.jpg', status: 'open',
    naam: 'Glazen doos met pergola en dakterras',
    notitie: 'Nog niet nagebouwd; pergola-lamellendak en dakterras ontbreken.',
    camera: { azimut: 20, hoogte: 3.5, afstand: 22 },
    params: {
      id: 'ref11', typologie: 'loft', massa: 'enkel', lagen: 2, plat: true,
      b: 8, d: 9, goot: 6.2,
      gevel: 'staalZwart', dak: 'felsAntraciet', stramien: 'grid', elementen: [],
    },
  },
]
