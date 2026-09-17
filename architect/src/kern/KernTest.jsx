import { bouwModel } from './model.js'
import { valideerModel, repareerModel } from './valideer.js'
import KernCanvas from './KernWoning.jsx'

// Interne testpagina voor de gebouwmodel-kern (?kern): stap 1,
// rechthoekige schuurwoning met zadeldak, een contourpui in de
// kopgevel en raamstroken in de langsgevels, met close-ups van de
// aansluitingen op nok, goot en gevelhoek.

const PARAMS = {
  seed: 1,
  volume: { b: 8, d: 12, goot: 2.8, helling: 48, nokOffset: 0, dakDikte: .16, overstek: { goot: .45, kop: .35 } },
  sparingen: [{ wand: 'kop+', vorm: 'contour', x: 0, breedte: 5.2, marge: .2, stramien: 'stroken' }],
  raamRitme: { n: 4, w: .9, plint: .3 },
  kleuren: { gevel: '#77644c', dak: '#232327' },
}

export default function KernTest() {
  let model = bouwModel(PARAMS)
  let fouten = valideerModel(model)
  if (fouten.length) {
    model = repareerModel(model)
    fouten = valideerModel(model)
  }
  const vol = model.volumes[0]
  const zichten = [
    { naam: 'totaal', camera: { pos: [13, 6, 15], doel: [0, 2.6, 0] } },
    { naam: 'nok', camera: { pos: [2.5, vol.nok + 1.2, vol.d / 2 + 3.5], doel: [0, vol.nok - .3, vol.d / 2 - 1], fov: 35 } },
    { naam: 'goot', camera: { pos: [vol.b / 2 + 3, vol.goot + 1.6, vol.d / 2 - 1.5], doel: [vol.b / 2, vol.goot, vol.d / 2 - 3.5], fov: 35 } },
    { naam: 'gevelhoek', camera: { pos: [vol.b / 2 + 2.6, 1.8, vol.d / 2 + 2.6], doel: [vol.b / 2 - .3, 1.3, vol.d / 2 - .3], fov: 35 } },
  ]
  return (
    <div className="kerntest">
      <header>
        <img src="./wordmark.png" alt="STÆL" style={{ height: 22 }} />
        <span className="titel">GEBOUWMODEL-KERN <em>stap 1 · schuurwoning</em></span>
        <span className={'kalteller'} style={{ color: fouten.length ? '#d98a5a' : '#8fc493' }}>
          {fouten.length ? fouten.length + ' modelfouten' : 'model valide'}
        </span>
      </header>
      {fouten.length > 0 && (
        <ul className="kernfouten">{fouten.map((f, i) => <li key={i}>{f}</li>)}</ul>
      )}
      <div className="kernzichten">
        {zichten.map(z => (
          <div key={z.naam} className="kernvak" id={'zicht-' + z.naam}>
            <h2>{z.naam}</h2>
            <div className="kerncanvas"><KernCanvas model={model} camera={z.camera} /></div>
          </div>
        ))}
      </div>
    </div>
  )
}
