# Live Architect: plan

Status: voorstel, wacht op akkoord. Er is nog niets van gebouwd.

## 1. Het einddoel zoals ik het begrijp

Live Architect is een ontwerpprogramma waarmee STÆL samen met de klant live een woning ontwerpt. Het is geen speeltje naast de site maar een verkoop- en ontwerpinstrument: de klant ervaart dat zijn woning al vorm krijgt voordat er een architect of offerte aan te pas komt, en STÆL krijgt een concreet, gedeeld vertrekpunt voor het echte traject.

De klant doorloopt dit pad:

1. Programma invullen: kavelgrootte, bouwvlak, gewenst woonoppervlak, alles op de begane grond of ook een verdieping, en de dakvorm (zadeldak, plat, of een mix).
2. Uit die invoer genereert Live Architect meerdere vormvarianten die echt van elkaar verschillen: andere massaopbouw, andere verhoudingen, niet drie keer dezelfde doos met een ander sausje.
3. De klant kiest dak- en gevelbekleding uit een ruime bibliotheek (hout, staal, steen, corten, fels, zink, koper en meer) en kleuren, of laat Live Architect zelf een overtuigende combinatie voorstellen ("verzin het voor mij").
4. Het resultaat is een fotorealistische 3D-weergave waar je 360 graden omheen draait, met meerdere varianten naast elkaar.
5. De klant klikt op onderdelen in het beeld en prikt daar opmerkingen ("dit raam groter", "gevel liever in hout"). Die opmerkingen blijven bewaard bij het ontwerp.
6. Alle eerdere keuzes blijven altijd aanpasbaar; het model werkt live bij. Het is een lus, geen wizard die je maar één keer mag doorlopen.
7. De kroon op het geheel is de echte Live Architect-sessie: een afspraak waarin STÆL live meekijkt in hetzelfde model en ter plekke aanpast wat de klant wil.

Daaroverheen ligt een harde eis: Live Architect denkt in de vormen en materialen van stalen woningen. Geen generieke huisjes, maar de ontwerptaal van staalbouw: grote vrije overspanningen, slanke profielen, dubbelhoge glasgevels, zadeldaken en schuurwoning-volumes, felsdaken, gevels in hout, corten, zink, koper en staal. Alles wat het systeem genereert of voorstelt, ook bij "verzin het voor mij", komt uit die wereld. Het systeem gebruikt daarvoor het internet als inspiratiebron; hoe, staat in 2.2.

De huidige Three.js-demo in index.html is een conceptbewijs van stap 1, 2 (mager), 3 (drie geveltjes) en 5 (pins zonder opslag). Het gewenste niveau ligt ver daarboven, vooral op realisme, variatie, ontwerptaal en het bewaren van werk per klant.

## 2. Architectuur en techniek

### 2.1 De 3D-kern: parametrische woninggenerator

Voorstel: een aparte web-app (los bestand of submap, niet meer inline in index.html) gebouwd met Vite, React en react-three-fiber (Three.js).

Afwegingen:
- Vanilla Three.js (zoals de demo) blijft werkbaar voor één scène, maar de UI eromheen (programma, varianten, materialen, opmerkingenlijst, sessies) wordt al snel een kluwen. React met react-three-fiber koppelt de ontwerpstate netjes aan zowel de UI als het 3D-model: één state, alles werkt live bij. Dat is precies eis 6.
- De generator zelf is gewone wiskunde en blijft van ons: uit bouwvlak, oppervlak, lagen en dakvorm volgen massa's met realistische verhoudingen, overstekken, goot- en nokhoogtes, kozijnindelingen per gevel (stramien), en varianten via verschillende massastrategieën (langwerpig, compact, samengesteld met bijgebouw, schuur-archetype). De demo-logica is het startpunt maar wordt herschreven.
- Het ontwerp is een JSON-parameterset (programma + variant + materialen + kleuren). Dat maakt opslaan, delen, versies en later BIM-export haalbaar.

### 2.2 De ontwerptaal van staalbouw en het internet als inspiratiebron

De generator moet niet zomaar dozen maken maar staalwoningen. Dat regel ik met een kennisbank die de generator voedt, opgebouwd en bijgehouden met web-research.

