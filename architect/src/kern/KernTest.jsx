import { useEffect, useRef, useState } from 'react'
import { bouwModel } from './model.js'
import { valideerModel, repareerModel } from './valideer.js'
import KernCanvas from './KernWoning.jsx'
import IfcPaneel from './IfcPaneel.jsx'

// mount een canvas alleen wanneer het (bijna) in beeld is: de pagina
// heeft meer zichten dan de browser gelijktijdige WebGL-contexts toestaat
function LuiCanvas({ children }) {
  const ref = useRef(null)
  const [zichtbaar, zetZichtbaar] = useState(false)
  useEffect(() => {
    const io = new IntersectionObserver(([e]) => zetZichtbaar(e.isIntersecting), { rootMargin: '250px' })
    io.observe(ref.current)
    return () => io.disconnect()
  }, [])
  return <div ref={ref} style={{ position: 'absolute', inset: 0 }}>{zichtbaar ? children : null}</div>
}

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
            <div className="kerncanvas"><LuiCanvas><KernCanvas model={model} camera={z.camera} /></LuiCanvas></div>
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
    { naam: 'nok voor', camera: { pos: [2.5, vol.nok + 1.2, vol.d / 2 + 3.5], doel: [0, vol.nok - .3, vol.d / 2 - 1], fov: 35 } },
    { naam: 'nok zij', camera: { pos: [10, vol.nok + 3.5, 0], doel: [0, vol.nok - .6, 0], fov: 35 } },
    { naam: 'nok schuin achter', camera: { pos: [-4.5, vol.nok + 2.6, -vol.d / 2 - 4.5], doel: [0, vol.nok - .5, -vol.d / 2 + 2], fov: 35 } },
    { naam: 'geveltop frontaal', camera: { pos: [0, vol.nok - .2, vol.d / 2 + 7.5], doel: [0, vol.nok - .8, vol.d / 2], fov: 35 } },
    { naam: 'keuring laag links', camera: { pos: [-6.5, 1.1, 9.5], doel: [0, 4.2, 2], fov: 42 } },
    { naam: 'keuring hoog achter', camera: { pos: [4.5, 9.5, -8.5], doel: [-2, 2.2, 2], fov: 42 } },
    { naam: 'dakrand', camera: { pos: [vol.b / 2 + 3, vol.goot + 1.8, vol.d / 2 - 1], doel: [vol.b / 2 - .2, vol.goot + .1, vol.d / 2 - 3.5], fov: 35 } },
    { naam: 'gevelhoek', camera: { pos: [vol.b / 2 + 2.6, 1.8, vol.d / 2 + 2.6], doel: [vol.b / 2 - .3, 1.3, vol.d / 2 - .3], fov: 35 } },
  ]
  const kolZichten = [
    { naam: 'totaal', camera: { pos: [13, 6, 15], doel: [0, 2.6, 0] } },
    { naam: 'dakrand onderzijde', camera: { pos: [vol.b / 2 + 5, .8, vol.d / 2 - 1], doel: [vol.b / 2 + .6, vol.goot - 1.0, vol.d / 2 - 4], fov: 40 } },
    { naam: 'nok', camera: { pos: [2.5, vol.nok + 1.2, vol.d / 2 + 3.5], doel: [0, vol.nok - .3, vol.d / 2 - 1], fov: 35 } },
    { naam: 'keuring schuin onder', camera: { pos: [7.5, .7, 8.5], doel: [1, 3.4, 0], fov: 42 } },
  ]
  // stap 2: gevel-elementen met de kopgevel als gastvlak
  const stap2 = maak({
    ...BASIS,
    volume: { b: 8, d: 12, goot: 3.2, helling: 48 },
    plint: { h: .95, kleur: '#b09a72' },
    gevelElementen: [
      { wand: 'kop+', type: 'kader', kleur: '#26262a' },
      { wand: 'kop+', type: 'lamellenveld', u: 0, breedte: 4.6, v0: 3.5, v1: 5.4, kleur: '#84705a' },
      { wand: 'kop+', type: 'balkon', u: 0, breedte: 3, vloer: 2.9, diepte: 1.4 },
      { wand: 'langs-', type: 'paneel', u: 2.5, v: .2, h: 2.4, b: 1.4, kleur: '#d8d4c9' },
    ],
  })
  const v2 = stap2.model.volumes[0]
  const stap2Zichten = [
    { naam: 'kopgevel', camera: { pos: [1, 3.4, 17], doel: [0, 3.4, 0], fov: 38 } },
    { naam: 'schuin', camera: { pos: [9, 4.5, 13], doel: [0, 3, 1], fov: 38 } },
    { naam: 'plint en paneel', camera: { pos: [-v2.b / 2 - 4, 2, v2.d / 2 + 4], doel: [-1, 1.2, 2], fov: 38 } },
  ]

  // stap 3: samengestelde massa's
  const kopstaart = maak({
    ...BASIS, volume: { b: 8, d: 16, goot: 2.8, helling: 48 },
    massa: { type: 'kopstaart', dKop: 5.4, gootK: 4.4, krimp: .8 },
  })
  const aanbouwM = maak({
    ...BASIS, volume: { b: 8, d: 13, goot: 2.9, helling: 50 },
    massa: { type: 'aanbouw', kant: 1, b: 3.2, d: 5, h: 2.6, z: 1.5 },
    uitbouw: { type: 'veranda', diepte: 2.4, kolommen: 3 },
    plint: { h: .9, kleur: '#b09a72' },
  })
  const portaalM = maak({
    ...BASIS, volume: { b: 9, d: 12, goot: 2.7, helling: 42 },
    uitbouw: { type: 'portaal', uit: 1.6 },
  })
  const luifelM = maak({
    ...BASIS, volume: { b: 8.6, d: 11, goot: 3.1, helling: 47 },
    uitbouw: { type: 'zijluifel', kant: -1, uit: 1.6 },
  })
  const ksZichten = [
    { naam: 'totaal', camera: { pos: [14, 7, 17], doel: [0, 3, 0] } },
    { naam: 'overgang kop-staart', camera: { pos: [8.5, 6.5, 6], doel: [1.2, 4.2, 2.4], fov: 35 } },
    { naam: 'nokken zij', camera: { pos: [12, 8, 0], doel: [0, 5, 0], fov: 35 } },
  ]
  const abZichten = [
    { naam: 'totaal', camera: { pos: [13, 6, 15], doel: [0, 2.6, 0] } },
    { naam: 'aanbouwhoek', camera: { pos: [10, 2.2, 8], doel: [4.6, 1.8, 1.5], fov: 38 } },
    { naam: 'veranda', camera: { pos: [4.5, 2, 13], doel: [0, 2.6, 6], fov: 40 } },
  ]
  const poZichten = [
    { naam: 'totaal', camera: { pos: [12, 6, 15], doel: [0, 2.6, 0] } },
    { naam: 'portaal', camera: { pos: [3.5, 2, 13], doel: [0, 2.8, 7], fov: 38 } },
  ]
  const zlZichten = [
    { naam: 'totaal', camera: { pos: [-12, 6, 14], doel: [0, 2.8, 0] } },
    { naam: 'zijluifel', camera: { pos: [-9, 2, 9.5], doel: [-4.8, 2.2, 3], fov: 40 } },
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
      <Blok titel="stap2: gevel-elementen op het gastvlak (kader, lamellen, balkon, plint, paneel)"
        model={stap2.model} fouten={stap2.fouten} zichten={stap2Zichten} />
      <Blok titel="kopstaart: hoog kopgebouw met lagere staart"
        model={kopstaart.model} fouten={kopstaart.fouten} zichten={ksZichten} />
      <Blok titel="aanbouw: geschakeld plat volume plus veranda op kolommen"
        model={aanbouwM.model} fouten={aanbouwM.fouten} zichten={abZichten} />
      <Blok titel="portaal: dakcontour doorgetrokken tot de grond"
        model={portaalM.model} fouten={portaalM.fouten} zichten={poZichten} />
      <Blok titel="zijluifel: dakvlak zijwaarts doorgetrokken met schijfwand"
        model={luifelM.model} fouten={luifelM.fouten} zichten={zlZichten} />
      <section>
        <div className="kernbloktitel"><h2>IFC-referentie: de gerealiseerde STÆL-woning (detaillering, niet de vorm)</h2></div>
        <div className="kernzichten">
          {ifcZichten.map(z => (
            <div key={z.naam} className="kernvak" id={'zicht-ifc-' + z.naam}>
              <h2>{z.naam}</h2>
              <div className="kerncanvas"><LuiCanvas><IfcPaneel camera={z.camera} /></LuiCanvas></div>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
