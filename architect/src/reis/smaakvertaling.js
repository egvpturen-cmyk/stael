// DE VERTAALTABEL van smaakprofiel naar generator: puur data, bedoeld
// om te lezen en bij te sturen. De smaakmotor (smaakmotor.js) past
// deze tabel toe; hier staat geen logica.
//
// Hoe het werkt, in het kort:
// - families: elke collectie-familie (A tot F) geeft gewicht aan
//   typologieen, massastrategieen en een dakvoorkeur. De familietelling
//   van de favorieten bepaalt hoe zwaar elke rij meeweegt.
// - materialen: trefwoorden uit de genoteerde smaak (materialen en
//   citaten) wijzen naar materiaalpresets van de bibliotheek.
// - elementen: trefwoorden uit genoteerde elementen en citaten geven
//   bonuspunten aan varianten waarin dat element echt zit.
// - programma en kavel: vaste afleidingsregels onderaan.
//
// Typologieen: schuurwoning, langhuis, loft, paviljoen.
// Massas: enkel, kopstaart, dwarskap, asym, stapel, zwevend.
// Presets: polderZwart, warmHout, verweerdGrijs, blauwgrijsFels,
//   zinkModern, staalDonker, cortenLandelijk, witSereen, koperAccent,
//   witteSteen.

export const SMAAKVERTALING = {
  families: {
    A: { // archetypische kap, warm en ingetogen
      typologieen: { schuurwoning: 3, langhuis: 2 },
      massas: { enkel: 2, kopstaart: 2, dwarskap: 1.5, asym: 1 },
      dak: { zadel: 3 },
      presets: { polderZwart: 2, warmHout: 2, blauwgrijsFels: 1 },
    },
    B: { // horizontaal wonen, zwevende daklijsten
      typologieen: { paviljoen: 3, loft: 1 },
      massas: { stapel: 2, zwevend: 2, enkel: 1 },
      dak: { plat: 3 },
      presets: { koperAccent: 2, witSereen: 1.5, zinkModern: 1 },
    },
    C: { // gestapelde volumes, stedelijke allure
      typologieen: { loft: 2.5, paviljoen: 1.5 },
      massas: { stapel: 3, zwevend: 2 },
      dak: { plat: 2, mix: 1 },
      presets: { witteSteen: 2, staalDonker: 1.5, zinkModern: 1 },
    },
    D: { // ruig en sculpturaal, verwerend materiaal
      typologieen: { loft: 2, schuurwoning: 1.5 },
      massas: { zwevend: 2, asym: 1.5, kopstaart: 1, dwarskap: 1 },
      dak: { mix: 2, zadel: 1 },
      presets: { cortenLandelijk: 3, staalDonker: 1.5 },
    },
    E: { // serene platte villa, steen en brons
      typologieen: { paviljoen: 3 },
      massas: { enkel: 2, stapel: 1.5 },
      dak: { plat: 3 },
      presets: { witteSteen: 2, witSereen: 2, koperAccent: 1.5 },
    },
    F: { // landelijk hybride: kap plus platte vleugel
      typologieen: { langhuis: 2, schuurwoning: 2, paviljoen: 1 },
      massas: { kopstaart: 2, dwarskap: 2, asym: 1, enkel: 1 },
      dak: { mix: 3, zadel: 1 },
      presets: { warmHout: 2, polderZwart: 1.5, verweerdGrijs: 1 },
    },
  },

  // trefwoord (komt voor in genoteerde materialen of citaten, kleine
  // letters) naar presetgewichten
  materialen: {
    corten: { cortenLandelijk: 4, staalDonker: 1 },
    roest: { cortenLandelijk: 4 },
    hout: { warmHout: 3, polderZwart: 1 },
    zink: { zinkModern: 4 },
    koper: { koperAccent: 4 },
    brons: { koperAccent: 3 },
    stuc: { witSereen: 3 },
    wit: { witSereen: 2, witteSteen: 2 },
    steen: { witteSteen: 3 },
    travertin: { witteSteen: 3, koperAccent: 1 },
    kalksteen: { witteSteen: 3 },
    zwart: { polderZwart: 2, staalDonker: 1 },
    fels: { polderZwart: 2, blauwgrijsFels: 1 },
    staal: { staalDonker: 2 },
    grijs: { verweerdGrijs: 2, blauwgrijsFels: 1 },
  },

  // trefwoord naar een controleerbaar kenmerk van een variant; de
  // motor geeft de bonus alleen als het kenmerk er echt in zit
  elementen: {
    overstek: { kenmerk: 'massaZwevend', bonus: 3 },
    zwevend: { kenmerk: 'massaZwevend', bonus: 2 },
    balkon: { kenmerk: 'balkon', bonus: 3 },
    veranda: { kenmerk: 'veranda', bonus: 3 },
    luifel: { kenmerk: 'luifel', bonus: 3 },
    pergola: { kenmerk: 'pergola', bonus: 3 },
    lamellen: { kenmerk: 'lamellen', bonus: 3 },
    terras: { kenmerk: 'terras', bonus: 2 },
    plint: { kenmerk: 'plint', bonus: 2 },
    portaal: { kenmerk: 'portaal', bonus: 2 },
    glas: { kenmerk: 'puiStrak', bonus: 1 },
    vide: { kenmerk: 'puiStrak', bonus: 1 },
  },

  // programma en kavel naar generatorinvoer
  afleiding: {
    // bouwvlak-schatting uit de kaveloppervlakte zolang het echte
    // bouwvlak uit het bestemmingsplan niet bekend is
    bouwvlakDeel: 0.35,
    bouwvlakMin: 80,
    bouwvlakMax: 300,
    // standaardwaarden wanneer het programma een veld niet noemt
    woonoppStandaard: 140,
    kavelStandaard: 800,
    // vanaf dit aantal slaapkamers krijgt de woning een verdieping,
    // ook als het aantal verdiepingen niet is uitgesproken
    slaapkamersVoorVerdieping: 4,
  },

  // hoeveel kandidaten de motor bouwt en hoe divers de set van 5 is
  set: {
    kandidaten: 14,
    grootte: 5,
    maxPerTypologieMassa: 2,
  },
}
