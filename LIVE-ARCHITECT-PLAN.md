# Live Architect: plan

Status: akkoord gegeven. Hosting op Vercel, opslag via Railway, ontwerptaal start vanuit de eigen referentiebeelden in assets/. Bouw gestart met fase 0 en 1.

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

Besloten: Railway, omdat dat al betaald en vertrouwd is. Bewuste afweging: Supabase zou auth, row level security en realtime kant en klaar leveren; met Railway bouwen we dat zelf, dus fase 3 en fase 5 bevatten meer eigen bouwwerk. Geaccepteerd.

- Railway Postgres als database: ontwerpen (JSON-parameterset, naam, tijdstempels), opmerkingen (ontwerp-id, 3D-ankerpunt, onderdeelnaam, tekst, status open/verwerkt, nummer), e-mailadressen van klanten.
- Daarvoor een klein API-servicetje op Railway (Node, minimalistisch): endpoints voor ontwerp opslaan/laden via een deelbaar token, opmerkingen toevoegen/afvinken, en e-mail vangen bij het opslaan. De browser praat alleen met deze API, nooit rechtstreeks met de database.
- Deelbare links werken via een ontwerp-token in de URL, gecontroleerd door onze eigen API.
- Pins: raycast op het model, opgeslagen met positie plus het onderdeel waarop geklikt is (gevel zuid, raam 3), zodat een pin ook na een modelwijziging zinvol terugkomt of netjes als "vervallen" gemarkeerd wordt.
- De API komt als api-map in de repo te staan; de map wordt in fase 0 al aangelegd, de API zelf wordt pas in fase 3 gebouwd.

### 2.5 De live-sessie

Groeipad in twee stappen:

1. Eerst praktisch: "Plan een Live Architect-sessie" opent een agenda (Cal.com of vergelijkbaar). De sessie zelf is een videogesprek met schermdelen waarin STÆL het ontwerp van de klant opent via de deelbare link en live aanpast. Geen extra techniek nodig; dit kan zodra fase 3 er is.
2. Later echt gedeeld: via websockets op hetzelfde Railway-servicetje kijken klant en STÆL in hetzelfde model; wie "presenteert" stuurt camera en wijzigingen, de ander ziet alles direct. Technisch goed haalbaar omdat het hele ontwerp één JSON-state is; het is vooral zorgvuldig synchronisatiewerk (meer eigen bouwwerk dan met een kant-en-klare realtime-dienst, zie de afweging in 2.4).

### 2.6 Hosting en plek op de site

- Besloten: de app draait op Vercel (daar wordt al mee gewerkt, en fase 4 heeft het toch nodig). De app wordt statisch gebouwd met Vite en als eigen Vercel-project uitgerold vanuit de architect-map in de repo.
- De statische site (index.html) blijft voorlopig op GitHub Pages; de Live Architect-sectie linkt naar de app op Vercel.
- De AI-renderproxy van fase 4 wordt een endpoint op de Railway-API (zie 2.4), geen aparte serverless functie; zo liggen alle sleutels op één plek.
- Domein: stael.nl is bezet, het wordt waarschijnlijk staelhome.nl. De app komt dan op architect.staelhome.nl; e-mail wordt info@staelhome.nl.

### 2.7 De gebouwmodel-kern (BIM-denkwijze)

Besloten na de kalibratieronde: de generator plaatste losse meshes met formules, zonder gebouwmodel, en dat is de ene oorzaak achter de hele foutenfamilie (niet-sluitende daken en gevels, prikkende lamellen en spanten, open nokken en goten, kozijnen door elkaar). De kern wordt herbouwd volgens de BIM-denkwijze: eerst een gebouwmodel met elementen en relaties, daarna pas de 3D-geometrie afleiden.

De pijplijn wordt: parameters -> bouwModel -> valideerModel (repareren of verwerpen) -> modelNaarGeometrie -> dom tekenen.

Het gebouwmodel (src/kern/) kent deze elementen en relaties:
- Bouwvolumes: rechthoekige voetafdruk plus dakdefinitie (vorm, hellingshoek, nokrichting en -verschuiving, dakdikte, overstek per rand). Meerdere volumes vormen samengestelde massa's.
- Dakvlakken: per volume afgeleid als vlakken met dikte, hellingshoek en overstek. Overstek is een eigenschap van het dakvlak, bescheiden (default 300 tot 600 mm), nooit een los uitstekend blok.
- Wanden per gevel: afgeleid uit voetafdruk plus dakvlakken. De bovenrand van een wand IS de onderzijde van het dakpakket, per definitie, dus een wand kan nooit boven of onder het dak uitkomen.
- Sparingen: kozijnen, puien en deuren zijn openingen IN een gastwand (host-relatie), met een vulling (kozijnprofiel, stramien, glas met negge). Ze worden als echte boolean-operatie uit de wand gesneden (three-bvh-csg), niet als vlak ervoor geplakt.
- Bekleding: gegenereerd OP een wandvlak en automatisch uitgespaard rond de sparingen van die wand.
- Gevel-elementen: lamellenvelden, penanten, kaders, panelen en balkons horen bij een gastvlak en worden daar exact op geclipt.
- Randafwerking: nokvorst, windveren, boeidelen, goten en (bij kruisende kappen) een kilkeper worden automatisch langs de dakranden gegenereerd, zodat elke dakrand per constructie gesloten is.