De kennisbank (ontwerptaal-bibliotheek):
- Typologieën: barnhouse/schuurwoning, loftwoning met portaalconstructie, langhuis, plat gedekt paviljoen met overstek, samengestelde volumes met bijgebouw. Per typologie: kenmerkende verhoudingen (goot- en nokhoogte, dakhelling, slankheid), gevelopbouw (waar zit de dubbelhoge glasgevel, waar de gesloten flank), materiaalcombinaties die er wél en niet bij passen, en detailregels (overstekken, negge, kozijnstramien, slanke stalen profielen in het zicht).
- Materiaalkennis: felsdak in zink of staal, houten delen verticaal of horizontaal, corten als accent of als hele gevel, koper voor daklijnen; welke combinaties in de praktijk van staalframebouw voorkomen en mooi verouderen.
- Vorm: geen woordenlijst maar regels en presets in code en data (JSON), zodat de generator en "verzin het voor mij" er direct uit putten. Elke variant die het systeem toont is een toepassing van deze regels op het programma van de klant.

Hoe het internet erin komt, twee routes met afweging:
- Vooraf gecureerde web-research (mijn advies als basis): ik onderzoek staalwoning-typologieën, barnhouses, loftwoningen, staalframebouw en portaalconstructies op het web en destilleer daar principes en verhoudingen uit, die ik vastleg in de kennisbank. Voordelen: snel in gebruik (geen wachttijd per klant), consistent, controleerbaar door jou, en zuiver qua auteursrecht omdat we principes overnemen en geen ontwerpen kopiëren. Nadeel: de bank is zo vers als de laatste onderzoeksronde; daarom hoort er een terugkerende verversing bij (nieuwe ronde per kwartaal of op verzoek, als beheertaak).
- Live AI met webtoegang: een model dat tijdens het ontwerpen inspiratie ophaalt. Voordeel: altijd vers en verrassend. Nadelen: traag (seconden tot tientallen seconden midden in de klantflow), wisselende kwaliteit, moeilijk te garanderen dat het binnen de STÆL-taal blijft, en het risico dat het te dicht op een bestaand ontwerp gaat zitten zonder dat iemand het merkt. Advies: niet in de live klantflow. Wel bruikbaar als hulpmiddel in de beheerroute: bij het verversen van de kennisbank en eventueel achter "verzin het voor mij" in de vorm van vooraf gegenereerde en door jou goedgekeurde presets.
- Auteursrecht als regel: inspiratie, typologieën en principes overnemen is prima; herkenbare ontwerpen van anderen nabouwen niet. De kennisbank slaat daarom geen plaatjes van andermans huizen op als te kopiëren doel, alleen geabstraheerde regels, en eigen referentiebeelden komen uit de STÆL-collectie.

Tegen eenheidsworst: variatie zit op drie lagen. De typologieën verschillen wezenlijk van elkaar; binnen een typologie variëren verhoudingen en gevelindeling gestuurd op het programma van de klant plus een gecontroleerde toevalsfactor; en de presets van "verzin het voor mij" zijn samengestelde combinaties waarvan er steeds meerdere bestaan per situatie. Twee klanten met hetzelfde programma krijgen zo verwante maar niet identieke voorstellen, en de bank groeit met elke verversingsronde.

### 2.3 Van blokkendoos naar fotorealistisch

Drie routes, met een advies:

Route A, puur real-time 3D: PBR-materialen met echte texturen (kleur, normal, roughness) en HDRI-belichting met zachte schaduwen. Gratis CC0-bronnen (Poly Haven, ambientCG) leveren uitstekende houten delen, felsplaten, corten, zink en baksteen. Dit niveau haalt "zeer nette archviz-preview": duidelijk geen foto, wel aantrekkelijk en volledig interactief. Geen externe kosten, werkt offline, altijd 60 fps op een normale laptop.

Route B, AI-beeldgeneratie als renderlaag: het 3D-model wordt met dieptekaart en lijnwerk als sturing (ControlNet-achtig, of moderne image-to-image modellen) omgezet naar een fotorealistisch beeld via een API (bijv. Replicate, Stability of Flux). Resultaat kan verbluffend zijn, maar: het duurt 10 tot 30 seconden per beeld, kost geld per beeld, je kunt er niet omheen draaien (het is een foto, geen model), en details kunnen afwijken van wat de klant koos (het AI-beeld "verzint" er dingen bij, vergelijkbaar met de tekstfouten op de huidige conceptbeelden).

Route C, hybride (mijn advies): route A is de werkvloer waarin je draait, kiest en pinnen prikt, altijd live. Daarnaast een knop "maak er een foto van" die per variant een AI-render maakt vanuit de gekozen camerahoek. De klant krijgt beide: het interactieve model als waarheid, het AI-beeld als sfeerimpressie. Zo botst de traagheid van AI nooit met de eis dat alles live bijwerkt.

Volgorde: eerst route A op niveau brengen (fase 1 en 2), dan pas route B erbovenop (fase 4). Als route A goed genoeg blijkt, kan fase 4 zelfs vervallen of wachten.

