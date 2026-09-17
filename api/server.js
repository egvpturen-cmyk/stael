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
//   STEM_STEM               stemnaam (default marin)
//   CORS_ORIGINS            kommagescheiden origins (default *)
//   STEM_TEST_MODUS         1 = dummy-token zonder OpenAI-call (tests)
import express from 'express'
import cors from 'cors'
import crypto from 'crypto'
import { maakOpslag } from './opslag.js'
import { PERSOONLIJKHEID, FUNCTIES } from './persoonlijkheid.js'
import { collectieContext } from './collectie.js'

const SYSTEEM = PERSOONLIJKHEID + '\n\n' + collectieContext()

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
  if (!sessieToken || !(await opslag.sessieLees(sessieToken))) {
    return res.status(404).json({ fout: 'onbekende sessie' })
  }
  const verbruikt = await opslag.verbruikVandaag()
  if (verbruikt + MAX_SESSIE_MIN > DAG_PLAFOND_MIN) {
    return res.status(429).json({
      fout: 'dagplafond bereikt', verbruiktMin: verbruikt, plafondMin: DAG_PLAFOND_MIN,
      advies: 'schakel over op tekst',
    })
  }
  const model = process.env.STEM_MODEL || 'gpt-realtime'
  const stem = process.env.STEM_STEM || 'marin'

  if (process.env.STEM_TEST_MODUS === '1') {
    await opslag.verbruikTel(MAX_SESSIE_MIN)
    return res.json({
      clientSecret: 'test-' + nieuwToken(), verlooptOm: null,
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
        session: { type: 'realtime', model, audio: { output: { voice: stem } } },
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
    await opslag.verbruikTel(MAX_SESSIE_MIN)
    res.json({
      clientSecret: secret,
      verlooptOm: data?.expires_at || data?.client_secret?.expires_at || null,
      maxMinuten: MAX_SESSIE_MIN, model, stem,
    })
  } catch (e) {
    res.status(502).json({ fout: 'stemdienst onbereikbaar', detail: String(e.message || e) })
  }
})

// tekstkanaal: hetzelfde gesprek als de stem, via chat completions.
// De server bepaalt systeemprompt en functies; de client levert alleen
// de gespreksgeschiedenis (user, assistant, tool) aan
app.post('/api/stem/tekst', async (req, res) => {
  const { sessieToken, berichten } = req.body || {}
  if (!sessieToken || !(await opslag.sessieLees(sessieToken))) {
    return res.status(404).json({ fout: 'onbekende sessie' })
  }
  if (!Array.isArray(berichten) || berichten.length === 0 || berichten.length > 120) {
    return res.status(400).json({ fout: 'berichten ontbreken of te veel' })
  }
  if (berichten.some(b => !['user', 'assistant', 'tool'].includes(b.role))) {
    return res.status(400).json({ fout: 'alleen user, assistant en tool zijn toegestaan' })
  }
  if (process.env.STEM_TEST_MODUS === '1') {
    return res.json({ tekst: 'testmodus: gebruik de scripted adapter', functieAanroepen: [], testModus: true })
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
        messages: [{ role: 'system', content: SYSTEEM }, ...berichten],
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
