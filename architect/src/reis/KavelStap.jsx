import { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { LUCHTFOTO, pdokFixtureAan, zoekGebied } from './pdok.js'
import { ringOppervlakteM2 } from './functies.js'

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
// het perceel waar de adresmarker in valt licht vast op, zodat de
// klant al voor het klikken ziet welk vlak bij zijn adres hoort
const STIJL_THUIS = { color: '#E8B48C', weight: 3, fillColor: '#E8B48C', fillOpacity: 0.22 }
const STIJL_TEKENING = { color: '#E8B48C', weight: 3, dashArray: '6 4', fillColor: '#E8B48C', fillOpacity: 0.25 }

const hoekIcoon = L.divIcon({ className: 'tekenpunt', iconSize: [14, 14], iconAnchor: [7, 7] })

export default function KavelStap({ sessie, functies, kavelBron, tekenVraag, meldArchitect }) {
  const kaartDiv = useRef(null)
  const kaartRef = useRef(null)
  const perceelLaag = useRef(null)
  const [adresInvoer, zetAdresInvoer] = useState('')
  const [zoeken, zetZoeken] = useState(false)
  const [melding, zetMelding] = useState(null)
  const [selectie, zetSelectie] = useState(null)
  const [tekenen, zetTekenen] = useState(false)
  const [tekenStand, zetTekenStand] = useState({ punten: 0, oppervlakte: 0 })
  const tekenenRef = useRef(false)
  const tekening = useRef({ markers: [], polygon: null })
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

  // ---- kavel zelf intekenen (moederperceel of deelaankoop) ----
  const tekenPunten = () => tekening.current.markers.map(m => {
    const ll = m.getLatLng(); return [ll.lng, ll.lat]
  })

  function updateTekening() {
    const lonlat = tekenPunten()
    const latlng = lonlat.map(([lon, lat]) => [lat, lon])
    const t = tekening.current
    if (t.polygon) { t.polygon.remove(); t.polygon = null }
    if (latlng.length >= 2) {
      t.polygon = L.polygon(latlng, { ...STIJL_TEKENING, interactive: false }).addTo(kaartRef.current)
    }
    zetTekenStand({ punten: lonlat.length, oppervlakte: Math.round(ringOppervlakteM2(lonlat)) })
  }

  function voegHoekpuntToe(latlng) {
    const m = L.marker(latlng, { draggable: true, icon: hoekIcoon }).addTo(kaartRef.current)
    m.on('drag', updateTekening)
    m.on('dragend', updateTekening)
    tekening.current.markers.push(m)
    updateTekening()
  }

  function ruimTekeningOp() {
    for (const m of tekening.current.markers) m.remove()
    if (tekening.current.polygon) tekening.current.polygon.remove()
    tekening.current = { markers: [], polygon: null }
    tekenenRef.current = false
    zetTekenen(false)
    zetTekenStand({ punten: 0, oppervlakte: 0 })
  }

  function startTekenen() {
    if (!kaartRef.current) { zetMelding('Zoek eerst het adres, dan kunt u de kavel intekenen.'); return }
    ruimTekeningOp()
    tekenenRef.current = true
    zetTekenen(true)
    zetSelectie(null)
    zetMelding(null)
  }

  async function sluitTekening() {
    const punten = tekenPunten()
    const r = await functies.voerUit('kavelIntekenen', { punten })
    if (!r.ok) { zetMelding(r.fout); return }
    ruimTekeningOp()
    meldArchitect('Uw kavel is ingetekend: ' + r.kavel.oppervlakte + ' m2 volgens uw eigen tekening. Dan nu uw woonwensen.')
  }

  // de Architect kan de tekenmodus starten (kavelTekenenStarten)
  useEffect(() => { if (tekenVraag > 0) startTekenen() }, [tekenVraag])

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
      // in tekenmodus is elke kaartklik een hoekpunt; daarbuiten
      // krijgt een klik naast alle percelen altijd een reactie
      kaart.on('click', e => {
        if (tekenenRef.current) {
          if (!(e.originalEvent && e.originalEvent._hoekpunt)) voegHoekpuntToe(e.latlng)
          return
        }
        if (e.originalEvent && e.originalEvent._opPerceel) return
        zetMelding('Hier vind ik geen perceel; klik binnen een koperen perceelgrens.')
      })
      kaartRef.current = kaart
    }

    if (perceelLaag.current) perceelLaag.current.remove()
    const gekozenId = kavel?.perceelId
    const thuisId = kavelBron?.thuisId ?? null
    const stijlVoor = (id, selectieId) =>
      id === selectieId ? STIJL_GEKOZEN : id === thuisId ? STIJL_THUIS : STIJL_GEWOON
    const laag = L.geoJSON(
      { type: 'FeatureCollection', features: bron.percelen.map(p => ({ type: 'Feature', properties: { id: p.id }, geometry: p.geometrie })) },
      {
        style: f => stijlVoor(f.properties.id, gekozenId),
        onEachFeature: (f, layer) => {
          layer.on('click', e => {
            if (e.originalEvent) e.originalEvent._opPerceel = true
            if (tekenenRef.current) return // de kaartklik-handler tekent het hoekpunt
            const p = bron.percelen.find(x => x.id === f.properties.id)
            zetSelectie(p || null)
            zetMelding(null)
            laag.setStyle(g => stijlVoor(g.properties.id, f.properties.id))
          })
        },
      },
    ).addTo(kaartRef.current)
    laag.eachLayer(l => {
      const el = l.getElement && l.getElement()
      if (el) el.setAttribute('data-perceel', l.feature.properties.id)
    })
    perceelLaag.current = laag
    // scherpstellen op het zoekgebied rond het adres: daarbinnen is
    // elk stuk kaart per constructie gedekt door geladen percelen
    // (de laag zelf kan kilometerslange weg- en dijkpercelen bevatten
    // die het beeld anders ver zouden laten uitzoomen); bij hervatten
    // zonder verse zoekactie stelt de kaart scherp op het gekozen
    // perceel zelf
    if (kavelBron && bron.adres.lon != null) {
      kaartRef.current.fitBounds(zoekGebied(bron.adres.lon, bron.adres.lat), { maxZoom: 18 })
    } else if (bron.percelen.length) {
      kaartRef.current.fitBounds(laag.getBounds().pad(0.3), { maxZoom: 18 })
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
          {kavel
            ? 'Uw kavel: ' + (kavel.adres || (kavel.herkomst === 'zelf ingetekend' ? 'zelf ingetekend' : 'perceel ' + kavel.sectie + ' ' + kavel.perceelnummer))
            : 'Wat is het adres van uw kavel?'}
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
          {tekenen && (
            <div className="tekenpaneel" style={{ ...vak, padding: '.7rem .9rem', display: 'flex', gap: '.9rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'grid', gap: '.15rem', flex: '1 1 220px' }}>
                <strong style={{ color: '#e8e4dc', letterSpacing: '.04em' }}>Kavel intekenen</strong>
                <span style={{ color: '#a7a49c', fontSize: '.85rem' }}>
                  Klik de hoekpunten op de kaart; punten zijn te verslepen.
                  {' '}{tekenStand.punten} hoekpunt{tekenStand.punten === 1 ? '' : 'en'}
                  {tekenStand.punten >= 3 && <> · oppervlakte: <b className="tekenopp" style={{ color: '#E8B48C' }}>{tekenStand.oppervlakte} m²</b></>}
                </span>
              </div>
              <div style={{ display: 'flex', gap: '.5rem', flexWrap: 'wrap' }}>
                <button type="button" className="nieuweset" disabled={tekenStand.punten < 3}
                  onClick={sluitTekening}>Vlak sluiten en gebruiken</button>
                <button type="button" className="nieuweset" onClick={ruimTekeningOp}>Annuleren</button>
              </div>
            </div>
          )}
          {!tekenen && info && (
            <div className="perceelinfo" style={{ ...vak, padding: '.7rem .9rem', display: 'flex', gap: '.9rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'grid', gap: '.15rem', flex: '1 1 220px' }}>
                {info.herkomst === 'zelf ingetekend' && !selectie ? (
                  <>
                    <strong style={{ color: '#e8e4dc', letterSpacing: '.04em' }}>Zelf ingetekende kavel</strong>
                    <span style={{ color: '#a7a49c', fontSize: '.85rem' }}>
                      Oppervlakte: {info.oppervlakte} m² (zelf ingetekend; het Kadaster kent deze kavel nog niet apart)
                    </span>
                  </>
                ) : (
                  <>
                    <strong style={{ color: '#e8e4dc', letterSpacing: '.04em' }}>
                      Perceel {info.gemeente} {info.sectie} {info.perceelnummer}
                    </strong>
                    <span style={{ color: '#a7a49c', fontSize: '.85rem' }}>
                      Kadastrale oppervlakte: {info.oppervlakte} m² (uit de kadastrale gegevens)
                    </span>
                  </>
                )}
              </div>
              {!kavel || (selectie && selectie.id !== kavel.perceelId)
                ? <button type="button" className="nieuweset" onClick={kiesPerceel} disabled={!selectie}>Dit is mijn perceel</button>
                : <span style={{ color: '#8fc493', fontSize: '.85rem' }}>✓ gekozen</span>}
            </div>
          )}
          {!tekenen && (
            <div style={{ display: 'flex', gap: '.7rem', flexWrap: 'wrap', alignItems: 'center' }}>
              <span style={{ color: '#77756f', fontSize: '.78rem', flex: '1 1 260px' }}>
                Staat uw kavel er niet als eigen perceel op (nieuwbouw) of koopt u een deel van een perceel?
              </span>
              <button type="button" className="nieuweset" style={{ padding: '.45rem 1rem', fontSize: '.78rem' }}
                onClick={startTekenen}>Kavel zelf intekenen</button>
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