### 2.4 Opslag van ontwerpen en opmerkingen

Voorstel: Supabase (Postgres met auth, storage en realtime, royale gratis instap).

- Tabellen: klanten (of alleen e-mail), ontwerpen (JSON-parameterset, naam, tijdstempels), opmerkingen (ontwerp-id, 3D-ankerpunt, onderdeelnaam, tekst, status open/verwerkt, nummer).
- Toegang: de klant krijgt een deelbare link met een token per ontwerp (geen wachtwoord nodig om te beginnen; optioneel later inloggen via e-mail magic link). Row level security zorgt dat een link alleen het eigen ontwerp opent.
- Afweging: Firebase kan hetzelfde, maar Supabase is Postgres (makkelijker rapporteren, later koppelen) en past bij de richting die PLAN.md al noemde. Een eigen backend bouwen is nu onnodig gewicht.
- Pins: raycast op het model, opgeslagen met positie plus het onderdeel waarop geklikt is (gevel zuid, raam 3), zodat een pin ook na een modelwijziging zinvol terugkomt of netjes als "vervallen" gemarkeerd wordt.

### 2.5 De live-sessie

Groeipad in twee stappen:

1. Eerst praktisch: "Plan een Live Architect-sessie" opent een agenda (Cal.com of vergelijkbaar). De sessie zelf is een videogesprek met schermdelen waarin STÆL het ontwerp van de klant opent via de deelbare link en live aanpast. Geen extra techniek nodig; dit kan zodra fase 3 er is.
2. Later echt gedeeld: via Supabase Realtime kijken klant en STÆL in hetzelfde model; wie "presenteert" stuurt camera en wijzigingen, de ander ziet alles direct. Technisch goed haalbaar omdat het hele ontwerp één JSON-state is; het is vooral zorgvuldig synchronisatiewerk.

### 2.6 Hosting en plek op de site

- De app wordt statisch gebouwd (Vite) en kan gewoon mee op GitHub Pages onder /architect/, met een eigen link vanaf de Live Architect-sectie op de site. Geen aparte hosting nodig voor fase 1 en 2.
- Zodra Supabase meedoet (fase 3) blijft de app statisch; de database praat rechtstreeks met de browser.
- Alleen de AI-renderlaag (fase 4) heeft een klein serverless tussenstuk nodig zodat de API-sleutel niet in de browser ligt (bijv. Supabase Edge Function of Vercel Function).
- Later, als het domein stael.nl er is: architect.stael.nl.

### 2.7 Later: richting BIM

Omdat het ontwerp een parameterset is, kan er een exporter bij die IFC (of eerst een eenvoudiger tussenformaat) genereert voor de BIM-workflow van EG Assembly (Solibri-controle). Dit staat bewust achteraan; het beïnvloedt nu alleen de keuze om alles parametrisch en gestructureerd op te slaan.

## 3. Gefaseerd bouwplan

Elke fase levert iets werkends op dat aan klanten te laten zien is.

### Fase 0: fundament (klein)
- Aparte app-structuur (Vite + React + react-three-fiber) in de repo, bereikbaar via /architect/.
- Programma-invoer (stap 1) en de JSON-ontwerpstate, met de huidige generator als tijdelijke inhoud.
- Demonstreerbaar: dezelfde demo als nu, maar als eigen app met nette invoer; de basis waar alles op stapelt.

### Fase 1: woninggenerator 2.0 (prioriteit 1 uit PLAN.md)
- Eerste versie van de kennisbank uit 2.2: web-research naar staalwoning-typologieën, vastgelegd als regels en verhoudingen; door jou te controleren aan de hand van referentiebeelden.
- Generator bouwt op die typologieën: realistische verhoudingen en maatvoering, overstekken, goot- en nokdetail, kozijnstramienen per gevel, dubbelhoge glasgevels, entree.
- Drie tot vijf varianten die wezenlijk verschillen in massaopbouw, live naast elkaar te vergelijken.
- Zadeldak, plat en mix volwaardig.
- Demonstreerbaar: klant vult programma in en ziet binnen seconden meerdere geloofwaardige woningen, 360 graden draaibaar.

### Fase 2: materiaal en licht
- PBR-materialenbibliotheek met echte texturen: hout (meerdere), fels, zink, koper, corten, steen, stucwerk; kleursystemen per materiaal.
- HDRI-belichting, zachte schaduwen, eenvoudige kavelcontext (gras, bestrating, erfgrens uit kavelinvoer).
- "Verzin het voor mij": samengestelde presets uit de ontwerptaal-bibliotheek, meerdere per situatie zodat niet elke klant hetzelfde huis krijgt.
- Demonstreerbaar: de wow-stap; materiaal- en kleurkeuze per vlak op een mooi belicht model. Dit is het niveau "zeer nette archviz", nog zonder AI.

