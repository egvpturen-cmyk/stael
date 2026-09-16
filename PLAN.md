# STÆL — Architectural Steel Homes

Woningmerk (handelsnaam) van EG Assembly B.V., Naaldwijk. Aannemer en bouwer van stalen woningen / loftwoningen. Dit document is de brief voor Claude Code: merkregels, huidige status, en de specificatie van Live Architect.

## 1. Merk

- Naam: STÆL (in tekst en e-mail: STAEL). Tagline: "Architectural Steel Homes".
- Logo: huisje van staalprofielen + wordmark met ineengrijpende Æ. De Æ is het onderscheidende element.
- Assets: `assets/logo.png` (wit + koperen Æ, voor donkere achtergrond), `assets/wordmark.png` (alleen STÆL).
- Kleuren:
  - Achtergrond zwart: #131315, panelen #1B1B1E / #232327, randen #2E2E33
  - Koper (accent): #C98A5E, licht #E8B48C, diep #8A5637
  - Tekst: #EFECE6 (gebroken wit), gedempt #95928C
- Typografie: Archivo (Google Fonts), variabele breedte/gewicht. Kop 640, body 340.
- Toon: chique, duurzaam, modern, niet duur klinkend, kwaliteit. Nederlands, direct, vakmanschap ("gebouwd door bouwers, niet door een tekentafel").
- Stijlregels: geen em-dashes in UI-teksten en documenten; geen vet middenin zinnen; rustige animaties (subtiel, laag tempo); kopergloed als rode draad (lasnaad/vonken-motief).

## 2. Huidige website (index.html + assets/)

Eén statische pagina, alles vanilla HTML/CSS/JS, Three.js r128 via cdnjs voor de demo. Secties:

1. Zoom-intro: logo op zwart met foto erin, zoomt automatisch door de Æ naar de beeldvullende herofoto (1,5 s wachttijd + 2,8 s zoom, easeInOutCubic). Vonkendeeltjes (canvas) rond het logo.
2. Over ("Gebouwd door bouwers"): tekst + tellers (1992, 30+, 100%) + transformatie-animatie: 3D-render (assets/render.jpg) wordt met een verticale koperen lasnaad + vonkenregen "omgelast" naar de echte foto (assets/huis5.jpg). Klik = opnieuw afspelen.
3. STÆL-tekstmasker: gigantische letters gevuld met foto, verschuift bij scroll.
4. Live Architect sectie: uitleg, video-placeholder, knop "Probeer de demo" (opent 3D-overlay) en "Plan een Live Architect-sessie" (naar contact).
5. Galerij "Wonen in staal": mozaïek van 6 conceptbeelden (VIDE, POLDER, VAART, DIJK, LANGHUIS, ANKER) met tilt-hover en lightbox. Disclaimer: conceptbeelden, eerste project volgt.
6. Woordenlint (marquee), tabs "Waarom staal", tijdlijn "Van schets tot sleutel" (5 fasen), horizontale scrollsectie "Op de bouw" (4 teamfoto's), citaatblok, FAQ, contact, footer.
7. Extra's: preloaderloze start, custom cursor (desktop), magnetische knoppen, scrollvoortgang, lasnaad-dividers die oplichten, prefers-reduced-motion overal gerespecteerd.

### Openstaande punten website
- Contactformulier is nep (toont alleen bevestiging): koppelen aan e-mail/formulierdienst.
- Conceptbeelden en teamfoto's zijn AI-gegenereerd: vervangen door echte projectfoto's zodra het eerste STÆL-project er is. Op sommige beelden staan AI-tekstfouten (shirts, naambordjes).
- Logo bestaat alleen als PNG: vectorversie (SVG/AI) laten maken; master zwart-wit + variant met koperen Æ (#C98A5E vastleggen als merkkleur).
- Domein stael.nl registreren, merkcheck BOIP klasse 6 en 37.
- SEO/meta/OG-tags, favicon-bestand, analytics.

## 3. Live Architect — productspecificatie

Doel: samen met de klant live een woning ontwerpen. De huidige demo in index.html (Three.js, parametrisch blokmodel) is een conceptbewijs en NIET het gewenste niveau. Het echte product:

### Flow
1. **Programma invullen**: kavelgrootte (m²), bouwvlak (m²), gewenst woonoppervlak (m²), alles begane grond of met 1e verdieping, dakvorm (zadeldak / plat / mix).
2. **Vormvarianten**: uit die invoer genereert Live Architect meerdere realistische vormvarianten van de woning.
3. **Materiaal en kleur**: ruime bibliotheek voor dak- en gevelbekleding (hout, staal, steen, corten, fels, zink, koper...) en kleuren, plus de optie "verzin het voor mij".
4. **3D-resultaat**: fotorealistisch(er) beeld waar je 360° omheen kunt draaien, meerdere varianten naast elkaar.
5. **Reageren**: klikken op onderdelen in het beeld om opmerkingen te prikken ("dit raam groter", "gevel liever in hout"). Opmerkingen blijven bewaard.
6. **Itereren**: alle eerdere keuzes blijven op elk moment aanpasbaar; het model werkt live bij.
7. **Sessie**: "Plan een Live Architect-sessie" = afspraak waarin STÆL live meekijkt en aanpast.

### Technische richting (voorstel, ter discussie)
- Parametrische kern: Three.js of react-three-fiber; woninggenerator op basis van bouwvlak/oppervlak/lagen/dak (de demo-logica in index.html is een startpunt: zoek `LIVE ARCHITECT DEMO`).
- Realistischer beeld: PBR-materialen + HDRI-belichting; eventueel AI-beeldgeneratie (render-to-image) voor de "mooie foto"-stap.
- Opslag: ontwerp + opmerkingen per klant opslaan (bijv. Supabase/Postgres), deelbare link per ontwerp.
- Opmerkingen: raycast-pins met genummerde markers, lijst + status (open/verwerkt).
- Sessieplanning: koppeling met agenda (Cal.com of vergelijkbaar).
- Later: export naar IFC/SketchUp zodat het ontwerp de BIM-workflow van EG Assembly in kan (Solibri-controle).

### Prioriteit
1. Woninggenerator verbeteren (realistische verhoudingen, overstekken, kozijnindelingen, meerdere varianten die echt verschillen).
2. Materialenbibliotheek met echte texturen.
3. Opmerkingen-systeem met opslag.
4. "Verzin het voor mij" (slimme presets).
5. Sessieplanning + deelbare ontwerplinks.

## 4. Contact / gegevens

- Bedrijf: EG Assembly B.V., Naaldwijk (Westland). Bouwers sinds 1992.
- E-mail placeholder op de site: info@stael.nl (domein nog registreren).
- STÆL wordt gevoerd als handelsnaam onder EG Assembly B.V.
