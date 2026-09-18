// Gesprekstest stap 0 (ontvangst): een scripted dialoog via de
// testinvulling van de adapter controleert de function calls en de
// state-overgangen tegen een echte (lokale) API, zonder audio en zonder
// API-kosten. Controleert ook dat de persoonlijkheid van server en app
// exact gelijk zijn.
import { spawn } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { fileURLToPath } from 'url'

const POORT = 18788
process.env.API_BASIS = 'http://127.0.0.1:' + POORT
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'stael-gesprek-'))
const hier = path.dirname(fileURLToPath(import.meta.url))
const apiMap = path.resolve(hier, '../../api')

const server = spawn(process.execPath, ['server.js'], {
  cwd: apiMap,
  env: { ...process.env, PORT: String(POORT), OPSLAG_PAD: tmp, STEM_TEST_MODUS: '1', DATABASE_URL: '', OPENAI_API_KEY: '' },
  stdio: 'ignore',
})

let fouten = 0
const eis = (naam, conditie, detail) => {
  if (conditie) console.log('ok  |', naam)
  else { fouten++; console.log('FOUT|', naam, detail ?? '') }
}

for (let i = 0; i < 60; i++) {
  try { const r = await fetch(process.env.API_BASIS + '/gezond'); if (r.ok) break } catch { /* wacht */ }
  await new Promise(r => setTimeout(r, 250))
}

try {
  // persoonlijkheid van app en server moeten exact gelijk zijn
  const appP = await import('../src/reis/persoonlijkheid.js')
  const apiP = await import('file://' + path.join(apiMap, 'persoonlijkheid.js').replace(/\\/g, '/'))
  eis('persoonlijkheid app en server identiek',
    appP.PERSOONLIJKHEID === apiP.PERSOONLIJKHEID
    && JSON.stringify(appP.FUNCTIES) === JSON.stringify(apiP.FUNCTIES)
    && appP.WELKOMSTTEKST === apiP.WELKOMSTTEKST)

  // de entree: exact een welkomsttekst als verplichte eerste beurt,
  // geen kanaalvraag, en stap 1 pas na een bevestigend antwoord
  const P = appP.PERSOONLIJKHEID.replace(/\s+/g, ' ')
  eis('de exacte welkomsttekst is de verplichte eerste beurt',
    appP.WELKOMSTTEKST.startsWith('Welkom, ik ben de architect van STAEL.')
    && appP.WELKOMSTTEKST.endsWith('Bent u er klaar voor om met de smaak te beginnen?')
    && P.includes(appP.WELKOMSTTEKST)
    && P.includes('woord voor woord'))
  eis('de kanaalvraag praten of typen bestaat niet meer',
    !P.includes('praten of') && !P.includes('typt u liever')
    && P.includes('vraagt er nooit naar'))
  eis('stap 1 opent volgens de regels pas na een bevestigend antwoord',
    P.includes('PAS na een bevestigend antwoord') && P.includes('eerder nooit'))

  const { sessieMaak, sessieLees } = await import('../src/reis/api.js')
  const { maakFuncties } = await import('../src/reis/functies.js')
  const { maakTestAdapter } = await import('../src/reis/adapter.js')

  const { token, sessie } = await sessieMaak()
  const sessieRef = { huidige: sessie }
  const signalen = []
  const functies = maakFuncties({ token, sessieRef, opUiSignaal: (n, d) => signalen.push(n) })

  // spraak lukt niet (het vangnet): de app legt de voorkeur vast en
  // de exacte welkomsttekst verschijnt als tekstbericht
  await functies.voerUit('spraakVoorkeur', { spraak: false })

  const ondertitels = []
  const adapter = maakTestAdapter({
    script: [
      [{ zeg: appP.WELKOMSTTEKST }],
      [
        { functie: { naam: 'stapAfronden', args: { stap: 0 } } },
        { functie: { naam: 'naarStap', args: { stap: 1 } } },
        { zeg: 'Mooi, dan beginnen we met uw smaak.' },
      ],
    ],
  })
  adapter.onTranscript = (rol, tekst) => { if (rol === 'architect') ondertitels.push(tekst) }
  adapter.onFunctionCall = (naam, args) => functies.voerUit(naam, args)
  await adapter.start()

  await adapter.zegTekst('hallo')
  eis('de allereerste beurt is exact de welkomsttekst, volledig',
    ondertitels.length === 1 && ondertitels[0] === appP.WELKOMSTTEKST)
  eis('tijdens het welkom blijft de reis op stap 0 (de show wacht op de opkomst)',
    sessieRef.huidige.stap === 0)

  await adapter.zegTekst('ja, ik ben er klaar voor')
  eis('spraakvoorkeur staat vastgelegd als tekst', sessieRef.huidige.spraakOk === false)
  eis('pas na de bevestiging staat de reis op stap 1', sessieRef.huidige.stap === 1)
  eis('ui-signalen kwamen door (voorkeur, afronden, stap)',
    signalen.includes('spraakVoorkeur') && signalen.includes('stapAfgerond') && signalen.includes('stap'))

  // de state is leidend: ook op de server staat alles goed
  const { sessie: vers } = await sessieLees(token)
  eis('de server-state bevestigt spraakOk en stap', vers.spraakOk === false && vers.stap === 1)

  // foutpaden van het skelet
  eis('naarStap buiten bereik wordt geweigerd', (await functies.voerUit('naarStap', { stap: 9 })).ok === false)
  eis('stapAfronden op een andere stap wordt geweigerd', (await functies.voerUit('stapAfronden', { stap: 3 })).ok === false)
  eis('favoriet buiten de collectie wordt geweigerd', (await functies.voerUit('favorietKiezen', { nummer: 99, aan: true })).ok === false)
  eis('parameterWijzigen weigert eerlijk zonder gekozen variant',
    (await functies.voerUit('parameterWijzigen', { pad: 'volume.goot', waarde: 2.6 })).fout.includes('variant'))
  eis('onbekende functie geeft een nette fout', (await functies.voerUit('bestaatNiet', {})).ok === false)
} finally {
  console.log(fouten ? 'FAAL: ' + fouten + ' checks rood' : 'gesprekstest 0 groen')
  fs.rmSync(tmp, { recursive: true, force: true })
  process.exitCode = fouten ? 1 : 0
  server.kill()
}
