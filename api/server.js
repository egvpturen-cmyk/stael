// Live Architect API (klantreis onderdeel A): sessie-object met
// deel-token plus het Realtime-tokenendpoint met kostenrem. De browser
// praat alleen met deze API; de OpenAI-sleutel verlaat de server nooit.
//
// Omgevingsvariabelen (Railway):
//   DATABASE_URL            Postgres (zonder: bestandsstore, alleen dev)
//   OPENAI_API_KEY          voor het Realtime-sessietoken
//   STEM_MAX_SESSIE_MIN     maximale gespreksduur per sessie (default 20)
//   STEM_DAG_PLAFOND_MIN    dagplafond over alle sessies (default 60)
//   STEM_MODEL              Realtime-model (default gpt-realtime)
//   STEM_STEM               stemnaam (default ash)
//   STEM_HARTSLAG_VERLOOP_MS na deze stilte geldt een verbinding als
//                           weggevallen en rekent hij af (default 180000)
//   CORS_ORIGINS            kommagescheiden origins (default *)
//   STEM_TEST_MODUS         1 = dummy-token zonder OpenAI-call (tests)
import express from 'express'
import cors from 'cors'
import crypto from 'crypto'
import { maakOpslag } from './opslag.js'
import { PERSOONLIJKHEID, FUNCTIES } from './persoonlijkheid.js'
import { collectieContext } from './collectie.js'

const SYSTEEM = PERSOONLIJKHEID + '\n\n' + collectieContext()

// De actuele sessiestand gaat als context mee in elke systeemprompt
// (tekst en spraak), zodat de Architect na hervatten altijd verder
// gaat waar de klant was en nooit opnieuw kennismaakt.
function sessieContext(sessie) {
  if (!sessie) return ''
  const r = ['', '', 'SESSIECONTEXT (actuele stand uit de app; dit is al gebeurd):', 'huidige stap: ' + sessie.stap]
  const smaak = sessie.smaak || {}
  if (smaak.favorieten?.length) {
    r.push('favorieten (collectienummers): ' + smaak.favorieten.join(', '))
    if (Object.keys(smaak.families || {}).length) r.push('familietelling: ' + JSON.stringify(smaak.families))
    if (smaak.materialen?.length) r.push('genoemde materialen: ' + smaak.materialen.join(', '))
    if (smaak.elementen?.length) r.push('genoemde elementen: ' + smaak.elementen.join(', '))
    if (smaak.citaten?.length) r.push('citaten van de klant: ' + smaak.citaten.map(c => '"' + c + '"').join(' | '))
  }
  if (sessie.kavel) {
    r.push('kavel: ' + (sessie.kavel.adres || 'zonder adres') + ', ' + sessie.kavel.oppervlakte + ' m2 ('
      + (sessie.kavel.herkomst || 'kadastraal') + (sessie.kavel.perceelnummer ? ', perceel ' + sessie.kavel.sectie + ' ' + sessie.kavel.perceelnummer : '') + ')')
  }
  if (sessie.programma) r.push('programma van eisen: ' + JSON.stringify(sessie.programma))
  r.push('Is de huidige stap groter dan 0, dan is de kennismaking al geweest: stel jezelf NIET opnieuw voor, '
    + 'leg de stappen niet opnieuw uit en ga direct verder bij de huidige stap en de vastgelegde stand hierboven.')
  return r.join('\n')
}

const app = express()
const opslag = await maakOpslag()

const origins = (process.env.CORS_ORIGINS || '*').split(',').map(s => s.trim())
app.use(cors({ origin: origins.includes('*') ? true : origins }))
app.use(express.json({ limit: '1mb' }))

const MAX_SESSIE_MIN = parseInt(process.env.STEM_MAX_SESSIE_MIN || '20', 10)
const DAG_PLAFOND_MIN = parseInt(process.env.STEM_DAG_PLAFOND_MIN || '60', 10)

const nieuwToken = () => crypto.randomBytes(9).toString('base64url')

// velden van het sessie-object die de client mag bijwerken; de state
// is leidend en er komt nooit audio in de opslag terecht
const TOEGESTANE_VELDEN = ['stap', 'smaak', 'notities', 'kavel', 'programma', 'model', 'renders', 'spraakOk']

function verseSessie() {
  const nu = new Date().toISOString()
  return {
    versie: 1,
    stap: 0,
    spraakOk: null,
    smaak: { favorieten: [], families: {}, materialen: [], elementen: [], citaten: [] },
    notities: [],
    kavel: null,
    programma: null,
    model: null,
    renders: [],
    gemaakt: nu,
    bijgewerkt: nu,
  }
}

app.get('/gezond', (req, res) => {
  res.json({ ok: true, opslag: opslag.soort })
})

