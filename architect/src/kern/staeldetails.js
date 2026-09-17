// STAEL-standaarddetails, geijkt op het IFC-model van de gerealiseerde
// woning in referenties/ifc/staelwoning.ifc (staalskelet, IFC4,
// SketchUp/Trimble-export). Dit is de maatgevende detailleringsbron;
// vormen blijven uit de kennisbank en de fotoreferenties komen.
//
// GEMETEN in het IFC (scripts/ifc-analyse.mjs):
// - voetafdruk 7,20 x 23,62 m; vrije overspanning van de beuk 7,2 m
// - verdiepingsvloer op 2,65-2,70 m; gootzone 4,90-5,20 m; nok 7,88 m
//   -> kap circa 38 graden op deze beuk
// - gevelbeplating loopt door tot de gootzone (mediaan bovenkant 4,93 m)
//   terwijl het dakvlak 0,171 m BINNEN de gevellijn eindigt, aan beide
//   langszijden exact gelijk: verholen goot achter een doorlopend
//   boeideel, geen zichtbare gootbak, geen overstek
// - beplating aluminium 1-3 mm (Al99, 'Aluminium sheet 2mm')
// - staal S235JR, koudgevormd RYN-profielsysteem, thermische
//   onderbrekingen, rubber afdichtingsprofielen
// - kleuren RAL 9004 signaalzwart en RAL 7039 kwartsgrijs
//
// AANNAME (niet als lagen in dit skelet-model aanwezig; aan te leveren):
// - totale dakpakketdikte 0,18 m en wandpakketdikte 0,28 m
// - kozijnprofiel 70 mm, neggediepte 100 mm (kozijnen zitten niet in
//   het staalmodel)

export const STAELDETAILS = {
  bron: 'referenties/ifc/staelwoning.ifc',
  maxOverspanning: 7.2,        // gemeten beuk; eerdere aanname was 9,5
  verdiepingsHoogte: 2.67,     // gemeten
  dak: {
    dikte: .18,                // aanname, zie boven
    plaat: 'aluminium 2 mm',   // gemeten
  },
  // detailfamilie 1 (default): strak/gootloos zoals gebouwd
  strak: {
    dakInzet: .17,             // gemeten: dakvlak eindigt 171 mm binnen de gevellijn
    overstek: 0,
    boeidikte: .03,            // plaatwerk, een vlak met de gevel
  },
  // detailfamilie 2: bewust kolossaal overstek, slank gedetailleerd
  kolossaal: {
    overstek: [0.8, 1.5],      // ontwerpbandbreedte
    overstekKopFactor: .75,
    randhoogte: .12,           // dun randprofiel, geen dik blok
    gordingProfiel: { h: .12, b: .06 },  // RYN-achtig koudgevormd, zichtbaar
    gordingHoh: .9,
  },
  nok: {
    vouwBreedte: .3,           // afdekstrook per dakvlak, langs de helling
    overlap: .05,
    dikte: .03,
  },
  kozijn: { profiel: .07, negge: .1 },   // aanname, aan te leveren
  materialen: {
    staal: 'S235JR', profielsysteem: 'RYN koudgevormd',
    kleuren: ['RAL 9004 signaalzwart', 'RAL 7039 kwartsgrijs'],
  },
}
