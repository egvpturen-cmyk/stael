# Werkregels STÆL project

## Controleren na elke wijziging (verplicht)
Na elke aanpassing aan de site controleer je zelf het resultaat vóór je commit, op zowel desktop als mobiel:
1. Start een lokale server (npx serve of python -m http.server).
2. Controleer met Playwright (installeer indien nodig) minimaal twee viewports: desktop 1440x900 en mobiel 390x844 (en bij layoutwijzigingen ook 768x1024).
3. Maak per viewport een screenshot van de gewijzigde sectie en bekijk die: klopt de layout, is niets afgesneden, overlapt er niets?
4. Check de browserconsole op errors; die moeten leeg zijn.
5. Test animaties door screenshots op meerdere momenten te nemen (begin, midden, eind).
6. Pas gevonden problemen direct aan en controleer opnieuw. Pas als beide viewports goed zijn: commit en push.

## Zelfkeuring als bouwer (verplicht vóór elke oplevering)
Screenshots maken is niet genoeg; je beoordeelt ze zelf als bouwkundig keurmeester voordat je iets aan mij oplevert. Concreet:
1. Bekijk elk opgeleverd zicht en stel per beeld expliciet de vraag: "kan dit in echte bouw bestaan?" Gaten in een gevel, zwevende elementen, elementen die elkaar doorsnijden, randen die niet sluiten, kunnen NIET bestaan en zijn dus altijd een fout, ook als alle geautomatiseerde checks groen zijn.
2. Een groene validator naast een zichtbaar gebrek betekent dat de VALIDATOR kapot is; dat is dan bevinding nummer 1 en die fix je eerst.
3. Bekijk beelden ook vanuit ongeplande hoeken: draai de camera naar minimaal twee extra willekeurige standpunten per object, juist schuin en van dichtbij, want fouten verstoppen zich buiten de standaardzichten.
4. Schrijf bij elke oplevering een eigen keuringsrapportje: wat je hebt bekeken, wat je zelf hebt afgekeurd en gefixt vóór oplevering, en wat je twijfelgevallen zijn. Lever twijfelgevallen expliciet aan mij aan in plaats van ze stilzwijgend goed te keuren.
5. De lat: ik hoor geen fouten meer te vinden die op de opgeleverde screenshots zelf zichtbaar zijn. Vind ik die wel, dan is niet alleen de fout maar ook de zelfkeuring mislukt.

## Overige regels
- Commit en push na elke werkende, gecontroleerde verbetering (kleine commits).
- Geen em-dashes in UI-teksten en documenten. Geen vet middenin zinnen.
- Animaties rustig houden; prefers-reduced-motion altijd respecteren.
- Merkregels en kleuren staan in PLAN.md; wijk daar niet van af.
- Bij twijfel over een ontwerpkeuze: vraag het, verzin het niet.