app.post('/api/sessies', async (req, res) => {
  const token = nieuwToken()
  const sessie = verseSessie()
  await opslag.sessieMaak(token, sessie)
  res.status(201).json({ token, sessie })
})

app.get('/api/sessies/:token', async (req, res) => {
  const sessie = await opslag.sessieLees(req.params.token)
  if (!sessie) return res.status(404).json({ fout: 'onbekende sessie' })
  res.json({ token: req.params.token, sessie })
})

app.patch('/api/sessies/:token', async (req, res) => {
  const sessie = await opslag.sessieLees(req.params.token)
  if (!sessie) return res.status(404).json({ fout: 'onbekende sessie' })
  const updates = req.body || {}
  const geweigerd = Object.keys(updates).filter(k => !TOEGESTANE_VELDEN.includes(k))
  if (geweigerd.length) return res.status(400).json({ fout: 'veld niet toegestaan', velden: geweigerd })
  if ('stap' in updates && !(Number.isInteger(updates.stap) && updates.stap >= 0 && updates.stap <= 4)) {
    return res.status(400).json({ fout: 'stap moet 0 tot 4 zijn' })
  }
  Object.assign(sessie, updates)
  sessie.bijgewerkt = new Date().toISOString()
  await opslag.sessieSchrijf(req.params.token, sessie)
  res.json({ token: req.params.token, sessie })
})

// kortlevend Realtime-sessietoken met kostenrem: de maximale duur wordt
// bij uitgifte gereserveerd tegen het dagplafond (veilig: nooit meer
// uitgeven dan het plafond, ook als een gesprek korter duurt)
app.post('/api/stem/sessie', async (req, res) => {
  const sessieToken = req.body?.sessieToken
  const sessieStand = sessieToken ? await opslag.sessieLees(sessieToken) : null
  if (!sessieStand) {
    return res.status(404).json({ fout: 'onbekende sessie' })
  }
  // eerlijke telling: afgerekend verbruik plus actieve reserveringen
  // (verlopen verbindingen zijn dan al via de hartslag afgerekend)
  const gereserveerd = await opslag.ruimOpEnReserveerd()
  const verbruikt = await opslag.verbruikVandaag()
  if (verbruikt + gereserveerd + MAX_SESSIE_MIN > DAG_PLAFOND_MIN) {
    return res.status(429).json({
      fout: 'dagplafond bereikt', verbruiktMin: verbruikt, gereserveerdMin: gereserveerd,
      plafondMin: DAG_PLAFOND_MIN, advies: 'schakel over op tekst',
    })
  }
  const model = process.env.STEM_MODEL || 'gpt-realtime'
  const stem = process.env.STEM_STEM || 'ash'

  if (process.env.STEM_TEST_MODUS === '1') {
    const { id } = await opslag.uitgifteMaak({ sessieToken, gereserveerdMin: MAX_SESSIE_MIN })
    return res.json({
      clientSecret: 'test-' + nieuwToken(), verlooptOm: null, uitgifteId: id,
      maxMinuten: MAX_SESSIE_MIN, model, stem, testModus: true,
    })
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ fout: 'stem niet beschikbaar (geen sleutel)', advies: 'schakel over op tekst' })
  }
  try {
    // nieuwe interface eerst (client_secrets), oudere als terugval
    let antwoord = await fetch('https://api.openai.com/v1/realtime/client_secrets', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        expires_after: { anchor: 'created_at', seconds: 600 },
        // de sessie wordt hier volledig geconfigureerd, zodat de
        // Architect zijn persoonlijkheid en functies altijd heeft,
        // ook als een session.update in de browser zou mislukken
        session: {
          type: 'realtime', model,
          instructions: SYSTEEM + sessieContext(sessieStand),
          tools: FUNCTIES.map(f => ({ type: 'function', ...f })),
          // antwoorden komen altijd gesproken (met ondertiteling), ook
          // op een getypte beurt binnen de spraaksessie
          output_modalities: ['audio'],
          audio: {
            input: { transcription: { model: 'whisper-1' } },
            output: { voice: stem },
          },
        },
      }),
    })
    let data = await antwoord.json()
    let secret = data?.value || data?.client_secret?.value
    if (!antwoord.ok || !secret) {
      antwoord = await fetch('https://api.openai.com/v1/realtime/sessions', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, voice: stem }),
      })
      data = await antwoord.json()
      secret = data?.client_secret?.value
    }
    if (!secret) {
      return res.status(502).json({ fout: 'kon geen sessietoken maken', detail: data?.error?.message || null })
    }
    const { id } = await opslag.uitgifteMaak({ sessieToken, gereserveerdMin: MAX_SESSIE_MIN })
    res.json({
      clientSecret: secret, uitgifteId: id,
      verlooptOm: data?.expires_at || data?.client_secret?.expires_at || null,
      maxMinuten: MAX_SESSIE_MIN, model, stem,
    })
  } catch (e) {
    res.status(502).json({ fout: 'stemdienst onbereikbaar', detail: String(e.message || e) })
  }
})

