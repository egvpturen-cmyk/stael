# Later-ideeën

Ideeën die we bewust nu niet bouwen. Elk idee krijgt hier een volledige
notitie zodat het later zonder reconstructiewerk oppakbaar is. Niets in
dit bestand is planning; het plan staat in LIVE-ARCHITECT-PLAN.md.

## 1. Smaakbibliotheek als voorportaal

Status: genoteerd, niet gepland. Bouwen op zijn vroegst na fase 4.

### Het idee

Voordat de klant het programma invult (kavel, bouwvlak, woonoppervlak,
lagen, dakvorm), bladert hij eerst door een bibliotheek van vooraf
gegenereerde, door STÆL goedgekeurde AI-beelden van stalen woningen:
verschillende typologieën, materialen en sferen. Per beeld geeft hij
aan wat hij mooi vindt en wat niet.

Die keuzes vormen samen een smaakprofiel dat vervolgens de
variantgenerator en een "verzin het voor mij"-functie stuurt:

- typologie-voorkeur (schuurwoning, langhuis, loft, paviljoen);
- materiaalrichting (bijvoorbeeld warm hout tegenover zwart staal,
  fels tegenover zink);
- sfeer (ingetogen of expressief, gesloten of glazig, landelijk of
  stedelijk).

### Waarom dit sterk is

1. Het lost het lege-vel-probleem op: een klant zonder architectuurtaal
   hoeft geen parameters te begrijpen, hij hoeft alleen te reageren op
   beelden. Kiezen is makkelijker dan beschrijven.
2. Het maakt suggesties persoonlijk: de eerste variantenset voelt
   meteen als "voor mij gemaakt" in plaats van willekeurig.
3. De beelden zijn vooraf gegenereerd en door STÆL gekeurd voordat ze
   in de bibliotheek komen. Er gaan dus nooit AI-fouten (onmogelijke
   details, niet-STÆL-vormen) richting klant, en er zijn geen
   generatiekosten per bezoeker: de bibliotheek is een eenmalige,
   beheerde verzameling.

### Raakvlakken met het bestaande plan

- Fase 4 bouwt de AI-beeldpijplijn (fotostand per camerastandpunt,
  turntable-experiment). Diezelfde pijplijn kan de bibliotheekbeelden
  produceren; daarom heeft bouwen vóór fase 4 geen zin.
- De fase 2-presets (materialen en licht) leveren het vocabulaire
  waarin een smaakprofiel moet landen: een voorkeur is pas bruikbaar
  als de generator er materiaal- en sfeerkeuzes aan kan koppelen.
- De keuring van bibliotheekbeelden kan hetzelfde patroon volgen als
  de kalibratiepagina: STÆL keurt zelf, met expliciete statusknoppen,
  voordat iets zichtbaar wordt voor klanten.

### Open vragen voor later

- Hoeveel beelden zijn nodig voordat een smaakprofiel betekenis heeft,
  en hoeveel keuzes vragen we maximaal van de klant?
- Hoe vertaalt een set mooi/niet-mooi-keuzes zich concreet naar
  gewichten in de variantgenerator (per typologie, materiaal, sfeer)?
- Slaan we het smaakprofiel lokaal op (zoals de kalibratiestatussen)
  of hoort het bij het opslaan-zonder-account-mechanisme van fase 3?
- Is "verzin het voor mij" een aparte knop naast het programma, of de
  standaardroute voor nieuwe bezoekers?

## 2. Pratende Live Architect (spraakgestuurd ontwerpen)

Status: genoteerd, niet gepland. Bouwen na fase 3 op zijn vroegst
(dan bestaat opslag en de sessie-flow).

### Het idee

De klant praat met de Live Architect zoals met een mens, via een
levensechte stem-AI (denk aan OpenAI GPT-Live/Realtime API of
Sesame-achtige stemmen), in plaats van te typen en klikken. De
spraak-AI is via function calling gekoppeld aan de ontwerpstate:
gesproken wensen ("goot lager", "pui breder", "laat een variant met
corten zien") worden parameterwijzigingen die live op het 3D-model
gebeuren. De architect-stem reageert en stelt zelf vragen zoals een
echte architect dat doet ("wil je de entree aan de wegzijde?").

### Waarom dit kan werken

Het technisch fundament ligt er al: het hele ontwerp is een JSON-
parameterset, dus elke stem-actie is een parametermutatie die door de
bestaande validatiepoort gaat (bouwModel, valideerModel,
repareerModel). De stem hoeft niets van geometrie te weten; hij muteert
parameters en de kern bewaakt de wetten. Potentieel een enorme
wow-factor voor de Live Architect-sessie zelf.

### Aandachtspunten bij oppakken

- Kwaliteit van Nederlandse stemmen vergelijken voordat er iets wordt
  gekozen.
- Kosten per gespreksminuut in kaart brengen.
- De nieuwste GPT-Live-API is aangekondigd maar nog niet uit; de
  oudere Realtime API is wel beschikbaar.
- Fallback naar typen en klikken moet altijd blijven bestaan.
