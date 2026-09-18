import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { LUCHTFOTO, pdokFixtureAan } from './pdok.js'

// Stap 2: kavel en programma. De klant zoekt het adres, wijst het
// eigen perceel aan op de luchtfoto met kadastrale grenzen, en legt
// daarna het programma van eisen vast. Alles loopt via dezelfde
// functielaag als de stem; de oppervlakte komt uit de kadastrale data.

const vak = { background: '#161618', border: '1px solid #2c2c30', borderRadius: 8 }
const veldStijl = {
  background: '#1c1c1f', color: '#e8e4dc', border: '1px solid #3a3a3e',
  borderRadius: 5, padding: '.45rem .55rem', fontSize: '.85rem', width: '100%', boxSizing: 'border-box',
}

// koperen randlijnen, zodat de perceelgrenzen ook op een lichte
// luchtfoto (zand, kassen, wegmarkering) onmiskenbaar opvallen
const STIJL_GEWOON = { color: '#C98A5E', weight: 2.5, fillColor: '#C98A5E', fillOpacity: 0.10 }
const STIJL_GEKOZEN = { color: '#E8B48C', weight: 4, fillColor: '#E8B48C', fillOpacity: 0.30 }

export default function KavelStap({ sessie, functies, kavelBron, meldArchitect }) {
  const kaartDiv = useRef(null)
  const kaartRef = useRef(null)
  const perceelLaag = useRef(null)
  const [adresInvoer, zetAdresInvoer] = useState('')
  const [zoeken, zetZoeken] = useState(false)
  const [melding, zetMelding] = useState(null)
  const [selectie, zetSelectie] = useState(null)
  const kavel = sessie.kavel
  const programma = sessie.programma || {}
  const [form, zetForm] = useState({
    woonoppervlakte: programma.woonoppervlakte || '', verdiepingen: programma.verdiepingen || '',
    slaapkamers: programma.slaapkamers || '', badkamers: programma.badkamers || '',
    keuken: programma.keuken || '', bijzonderheden: programma.bijzonderheden || '',
  })

  async function zoek() {
    const adres = adresInvoer.trim()
    if (!adres) return
    zetZoeken(true); zetMelding(null)
    const r = await functies.voerUit('kavelZoeken', { adres })
    zetZoeken(false)
    if (!r.ok) { zetMelding(r.fout); return }
    meldArchitect('Ik heb ' + r.adres + ' gevonden. Wijs op de kaart het perceel aan dat van u is of wordt.')
  }

  async function kiesPerceel() {
    if (!selectie) return
    const r = await functies.voerUit('kavelKiezen', { perceelId: selectie.id })
    if (!r.ok) { zetMelding(r.fout); return }
    zetMelding(null)
    meldArchitect('Vastgelegd: perceel ' + selectie.sectie + ' ' + selectie.perceelnummer
      + ', ' + selectie.oppervlakte + ' m2 volgens het Kadaster. Dan nu uw woonwensen.')
  }

  async function legProgrammaVast() {
    const args = {}
    for (const [k, v] of Object.entries(form)) {
      if (v === '' || v === null) continue
      args[k] = ['keuken', 'bijzonderheden'].includes(k) ? v : Number(v)
    }
    const r = await functies.voerUit('programmaVastleggen', args)
    if (!r.ok) { zetMelding(r.fout); return }
    zetMelding(null)
    meldArchitect('Uw programma staat genoteerd.')
  }

  async function rondAf() {
    await legProgrammaVast()
    const klaar = await functies.voerUit('stapAfronden', { stap: 2 })
    if (!klaar.ok) { zetMelding(klaar.fout); return }
    await functies.voerUit('naarStap', { stap: 3 })
    meldArchitect('Kavel en programma zijn compleet. Dan gaan we nu modellen bekijken.')
  }

  // kaart opbouwen zodra er een kavelbron of bewaarde kavel is
  useEffect(() => {
    const bron = kavelBron || (kavel ? {
      adres: { lon: kavel.lon, lat: kavel.lat, weergavenaam: kavel.adres },
      percelen: kavel.geometrie ? [{ ...kavel, id: kavel.perceelId }] : [],
    } : null)
    if (!bron || !kaartDiv.current) return

    if (!kaartRef.current) {
      const kaart = L.map(kaartDiv.current, { zoomControl: true, attributionControl: true })
      kaart.setView([bron.adres.lat, bron.adres.lon], 18)
      if (!pdokFixtureAan()) {
        L.tileLayer(LUCHTFOTO.url, { maxZoom: LUCHTFOTO.maxZoom, attribution: LUCHTFOTO.attributie }).addTo(kaart)
      } else {
        kaart.attributionControl.addAttribution('vaste testkaart zonder luchtfoto')
      }
      L.circleMarker([bron.adres.lat, bron.adres.lon], {
        radius: 6, color: '#e8873c', fillColor: '#e8873c', fillOpacity: 0.9, weight: 2, interactive: false,
      }).addTo(kaart)
      // een klik naast alle percelen krijgt altijd een reactie
      kaart.on('click', e => {
        if (e.originalEvent && e.originalEvent._opPerceel) return
        zetMelding('Hier vind ik geen perceel; klik binnen een koperen perceelgrens.')
      })
      kaartRef.current = kaart
    }

    if (perceelLaag.current) perceelLaag.current.remove()
    const gekozenId = kavel?.perceelId
    const laag = L.geoJSON(
      { type: 'FeatureCollection', features: bron.percelen.map(p => ({ type: 'Feature', properties: { id: p.id }, geometry: p.geometrie })) },
      {
        style: f => (f.properties.id === gekozenId ? STIJL_GEKOZEN : STIJL_GEWOON),
        onEachFeature: (f, layer) => {
          layer.on('click', e => {
            if (e.originalEvent) e.originalEvent._opPerceel = true
            const p = bron.percelen.find(x => x.id === f.properties.id)
            zetSelectie(p || null)
            zetMelding(null)
            laag.setStyle(g => (g.properties.id === f.properties.id ? STIJL_GEKOZEN : STIJL_GEWOON))
          })
        },
      },
    ).addTo(kaartRef.current)
    laag.eachLayer(l => {
      const el = l.getElement && l.getElement()
      if (el) el.setAttribute('data-perceel', l.feature.properties.id)
    })
    perceelLaag.current = laag
    // het kaartbeeld volgt altijd de geladen percelenlaag, zodat er
    // nooit kaart zonder aanwijsbare percelen in beeld staat
    if (bron.percelen.length) {
      kaartRef.current.fitBounds(laag.getBounds().pad(0.04), { maxZoom: 18 })
    }
    return undefined
  }, [kavelBron, kavel?.perceelId])

  useEffect(() => () => { kaartRef.current?.remove(); kaartRef.current = null }, [])

  const toonKaart = !!(kavelBron || (kavel && kavel.geometrie))
  const info = selectie || kavel

  return (
    <div style={{ display: 'grid', gap: '.7rem' }}>
      <div className="kavelzoek" style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ color: '#a7a49c', fontSize: '.88rem', flex: '1 1 100%' }}>
          {kavel ? 'Uw kavel: ' + (kavel.adres || 'perceel ' + kavel.sectie + ' ' + kavel.perceelnummer) : 'Wat is het adres van uw kavel?'}
        </span>
        <input value={adresInvoer} onChange={e => zetAdresInvoer(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') zoek() }}
          placeholder="Straat, huisnummer en plaats"
          style={{ ...veldStijl, flex: '1 1 200px', minWidth: 0, width: 'auto' }} />
        <button type="button" className="nieuweset" disabled={zoeken} onClick={zoek}>{zoeken ? 'Zoeken…' : 'Zoek adres'}</button>
      </div>

      {melding && <div style={{ ...vak, padding: '.5rem .8rem', color: '#d9b06a', fontSize: '.85rem' }}>{melding}</div>}

      {toonKaart && (
        <div style={{ display: 'grid', gap: '.6rem' }}>
          <div ref={kaartDiv} className="kavelkaart" style={{
            ...vak, height: 380, overflow: 'hidden',
            // eigen stacking context, zodat de Leaflet-knoppen (hoge
            // z-index) nooit over de vaste paginakop tekenen
            position: 'relative', zIndex: 0,
            background: pdokFixtureAan() ? '#232a2e' : '#161618',
          }} />
          {info && (
            <div className="perceelinfo" style={{ ...vak, padding: '.7rem .9rem', display: 'flex', gap: '.9rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'grid', gap: '.15rem', flex: '1 1 220px' }}>
                <strong style={{ color: '#e8e4dc', letterSpacing: '.04em' }}>
                  Perceel {info.gemeente} {info.sectie} {info.perceelnummer}
                </strong>
                <span style={{ color: '#a7a49c', fontSize: '.85rem' }}>
                  Kadastrale oppervlakte: {info.oppervlakte} m² (uit de kadastrale gegevens)
                </span>
              </div>
              {!kavel || (selectie && selectie.id !== kavel.perceelId)
                ? <button type="button" className="nieuweset" onClick={kiesPerceel} disabled={!selectie}>Dit is mijn perceel</button>
                : <span style={{ color: '#8fc493', fontSize: '.85rem' }}>✓ gekozen</span>}
            </div>
          )}
        </div>
      )}

      {kavel && (
        <div className="programmaform" style={{ ...vak, padding: '.9rem', display: 'grid', gap: '.7rem' }}>
          <strong style={{ color: '#e8e4dc', letterSpacing: '.05em' }}>Uw programma van eisen</strong>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '.6rem' }}>
            {[
              ['woonoppervlakte', 'Woonoppervlakte (m²)', 'number'],
              ['verdiepingen', 'Verdiepingen', 'number'],
              ['slaapkamers', 'Slaapkamers', 'number'],
              ['badkamers', 'Badkamers', 'number'],
              ['keuken', 'Soort keuken', 'text'],
            ].map(([k, label, type]) => (
              <label key={k} style={{ display: 'grid', gap: '.25rem', color: '#a7a49c', fontSize: '.78rem' }}>
                {label}
                <input type={type} value={form[k]} min={type === 'number' ? 0 : undefined}
                  onChange={e => zetForm(v => ({ ...v, [k]: e.target.value }))} style={veldStijl} />
              </label>
            ))}
          </div>
          <label style={{ display: 'grid', gap: '.25rem', color: '#a7a49c', fontSize: '.78rem' }}>
            Bijzondere wensen en wat u weet over het bestemmingsplan (bouwvlak, bebouwingspercentage)
            <textarea rows={2} value={form.bijzonderheden}
              onChange={e => zetForm(v => ({ ...v, bijzonderheden: e.target.value }))}
              style={{ ...veldStijl, resize: 'vertical', fontFamily: 'inherit' }} />
          </label>
          <div style={{ display: 'flex', gap: '.6rem', flexWrap: 'wrap' }}>
            <button type="button" className="nieuweset" onClick={legProgrammaVast}>Programma vastleggen</button>
            <button type="button" className="nieuweset" disabled={!form.woonoppervlakte || !form.slaapkamers}
              onClick={rondAf}>Kavel en programma afronden</button>
          </div>
        </div>
      )}
    </div>
  )
}