// hartslag: de client meldt periodiek dat de verbinding nog leeft; een
// weggevallen verbinding verloopt zo vanzelf op de laatste hartslag
app.post('/api/stem/hartslag', async (req, res) => {
  const ok = req.body?.uitgifteId ? await opslag.uitgifteHartslag(req.body.uitgifteId) : false
  if (!ok) return res.status(404).json({ fout: 'onbekende uitgifte' })
  res.json({ ok: true })
})

// einde: afrekenen op de werkelijke duur; het restant van de
// reservering gaat terug naar het dagplafond
app.post('/api/stem/einde', async (req, res) => {
  const uit = req.body?.uitgifteId ? await opslag.uitgifteEinde(req.body.uitgifteId) : null
  if (!uit) return res.status(404).json({ fout: 'onbekende uitgifte' })
  res.json({ ok: true, verbruiktMin: uit.verbruiktMin })
})

// de stand van de kostenrem, simpel afleesbaar
app.get('/api/stem/stand', async (req, res) => {
  const gereserveerd = await opslag.ruimOpEnReserveerd()
  const verbruikt = await opslag.verbruikVandaag()
  const uitgiften = await opslag.uitgiftenVandaag()
  res.json({
    verbruiktVandaagMin: verbruikt,
    gereserveerdNuMin: gereserveerd,
    plafondMin: DAG_PLAFOND_MIN,
    uitgiftenVandaag: uitgiften.length,
    uitgiften: uitgiften.map(u => ({
      startOm: u.startOm, gereserveerdMin: u.gereserveerdMin,
      verbruiktMin: u.verbruiktMin, actief: u.verbruiktMin == null,
    })),
  })
})

// tekstkanaal: hetzelfde gesprek als de stem, via chat completions.
// De server bepaalt systeemprompt en functies; de client levert alleen
// de gespreksgeschiedenis (user, assistant, tool) aan
app.post('/api/stem/tekst', async (req, res) => {
  const { sessieToken, berichten } = req.body || {}
  const sessieStand = sessieToken ? await opslag.sessieLees(sessieToken) : null
  if (!sessieStand) {
    return res.status(404).json({ fout: 'onbekende sessie' })
  }
  if (!Array.isArray(berichten) || berichten.length === 0 || berichten.length > 120) {
    return res.status(400).json({ fout: 'berichten ontbreken of te veel' })
  }
  if (berichten.some(b => !['user', 'assistant', 'tool'].includes(b.role))) {
    return res.status(400).json({ fout: 'alleen user, assistant en tool zijn toegestaan' })
  }
  const systeem = SYSTEEM + sessieContext(sessieStand)
  if (process.env.STEM_TEST_MODUS === '1') {
    // de tests verifieren zo dat de sessiecontext echt meegaat
    return res.json({ tekst: 'testmodus: gebruik de scripted adapter', functieAanroepen: [], testModus: true, systeem })
  }
  if (!process.env.OPENAI_API_KEY) {
    return res.status(503).json({ fout: 'architect niet beschikbaar (geen sleutel)' })
  }
  try {
    const antwoord = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.OPENAI_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: process.env.STEM_TEKST_MODEL || 'gpt-4.1-mini',
        max_tokens: 500,
        messages: [{ role: 'system', content: systeem }, ...berichten],
        tools: FUNCTIES.map(f => ({ type: 'function', function: f })),
      }),
    })
    const data = await antwoord.json()
    if (!antwoord.ok) {
      return res.status(502).json({ fout: 'architect antwoordde niet', detail: data?.error?.message || null })
    }
    const keuze = data.choices?.[0]?.message || {}
    res.json({
      tekst: keuze.content || '',
      functieAanroepen: (keuze.tool_calls || []).map(tc => ({
        id: tc.id, naam: tc.function?.name,
        args: (() => { try { return JSON.parse(tc.function?.arguments || '{}') } catch { return {} } })(),
      })),
      ruw: { role: keuze.role, content: keuze.content, tool_calls: keuze.tool_calls || undefined },
    })
  } catch (e) {
    res.status(502).json({ fout: 'architect onbereikbaar', detail: String(e.message || e) })
  }
})

const poort = process.env.PORT || 8787
app.listen(poort, () => console.log('Live Architect API op poort', poort, '| opslag:', opslag.soort,
  '| rem:', MAX_SESSIE_MIN, 'min per sessie,', DAG_PLAFOND_MIN, 'min per dag'))
