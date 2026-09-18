// Gesprekstest gespreksbewaking (spraakkanaal): er loopt nooit meer
// dan een response-generatie tegelijk, meerdere function calls in een
// beurt leveren precies een vervolgantwoord, een nieuwe beurt
// onderbreekt de lopende generatie netjes, en een dubbel binnengekomen
// identieke klantbeurt landt precies een keer. Draait op de
// eventverwerker met nagespeelde Realtime-events, zonder audio en
// zonder API-kosten.
import { maakResponseManager, maakEventVerwerker, isDubbeleBeurt } from '../src/reis/adapter.js'

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

console.log(fouten ? 'FAAL: ' + fouten + ' checks rood' : 'gesprekstest stem groen')
process.exitCode = fouten ? 1 : 0