Harde regel voor de IFC-referentie (referenties/ifc/): daaruit komen uitsluitend DETAILPRINCIPES (hoe een dakrand, nok, negge of materiaalkeuze eruitziet), nooit vormbeperkingen, maatgrenzen of typologiekeuzes. Het is een gerealiseerd voorbeeld uit honderden mogelijke varianten; vormen komen uit de kennisbank en de fotoreferenties. De maximale vrije overspanning is 12 m (door STAEL bevestigd als grens van het portaalsysteem), met 6 tot 9 m als comfortabele default-range voor gegenereerde varianten.

De kopgevel is een eigen elementtype: een wand waarvan de vorm de volledige dakcontour volgt (driehoek, of vijfhoek bij een verschoven nok, inclusief dakdikte-aftrek). Alle elementen in die gevel (pui, kader, lamellenveld, penanten, balkon) hebben de kopgevel als gastvlak en worden tegen die contour gevalideerd en geclipt. Dit is de gevel waar tot nu toe de meeste fouten zaten en verdient daarom een eigen, expliciet behandeld geval.

Determinisme is een harde eis: elk model is volledig reproduceerbaar uit zijn parameterset plus seed. Dezelfde invoer geeft exact hetzelfde huis, altijd, zodat de kalibratiepresets en opgeslagen klantontwerpen betrouwbare regressietests zijn. In de kern staat geen enkele Math.random zonder seed.

Modelvalidatie draait VOORDAT er geometrie bestaat: sparingen overlappen elkaar niet en liggen volledig binnen hun gastwand; bekleding nooit over een sparing; elk gevel-element binnen zijn gastvlak of exact geclipt; alle dakranden gesloten; geen element dat een dakvlak doorsnijdt. Een model dat faalt wordt gerepareerd of verworpen; de renderer tekent alleen nog wat het model zegt en rekent zelf niets meer uit.

Migratie, naast de oude kern, typologie voor typologie:
1. Simpelste geval: rechthoekige schuurwoning, zadeldak, een pui in de kopgevel, raamstroken in de langsgevels.
2. Gevel-elementen: kader, penanten, lamellenveld, panelen, plint, balkon.
3. Samengestelde massa's: kop-en-staart, dwarskap met kilkeper, asymmetrische kap, veranda en portaal en zijluifel als dakvlak-verlengingen, geschakelde aanbouw.
4. Platte volumes en de stapelmassa (glasbanden, dakopbouw, pergola, balustrade).
5. Alle 13 kalibratiepresets over op de nieuwe kern; de kalibratiepagina is de regressietest, en de klantgenerator schakelt om.
6. Pas daarna wordt de oude meshcode verwijderd.

Voortgang wordt per typologie gemeld. Visuele franje wacht: correcte aansluitingen eerst, mooi maken is fase 2.

