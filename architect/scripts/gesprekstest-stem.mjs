// Gesprekstest gespreksbewaking (spraakkanaal): er loopt nooit meer
// dan een response-generatie tegelijk, meerdere function calls in een
// beurt leveren precies een vervolgantwoord, een nieuwe beurt
// onderbreekt de lopende generatie netjes, en een dubbel binnengekomen
// identieke klantbeurt landt precies een keer. Draait op de
// eventverwerker met nagespeelde Realtime-events, zonder audio en
// zonder API-kosten.
import {
  maakResponseManager, maakEventVerwerker, isDubbeleBeurt,
  stuurTekstBeurt, maakTekstAdapter,
} from '../src/reis/adapter.js'

let fouten = 0
const eis = (naam, conditie, detail) => {
  if (conditie) console.log('ok  |', naam)
  else { fouten++; console.log('FOUT|', naam, detail ?? '') }
}

// ---- de response-manager: een generatie tegelijk ----
{
  const verstuurd = []
  const rm = maakResponseManager(o => verstuurd.push(o.type))
  rm.vraag()
  rm.vraag()
  rm.vraag()
  eis('tijdens een lopende generatie wordt een nieuwe response.create niet verstuurd',
    verstuurd.filter(t => t === 'response.create').length === 1)
  rm.event('response.created')
  rm.event('response.done')
  eis('na afronden volgt precies een gebundeld vervolg (gequeued)',
    verstuurd.filter(t => t === 'response.create').length === 2)
  rm.event('response.done')
  eis('zonder wachtende aanvraag volgt er niets meer',
    verstuurd.filter(t => t === 'response.create').length === 2)
  rm.vraag()
  eis('een nieuwe aanvraag na rust start direct',
    verstuurd.filter(t => t === 'response.create').length === 3)
  rm.onderbreek()
  eis('onderbreken stuurt response.cancel voor de lopende generatie',
    verstuurd.includes('response.cancel'))
}

// ---- dubbele beurten ----
{
  const nu = Date.now()
  eis('identieke beurt vrijwel gelijktijdig geldt als technisch duplicaat',
    isDubbeleBeurt({ tekst: 'ja', om: nu - 200 }, 'ja', nu) === true)
  eis('een bewuste herhaling (ruim een seconde later) is een echte beurt',
    isDubbeleBeurt({ tekst: 'ja', om: nu - 1200 }, 'ja', nu) === false)
  eis('een andere tekst is nooit dubbel',
    isDubbeleBeurt({ tekst: 'ja', om: nu - 100 }, 'nee', nu) === false)
}

// ---- de eventverwerker met nagespeelde events ----
{
  const verstuurd = []
  const transcripten = []
  const calls = []
  const rm = maakResponseManager(o => verstuurd.push(o.type))
  const verwerk = maakEventVerwerker({
    stuur: o => verstuurd.push(o.type),
    rm,
    onTranscript: (rol, tekst, definitief) => { if (definitief) transcripten.push(rol + ':' + tekst) },
    onFunctionCall: async (naam, args) => { calls.push(naam); return { ok: true } },
  })

  // een spraakbeurt "ja" die dubbel binnenkomt (twee item-ids, zelfde
  // tekst, vlak na elkaar) landt precies een keer
  await verwerk({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'i1', transcript: 'ja' })
  await verwerk({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'i1', transcript: 'ja' })
  await verwerk({ type: 'conversation.item.input_audio_transcription.completed', item_id: 'i2', transcript: 'ja' })
  eis('een dubbel binnengekomen identieke beurt landt precies een keer',
    transcripten.filter(t => t === 'klant:ja').length === 1, JSON.stringify(transcripten))

  // het model antwoordt met DRIE function calls in een beurt: er
  // wordt precies een vervolgantwoord aangevraagd, niet drie
  await verwerk({ type: 'response.created' })
  await verwerk({ type: 'response.function_call_arguments.done', name: 'spraakVoorkeur', call_id: 'c1', arguments: '{"spraak":true}' })
  await verwerk({ type: 'response.function_call_arguments.done', name: 'stapAfronden', call_id: 'c2', arguments: '{"stap":0}' })
  await verwerk({ type: 'response.function_call_arguments.done', name: 'naarStap', call_id: 'c3', arguments: '{"stap":1}' })
  eis('alle drie function calls uitgevoerd met output terug',
    calls.length === 3 && verstuurd.filter(t => t === 'conversation.item.create').length === 3)
  eis('tijdens de lopende generatie wordt geen response.create verstuurd',
    verstuurd.filter(t => t === 'response.create').length === 0, JSON.stringify(verstuurd))
  await verwerk({ type: 'response.done' })
  eis('na afronden volgt precies een vervolgantwoord voor de hele batch',
    verstuurd.filter(t => t === 'response.create').length === 1)

  // ondertiteling: architect-tekst streamt en rondt een keer af
  await verwerk({ type: 'response.output_audio_transcript.delta', delta: 'Welkom ' })
  await verwerk({ type: 'response.output_audio_transcript.delta', delta: 'bij STAEL.' })
  await verwerk({ type: 'response.output_audio_transcript.done', transcript: 'Welkom bij STAEL.' })
  eis('de architecttekst rondt als een definitieve beurt af',
    transcripten.filter(t => t.startsWith('architect:')).length === 1
    && transcripten.includes('architect:Welkom bij STAEL.'))

  // een onderbroken antwoord (cancel halverwege) laat geen half
  // streamende ondertitel achter en de buffer plakt niet door
  await verwerk({ type: 'response.created' })
  await verwerk({ type: 'response.output_audio_transcript.delta', delta: 'Dan gaan we nu naar uw ' })
  await verwerk({ type: 'response.cancelled' })
  eis('een onderbroken antwoord rondt zijn ondertitel definitief af',
    transcripten.includes('architect:Dan gaan we nu naar uw '))
  await verwerk({ type: 'response.created' })
  await verwerk({ type: 'response.output_audio_transcript.delta', delta: 'Goed, verder.' })
  await verwerk({ type: 'response.output_audio_transcript.done', transcript: 'Goed, verder.' })
  eis('de buffer van een onderbroken antwoord plakt niet aan het volgende',
    transcripten.includes('architect:Goed, verder.'))
}