### Fase 3: bewaren, delen, opmerkingen
- Supabase: ontwerpen opslaan, deelbare link per ontwerp.
- Pins prikken op onderdelen, opmerkingenlijst met status open/verwerkt.
- "Plan een Live Architect-sessie" gekoppeld aan een echte agenda.
- Demonstreerbaar: klant ontwerpt thuis, prikt opmerkingen, stuurt de link; STÆL opent hetzelfde ontwerp en ziet alles. De sessie kan vanaf hier al echt plaatsvinden (met schermdelen).

### Fase 4: de fotostand
- AI-renderlaag: per variant en camerahoek een fotorealistisch beeld, gestuurd door het 3D-model.
- Serverless functie voor de API-sleutel; kosten per beeld bewaakt.
- Demonstreerbaar: knop "maak er een foto van" naast het interactieve model.

### Fase 5: echt samen kijken
- Realtime sessiemodus: klant en STÆL in hetzelfde model, presenter-rol, live aanpassen.
- Demonstreerbaar: de volwaardige Live Architect-sessie zonder schermdelen.

### Fase 6 (later): BIM-brug
- Export van de parameterset richting IFC/SketchUp voor de workflow van EG Assembly.

## 4. Vragen voordat ik begin

Techniek en geld:
1. Budget voor externe diensten: Supabase heeft een gratis instap; AI-renders kosten grofweg 1 tot 10 cent per beeld plus wat serverless-kosten. Is er budget voor die AI-renderlaag, en zo ja, een orde van grootte per maand?
2. Hosting: mag de app gewoon mee op GitHub Pages (/architect/), of wil je meteen naar iets als Vercel (handig zodra fase 4 een serverless functie nodig heeft)?
3. Komt stael.nl er binnenkort? Dan houd ik rekening met architect.stael.nl.

Product en kwaliteit:
4. Wat is "fotorealistisch genoeg" voor jou? Heb je één of twee referentiebeelden van het niveau dat je bij fase 2 (real-time 3D) acceptabel vindt, en het niveau waarvoor je de AI-fotostand echt nodig acht?
5. Hoe gevoelig ligt AI-beeldgeneratie richting klanten, gezien de AI-tekstfouten op de huidige conceptbeelden? Is een sfeerimpressie met kleine afwijkingen acceptabel als het interactieve model de waarheid blijft?
6. Welke materialen moeten er minimaal in de bibliotheek bij de eerste oplevering van fase 2? En zijn er STÆL-vaste architectuurkeuzes (kozijnkleur, goothoogtes, raamverhoudingen) die de generator moet afdwingen?
7. Moeten varianten binnen de regels van een gemiddeld bestemmingsplan blijven (goothoogte, nokhoogte, dakhelling), en zo ja, wil je die grenzen kunnen instellen per kavel?

Klanten en proces:
8. Mogen klanten zonder account werken met alleen een deelbare link, of wil je vanaf het begin een e-mailadres vangen (magic link) voor opvolging?
9. Wie behandelt de opmerkingen aan STÆL-kant, en is een simpel intern lijstje per ontwerp genoeg of wil je een dashboard over alle klanten heen?
10. Welke agenda gebruik je (of wil je gebruiken) voor het plannen van sessies? Cal.com, Calendly, of iets bestaands van EG Assembly of New Way?
11. Op welke apparaten moet dit vlekkeloos werken? Alleen desktop en tablet, of ook telefoon? Is er een showroom-scenario (groot scherm, touch)?
12. Alleen Nederlands, of ook Engels?

Planning:
13. Is de fasevolgorde goed zo, of wil je de fotostand (fase 4) eerder omdat die commercieel het meeste indruk maakt?
14. Is er een moment waarop je dit wilt kunnen tonen (beurs, klantafspraak), zodat ik daar met de fasering rekening mee kan houden?

Ontwerptaal en inspiratie:
15. Heb je voorbeelden van staalwoningen die je mooi vindt (links, foto's, projectnamen)? Vijf tot tien referenties zijn goud als startpunt van de ontwerptaal; ook één of twee voorbeelden van wat je juist niet wilt helpt enorm.
16. Zijn er typologieën die er zeker in moeten of juist niet (barnhouse, loftwoning met portaalconstructie, langhuis, plat paviljoen)?
17. Wil je de kennisbank periodiek laten verversen met nieuwe web-research (bijv. per kwartaal), en wil je nieuwe presets dan eerst zelf goedkeuren voordat klanten ze zien?
