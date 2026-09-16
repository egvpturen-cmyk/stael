# Werkregels STÆL project

## Controleren na elke wijziging (verplicht)
Na elke aanpassing aan de site controleer je zelf het resultaat vóór je commit, op zowel desktop als mobiel:
1. Start een lokale server (npx serve of python -m http.server).
2. Controleer met Playwright (installeer indien nodig) minimaal twee viewports: desktop 1440x900 en mobiel 390x844 (en bij layoutwijzigingen ook 768x1024).
3. Maak per viewport een screenshot van de gewijzigde sectie en bekijk die: klopt de layout, is niets afgesneden, overlapt er niets?
4. Check de browserconsole op errors; die moeten leeg zijn.
5. Test animaties door screenshots op meerdere momenten te nemen (begin, midden, eind).
6. Pas gevonden problemen direct aan en controleer opnieuw. Pas als beide viewports goed zijn: commit en push.

## Overige regels
- Commit en push na elke werkende, gecontroleerde verbetering (kleine commits).
- Geen em-dashes in UI-teksten en documenten. Geen vet middenin zinnen.
- Animaties rustig houden; prefers-reduced-motion altijd respecteren.
- Merkregels en kleuren staan in PLAN.md; wijk daar niet van af.
- Bij twijfel over een ontwerpkeuze: vraag het, verzin het niet.