// ---- een getypte beurt tijdens een actieve spraakverbinding ----
{
  const verstuurd = []
  const rm = maakResponseManager(o => verstuurd.push(o))
  // de architect is nog aan het antwoorden wanneer de klant typt
  rm.vraag()
  rm.event('response.created')
  verstuurd.length = 0
  stuurTekstBeurt(o => verstuurd.push(o), rm, 'de goot mag lager')
  eis('de getypte beurt onderbreekt eerst het lopende antwoord',
    verstuurd[0]?.type === 'response.cancel')
  const item = verstuurd.find(o => o.type === 'conversation.item.create')
  eis('de getypte beurt landt als gespreksitem in de Realtime-sessie',
    item?.item?.role === 'user' && item.item.content[0].type === 'input_text'
    && item.item.content[0].text === 'de goot mag lager')
  eis('de vervolgaanvraag wacht netjes op de annulering (gequeued)',
    !verstuurd.some(o => o.type === 'response.create'))
  rm.event('response.cancelled')
  const create = verstuurd.find(o => o.type === 'response.create')
  eis('daarna wordt het antwoord als AUDIO-response aangevraagd',
    create?.response?.output_modalities?.length === 1 && create.response.output_modalities[0] === 'audio')

  // ook een rustige getypte beurt (geen lopend antwoord) vraagt audio
  const stil = []
  const rm2 = maakResponseManager(o => stil.push(o))
  stuurTekstBeurt(o => stil.push(o), rm2, 'ja')
  eis('zonder lopend antwoord: item plus direct een audio-response, geen cancel',
    !stil.some(o => o.type === 'response.cancel')
    && stil.find(o => o.type === 'response.create')?.response?.output_modalities[0] === 'audio')
}

// ---- na Stop spraak volgt typen het tekstpad (chat completions) ----
{
  const opgeroepen = []
  globalThis.fetch = async (url, opties) => {
    opgeroepen.push(url)
    return { ok: true, json: async () => ({ tekst: 'prima', functieAanroepen: [], ruw: { role: 'assistant', content: 'prima' } }) }
  }
  process.env.API_BASIS = 'http://tekstpad.test'
  const a = maakTekstAdapter({ token: 't' })
  a.onTranscript = () => {}
  await a.start()
  await a.zegTekst('ja')
  eis('zonder spraakverbinding gaat een getypte beurt via het tekstpad van de eigen API',
    opgeroepen.length === 1 && String(opgeroepen[0]).includes('/api/stem/tekst'))
}

console.log(fouten ? 'FAAL: ' + fouten + ' checks rood' : 'gesprekstest stem groen')
process.exitCode = fouten ? 1 : 0
