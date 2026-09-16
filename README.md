# STÆL — website + Live Architect

Statische site (index.html + assets/) van STÆL, Architectural Steel Homes. Zie PLAN.md voor merkregels, status en de Live Architect-specificatie.

## Lokaal bekijken
Open index.html in de browser, of draai een mini-server:
`npx serve .` (of `python -m http.server`)

## Live zetten via GitHub Pages
1. Nieuwe repo aanmaken op github.com (bijv. `stael`), deze map pushen.
2. Repo -> Settings -> Pages -> Source: "Deploy from a branch" -> Branch: `main`, map `/ (root)` -> Save.
3. Na 1-2 minuten staat de site op `https://<gebruikersnaam>.github.io/stael/`

Alles is statisch (geen build stap nodig). Three.js en Google Fonts laden via CDN.

## Startprompt voor Claude Code
"Lees PLAN.md. Init git, maak een GitHub-repo 'stael' met gh, push alles en zet GitHub Pages aan op main/root. Geef me daarna de live URL. Daarna beginnen we aan Live Architect prioriteit 1 uit PLAN.md."