De kwaliteitslat, door STAEL vastgesteld: de 3D-kern legt de VORM vast en moet daarin correct en compleet zijn (massa's, dakvormen, plaats van ramen, deuren, entree, garage en balkon, alles maatvast, bereikbaar en bouwkundig kloppend volgens de wetten: gesloten schil, element-afheid, logische einden, functionele elementen). De kern hoeft niet verkoop-mooi te zijn; detailperfectie voorbij "correct" wordt er niet meer in gebouwd. Het mooi maken gebeurt in twee lagen: fase 2 (materialen en licht) brengt het draaibare model op archviz-preview-niveau, en fase 4 (AI-fotostand) levert de verleidelijke beelden per gekozen camerastandpunt. Nieuwe kern-issues tellen alleen nog als ze de wetten schenden.

### 2.8 Later: richting BIM

Omdat het ontwerp een parameterset is, kan er een exporter bij die IFC (of eerst een eenvoudiger tussenformaat) genereert voor de BIM-workflow van EG Assembly (Solibri-controle). Dit staat bewust achteraan; het beïnvloedt nu alleen de keuze om alles parametrisch en gestructureerd op te slaan.

## 3. Gefaseerd bouwplan

Elke fase levert iets werkends op dat aan klanten te laten zien is.

### Fase 0: fundament (klein)
- Aparte app-structuur (Vite + React + react-three-fiber) in de architect-map van de repo, ingericht voor uitrol op Vercel.
- Api-map aangelegd als plek voor het Railway-servicetje van fase 3 (nog leeg op een leeswijzer na).
- Programma-invoer (stap 1) en de JSON-ontwerpstate.
- Demonstreerbaar: de basis waar alles op stapelt, met nette invoer en een eerste model.

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
- Bouw van de Node-API op Railway (in de api-map): ontwerp opslaan/laden via deelbaar token, opmerkingen toevoegen/afvinken, e-mail vangen bij opslaan. Railway Postgres erachter; de browser praat alleen met de API.
- Deelbare link per ontwerp via het token in de URL.
- Pins prikken op onderdelen, opmerkingenlijst met status open/verwerkt.
- "Plan een Live Architect-sessie" gekoppeld aan een echte agenda.
- Demonstreerbaar: klant ontwerpt thuis, prikt opmerkingen, stuurt de link; STÆL opent hetzelfde ontwerp en ziet alles. De sessie kan vanaf hier al echt plaatsvinden (met schermdelen).

### Fase 4: de fotostand
- AI-renderlaag: per variant en camerahoek een fotorealistisch beeld, gestuurd door het 3D-model. Kwaliteit gaat boven kosten; voorkeur voor de beeldgeneratie van OpenAI (gpt-image), met zo nodig een kwaliteitsvergelijking tussen een paar aanbieders waarna de beste wint.
- Renderproxy als endpoint op de Railway-API (sleutels nooit in de browser), met een maandelijks kostenrapportje; geen krappe limiet die de kwaliteit drukt.
- Bewaking dat er geen AI-tekstfouten in beeld komen (geen verzonnen opschriften of naambordjes).
- Experiment AI-turntable: een automatische ring van circa 12 gezichtspunten rond de woning waar de klant doorheen draait als rondkijk-ervaring; het onderzoekspunt is de consistentie tussen de beelden.
- Demonstreerbaar: knop "maak er een foto van" naast het interactieve model.

### Fase 5: echt samen kijken
- Realtime sessiemodus via websockets op de Railway-API: klant en STÆL in hetzelfde model, presenter-rol, live aanpassen.
- Demonstreerbaar: de volwaardige Live Architect-sessie zonder schermdelen.

### Fase 6 (later): BIM-brug
- Export van de parameterset richting IFC/SketchUp voor de workflow van EG Assembly.

## 4. Besluiten en openstaande punten

Besluiten (akkoord van STÆL):

Techniek en geld:
- Hosting: de app op Vercel; de statische site blijft voorlopig op GitHub Pages.
- Opslag: Railway (Postgres plus eigen Node-API), zie 2.4 inclusief de afweging.
- AI-renders: kwaliteit gaat boven kosten; dit zijn woningen van een half miljoen, de beelden moeten top zijn. Voorkeur voor OpenAI (gpt-image); in fase 4 desnoods een kwaliteitsvergelijking tussen aanbieders. Wel maandelijks kosteninzicht, geen krappe limiet.
- Domein: stael.nl is bezet, het wordt waarschijnlijk staelhome.nl (app: architect.staelhome.nl, e-mail: info@staelhome.nl).

Product en kwaliteit:
- Doelniveau fase 2: goede SketchUp/Enscape-previewkwaliteit; de AI-fotostand komt daarbovenop.
- AI-sfeerbeelden zijn acceptabel als impressie zolang het interactieve model de waarheid is en er nergens AI-tekstfouten in beeld komen.
- Materialen en kleuren worden heel uitgebreid, opgebouwd met web-research: houtsoorten en -kleuren, felsdaken in meerdere metalen en kleuren, corten, zink, koper, steensoorten, stucwerk en meer, met per materiaal een ruim kleurenpalet. Gefaseerd opbouwen, maar vanaf het begin ontworpen voor die breedte.
- Vaste STÆL-regel: kozijnen altijd slank en donker (antraciet of zwart).
- Bestemmingsplan-grenzen (goothoogte, nokhoogte, dakhelling) instelbaar per kavel, met gangbare defaults.

Klanten en proces:
- Klanten werken zonder account via een deelbare link; bij het opslaan wordt wel een e-mailadres gevraagd (opvolging is commercieel belangrijk).
- Opmerkingen behandelt STÆL zelf; een lijst per ontwerp volstaat, een dashboard komt later.
- Apparaten: desktop en tablet vlekkeloos, telefoon goed bruikbaar (klanten openen de deellink op hun telefoon). Showroom met touch is leuk voor later, geen eis.
- Alleen Nederlands voor nu.
- Fasevolgorde blijft zoals in dit plan: eerst het model op niveau, dan pas de foto.

Ontwerptaal en inspiratie:
- Startpunt van de ontwerptaal: de eigen referentiebeelden in assets/ (huis1 t/m huis6 en render.jpg). Dat is exact de STÆL-smaak: schuurwoningen en langhuizen in de Nederlandse polder, fels- en koperdaken, hout, dubbelhoge glasgevels.
- Nadrukkelijk niet: Amerikaanse villa-uitstraling, natuursteen-stapelwanden, bergachtergronden, en generieke witte nieuwbouwdozen.
- Typologieën die er zeker in moeten: barnhouse/schuurwoning, langhuis, loftwoning met portaalconstructie. Plat paviljoen mag erbij als vierde.
- Kennisbank per kwartaal verversen met nieuwe web-research; nieuwe presets keurt STÆL eerst zelf goed voordat klanten ze zien.

Nog open:
- Welke agenda voor het plannen van sessies (Cal.com, Calendly, of iets bestaands van EG Assembly of New Way)? Nodig uiterlijk in fase 3.
- Is er een demo-moment of deadline waar de fasering rekening mee moet houden?
