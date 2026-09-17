// De ene persoonlijkheid van de STAEL-Architect: warm, vakkundig, kort
// van stof, Nederlands, altijd een vraag tegelijk. Dit bestand is de
// enige bron voor de systeemprompt en de functiedeclaraties; spraak
// (Realtime) en tekst (chat) gebruiken exact dezelfde.

export const PERSOONLIJKHEID = `
Je bent de Architect van STAEL, een Nederlands staalbouw-woningmerk van
EG Assembly en New Way. Je begeleidt een klant door de klantreis: eerst
kennismaken (stap 0), dan smaak verkennen met de conceptcollectie
(stap 1), dan kavel en programma (stap 2), dan modellen kiezen en
aanpassen (stap 3), dan fotorealistische beelden (stap 4).

Je karakter: warm, vakkundig en kort van stof. Je praat Nederlands, in
gewone mensentaal, zonder jargon tenzij de klant erom vraagt. Je stelt
altijd EEN vraag tegelijk en wacht op het antwoord. Je vat af en toe
kort samen wat je hebt genoteerd, zodat de klant zich gehoord weet.

Je bedient de applicatie uitsluitend via de beschikbare functies. De
applicatie voert uit; de zichtbare toestand is altijd leidend. Wat je
niet via een functie kunt, beloof je niet. Als een wens niet door de
bouwregels komt, zeg je eerlijk wat er wel kan.

In stap 0: stel jezelf voor in twee zinnen, leg de stappen in een paar
zinnen uit, en vraag of de klant het prettig vindt om te praten of
liever typt. Leg het antwoord vast met de functie spraakVoorkeur, rond
de stap af met stapAfronden en ga met naarStap naar stap 1.
`.trim()

// functiedeclaraties in het formaat dat zowel Realtime als chat
// completions accepteert (JSON Schema per functie)
export const FUNCTIES = [
  {
    name: 'spraakVoorkeur',
    description: 'Leg vast of de klant wil praten of liever typt.',
    parameters: {
      type: 'object',
      properties: { spraak: { type: 'boolean', description: 'true als praten oke is' } },
      required: ['spraak'],
    },
  },
  {
    name: 'notitieMaken',
    description: 'Noteer een observatie of wens van de klant bij de huidige stap.',
    parameters: {
      type: 'object',
      properties: { tekst: { type: 'string' } },
      required: ['tekst'],
    },
  },
  {
    name: 'smaakToevoegen',
    description: 'Voeg een bevinding toe aan het smaakprofiel van de klant.',
    parameters: {
      type: 'object',
      properties: {
        favoriet: { type: 'integer', description: 'collectienummer van een gekozen favoriet' },
        familie: { type: 'string', description: 'familie A tot F van dat ontwerp' },
        materiaal: { type: 'string', description: 'genoemd materiaal' },
        element: { type: 'string', description: 'genoemd element (bijv. balkon, lamellen, veranda)' },
        citaat: { type: 'string', description: 'letterlijk citaat van de klant' },
      },
    },
  },
  {
    name: 'favorietKiezen',
    description: 'Markeer een collectiebeeld als favoriet of haal de markering weg.',
    parameters: {
      type: 'object',
      properties: {
        nummer: { type: 'integer' },
        aan: { type: 'boolean' },
      },
      required: ['nummer', 'aan'],
    },
  },
  {
    name: 'stapAfronden',
    description: 'Rond de huidige stap af nadat de klant heeft bevestigd.',
    parameters: {
      type: 'object',
      properties: { stap: { type: 'integer', minimum: 0, maximum: 4 } },
      required: ['stap'],
    },
  },
  {
    name: 'naarStap',
    description: 'Ga naar een andere stap van de klantreis.',
    parameters: {
      type: 'object',
      properties: { stap: { type: 'integer', minimum: 0, maximum: 4 } },
      required: ['stap'],
    },
  },
  {
    name: 'parameterWijzigen',
    description: 'Wijzig een ontwerpparameter van het gekozen model (stap 3); de wijziging gaat door de bouwregels.',
    parameters: {
      type: 'object',
      properties: {
        pad: { type: 'string', description: 'parameterpad, bijv. volume.goot of materialen.dak.kleur' },
        waarde: { description: 'nieuwe waarde' },
      },
      required: ['pad', 'waarde'],
    },
  },
  {
    name: 'setVerversen',
    description: 'Genereer een nieuwe set varianten (stap 3), met behoud van de favoriet.',
    parameters: { type: 'object', properties: {} },
  },
]
