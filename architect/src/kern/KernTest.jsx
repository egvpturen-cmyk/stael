import { bouwModel } from './model.js'
import { valideerModel, repareerModel } from './valideer.js'
import KernCanvas from './KernWoning.jsx'
import IfcPaneel from './IfcPaneel.jsx'

// Interne testpagina voor de gebouwmodel-kern (?kern): de schuurwoning
// van stap 1 in beide detailfamilies (strak/gootloos en kolossaal
// overstek), met close-ups van nok, dakrand en gevelhoek, en daaronder
// het IFC-model van de gerealiseerde woning ter vergelijking.

const BASIS = {
  seed: 1,
  volume: { b: 8, d: 12, goot: 2.8, helling: 48, nokOffset: 0 },
  sparingen: [{ wand: 'kop+', vorm: 'contour', x: 0, breedte: 5.2, marge: .2, stramien: 'stroken' }],
  raamRitme: { n: 4, w: .9, plint: .3 },
  kleuren: { gevel: '#77644c', dak: '#232327' },
}

function maak(params) {
  let model = bouwModel(params)
  let fouten = valideerModel(model)
  if (fouten.length) { model = repareerModel(model); fouten = valideerModel(model) }
  return { model, fouten }
}

function Blok({ titel, model, fouten, zichten }) {
  return (
    <section>
      <div className="kernbloktitel">
        <h2>{titel}</h2>
        <span style={{ color: fouten.length ? '#d98a5a' : '#8fc493', fontSize: '.75rem', letterSpacing: '.1em' }}>
          {fouten.length ? fouten.join(' | ') : 'model valide'}
        </span>
      </div>
      <div className="kernzichten">
        {zichten.map(z => (
          <div key={z.naam} className="kernvak" id={'zicht-' + titel.split(' ')[0].toLowerCase() + '-' + z.naam.replace(/\s+/g, '-')}>
            <h2>{z.naam}</h2>
            <div className="kerncanvas"><KernCanvas model={model} camera={z.camera} /></div>
          </div>
        ))}
      </div>
    </section>
  )
}

export default function KernTest() {
  const strak = maak(BASIS)
  const kolossaal = maak({ ...BASIS, rand: { familie: 'kolossaal', overstek: 1.1 } })
  const vol = strak.model.volumes[0]

  const strakZichten = [
    { naam: 'totaal', camera: { pos: [13, 6, 15], doel: [0, 2.6, 0] } },
    { naam: 'nok', camera: { pos: [2.5, vol.nok + 1.2, vol.d / 2 + 3.5], doel: [0, vol.nok - .3, vol.d / 2 - 1], fov: 35 } },
    { naam: 'dakrand', camera: { pos: [vol.b / 2 + 3, vol.goot + 1.8, vol.d / 2 - 1], doel: [vol.b / 2 - .2, vol.goot + .1, vol.d / 2 - 3.5], fov: 35 } },
    { naam: 'gevelhoek', camera: { pos: [vol.b / 2 + 2.6, 1.8, vol.d / 2 + 2.6], doel: [vol.b / 2 - .3, 1.3, vol.d / 2 - .3], fov: 35 } },
  ]
  const kolZichten = [
    { naam: 'totaal', camera: { pos: [13, 6, 15], doel: [0, 2.6, 0] } },
    { naam: 'dakrand onderzijde', camera: { pos: [vol.b / 2 + 5, .8, vol.d / 2 - 1], doel: [vol.b / 2 + .6, vol.goot - 1.0, vol.d / 2 - 4], fov: 40 } },
    { naam: 'nok', camera: { pos: [2.5, vol.nok + 1.2, vol.d / 2 + 3.5], doel: [0, vol.nok - .3, vol.d / 2 - 1], fov: 35 } },
  ]
  // de IFC-woning: 7,2 x 23,6 m, nok 7,88 m
  const ifcZichten = [
    { naam: 'totaal', camera: { pos: [15, 9, 19], doel: [0, 3.6, 0] } },
    { naam: 'nok', camera: { pos: [3.5, 9.4, 8], doel: [0, 7.6, 2], fov: 35 } },
    { naam: 'dakrand', camera: { pos: [6.4, 6.6, 6], doel: [3.4, 5.0, 1.5], fov: 35 } },
  ]

  return (
    <div className="kerntest">
      <header>
        <img src="./wordmark.png" alt="STÆL" style={{ height: 22 }} />
        <span className="titel">GEBOUWMODEL-KERN <em>STÆL-standaarddetails, geijkt op het IFC</em></span>
      </header>
      <Blok titel="strak / gootloos (default): gevel en dakrand in een vlak, verholen goot"
        model={strak.model} fouten={strak.fouten} zichten={strakZichten} />
      <Blok titel="kolossaal overstek (1,1 m), slank gedetailleerd met zichtbare kepers"
        model={kolossaal.model} fouten={kolossaal.fouten} zichten={kolZichten} />
      <section>
        <div className="kernbloktitel"><h2>IFC-referentie: de gerealiseerde STÆL-woning (detaillering, niet de vorm)</h2></div>
        <div className="kernzichten">
          {ifcZichten.map(z => (
            <div key={z.naam} className="kernvak" id={'zicht-ifc-' + z.naam}>
              <h2>{z.naam}</h2>
              <div className="kerncanvas"><IfcPaneel camera={z.camera} /></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
