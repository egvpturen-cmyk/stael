// Uitvoerder van de function calls van de Architect: elke call wordt
// een controleerbare mutatie op het sessie-object (via de API) plus een
// optioneel UI-signaal. De state is leidend; wat hier niet door de
// bewaking komt, gebeurt niet. Puur JavaScript zonder React, zodat de
// gesprekstest hem in node kan draaien.
import { sessiePatch } from './api.js'
import { COLLECTIE } from './collectie.js'
import { zoekAdres, adresDetail, percelenRond, puntInPerceel, MOEDERPERCEEL_M2 } from './pdok.js'
import { genereerSmaakSet, variantVoorSessie } from './smaakmotor.js'
import { bouwModel } from '../kern/model.js'
import { valideerModel, repareerModel } from '../kern/valideer.js'
import { MATERIALEN } from '../kern/materialen.js'

// welke ontwerpparameters het aanpasgesprek mag wijzigen, met grenzen;
// alles gaat daarna alsnog door bouwModel, valideerModel en het
// bouwvlak, dus dit is de eerste poort, niet de enige
const WIJZIGBAAR = {
  'volume.goot': { naam: 'goothoogte', eenheid: 'm', min: 2.4, max: p => p.regels?.gootMax ?? 7 },
  'volume.helling': { naam: 'dakhelling', eenheid: 'graden', min: 15, max: p => p.regels?.hellingMax ?? 60, nietPlat: true },
  'volume.b': { naam: 'breedte', eenheid: 'm', min: 3, max: 12 },
  'volume.d': { naam: 'diepte', eenheid: 'm', min: 4, max: 30 },
  'materialen.gevel': { naam: 'gevelmateriaal', cat: 'gevel' },
  'materialen.dak': { naam: 'dakmateriaal', cat: 'dak' },
  'materialen.accent': { naam: 'accentmateriaal', cat: 'accent' },
}

// vlakke oppervlakte van een lon/lat-ring in m2 (schoenveterformule op
// een lokale meterprojectie); ruim nauwkeurig genoeg voor woonkavels
export function ringOppervlakteM2(punten) {
  if (!punten || punten.length < 3) return 0
  const R = 6378137, lat0 = punten[0][1] * Math.PI / 180
  const x = p => p[0] * Math.PI / 180 * R * Math.cos(lat0)
  const y = p => p[1] * Math.PI / 180 * R
  let som = 0
  for (let i = 0; i < punten.length; i++) {
    const a = punten[i], b = punten[(i + 1) % punten.length]
    som += x(a) * y(b) - x(b) * y(a)
  }
  return Math.abs(som / 2)
}

// stappen die in de app echt gebouwd zijn; de resultaten van naarStap
// en stapAfronden melden dit, en de Architect belooft alleen wat hier
// bevestigd wordt (nooit een stap die nog moet komen)
export const GEBOUWDE_STAPPEN = [0, 1, 2, 3]

export function maakFuncties({ token, sessieRef, opUiSignaal }) {
  const sessie = () => sessieRef.huidige
  const zet = async updates => {
    const { sessie: nieuw } = await sessiePatch(token, updates)
    sessieRef.huidige = nieuw
    return nieuw
  }
  const signaal = (naam, data) => { if (opUiSignaal) opUiSignaal(naam, data) }

  // het laatst gezochte adres met omliggende percelen; de bron waaruit
  // kavelKiezen put, zowel bij een kaartklik als bij een gesproken keuze
  let kavelBron = { adres: null, percelen: [] }

  const uitvoerders = {
    async spraakVoorkeur({ spraak }) {
      await zet({ spraakOk: !!spraak })
      signaal('spraakVoorkeur', { spraak: !!spraak })
      return { ok: true, spraak: !!spraak }
    },

    async notitieMaken({ tekst }) {
      if (!tekst || !tekst.trim()) return { ok: false, fout: 'lege notitie' }
      const notities = [...sessie().notities, { stap: sessie().stap, tekst: tekst.trim(), om: new Date().toISOString() }]
      await zet({ notities })
      return { ok: true, aantal: notities.length }
    },

    async smaakToevoegen({ favoriet, familie, materiaal, element, citaat }) {
      const smaak = structuredClone(sessie().smaak)
      if (Number.isInteger(favoriet) && !smaak.favorieten.includes(favoriet)) smaak.favorieten.push(favoriet)
      if (familie) smaak.families[familie] = (smaak.families[familie] || 0) + 1
      if (materiaal && !smaak.materialen.includes(materiaal)) smaak.materialen.push(materiaal)
      if (element && !smaak.elementen.includes(element)) smaak.elementen.push(element)
      if (citaat) smaak.citaten.push(citaat)
      await zet({ smaak })
      signaal('smaak', smaak)
      return { ok: true, smaak }
    },

    async favorietKiezen({ nummer, aan }) {
      if (!Number.isInteger(nummer) || nummer < 1 || nummer > 34) return { ok: false, fout: 'onbekend collectienummer' }
      const smaak = structuredClone(sessie().smaak)
      const erin = smaak.favorieten.includes(nummer)
      if (aan && !erin) smaak.favorieten.push(nummer)
      if (!aan && erin) smaak.favorieten = smaak.favorieten.filter(n => n !== nummer)
      if (aan && smaak.favorieten.length > 5) return { ok: false, fout: 'maximaal 5 favorieten; laat er eerst een los' }
      await zet({ smaak })
      signaal('favorieten', smaak.favorieten)
      return { ok: true, favorieten: smaak.favorieten }
    },

    // De regel: de Architect belooft alleen wat hier bevestigd is.
    // kavelZoeken meldt ok pas wanneer de percelenlaag echt geladen is
    // met minstens een perceel; anders een eerlijke fout, ook zichtbaar
    // in de app via het kavelFout-signaal.
    async kavelZoeken({ adres }) {
      if (!adres || !adres.trim()) return { ok: false, fout: 'geen adres opgegeven' }
      const suggesties = await zoekAdres(adres.trim())
      if (!suggesties.length) return { ok: false, fout: 'geen adres gevonden voor "' + adres.trim() + '"' }
      const detail = await adresDetail(suggesties[0].id)
      let percelen
      try {
        percelen = (await percelenRond(detail.lon, detail.lat)).percelen
      } catch (e) {
        signaal('kavelFout', { fout: String(e.message || e) })
        return { ok: false, fout: 'de percelen konden niet geladen worden (' + String(e.message || e) + '); probeer het opnieuw' }
      }
      if (!percelen.length) {
        signaal('kavelFout', { fout: 'geen percelen gevonden' })
        return { ok: false, fout: 'rond dit adres zijn geen kadastrale percelen gevonden; probeer opnieuw of een preciezer adres' }
      }
      const thuis = percelen.find(p => puntInPerceel(detail.lon, detail.lat, p)) || null
      kavelBron = {
        adres: detail, percelen, thuisId: thuis?.id ?? null,
        centra: [{ lon: detail.lon, lat: detail.lat }],
        zoekTeller: (kavelBron.zoekTeller || 0) + 1,
      }
      signaal('kavelBron', kavelBron)
      const kort = p => ({
        id: p.id, sectie: p.sectie, perceelnummer: p.perceelnummer, oppervlakte: p.oppervlakte,
        ...(p.oppervlakte > MOEDERPERCEEL_M2 ? { waarschijnlijkMoederperceel: true } : {}),
      })
      // voor het gesprek alleen het thuisperceel plus een handvol
      // buurpercelen; de volledige laag staat op de kaart
      return {
        ok: true, adres: detail.weergavenaam, aantalPercelen: percelen.length,
        thuisPerceel: thuis ? kort(thuis) : null,
        percelen: [...percelen].sort((a, b) => a.oppervlakte - b.oppervlakte).slice(0, 15).map(kort),
      }
    },

    // percelen bijladen wanneer de kaart naar een gebied pant dat nog
    // niet geladen is; dubbele percelen worden overgeslagen en de bron
    // wordt begrensd door de verste percelen op te ruimen
    async kavelBijladen({ lon, lat }) {
      if (!kavelBron.adres) return { ok: false, fout: 'zoek eerst een adres' }
      let vers
      try {
        vers = (await percelenRond(lon, lat)).percelen
      } catch (e) {
        signaal('kavelFout', { fout: String(e.message || e) })
        return { ok: false, fout: 'de percelen konden hier niet geladen worden; probeer het opnieuw' }
      }
      const bekend = new Set(kavelBron.percelen.map(p => p.id))
      const nieuwe = vers.filter(p => !bekend.has(p.id))
      let percelen = [...kavelBron.percelen, ...nieuwe]
      const MAX_PERCELEN = 900
      if (percelen.length > MAX_PERCELEN) {
        const vast = new Set([kavelBron.thuisId, sessie().kavel?.perceelId].filter(Boolean))
        const punt = p => (p.geometrie.type === 'Polygon' ? p.geometrie.coordinates[0][0] : p.geometrie.coordinates[0][0][0])
        const afstand = p => {
          const [px, py] = punt(p)
          return (px - lon) * (px - lon) * Math.cos(lat * Math.PI / 180) ** 2 + (py - lat) * (py - lat)
        }
        percelen = percelen
          .map(p => [p, vast.has(p.id) ? -1 : afstand(p)])
          .sort((a, b) => a[1] - b[1])
          .slice(0, MAX_PERCELEN)
          .map(([p]) => p)
      }
      kavelBron = { ...kavelBron, percelen, centra: [...(kavelBron.centra || []), { lon, lat }] }
      signaal('kavelBron', kavelBron)
      return { ok: true, nieuwe: nieuwe.length, totaal: percelen.length }
    },

    async kavelKiezen({ perceelId }) {
      const gezocht = String(perceelId)
      const p = kavelBron.percelen.find(x => x.id === gezocht)
        || kavelBron.percelen.find(x => String(x.perceelnummer) === gezocht)
      if (!p) return { ok: false, fout: 'onbekend perceel; zoek eerst het adres en wijs het perceel op de kaart aan' }
      const kavel = {
        herkomst: 'kadastraal',
        adres: kavelBron.adres?.weergavenaam ?? null,
        lon: kavelBron.adres?.lon ?? null,
        lat: kavelBron.adres?.lat ?? null,
        perceelId: p.id, sectie: p.sectie, perceelnummer: p.perceelnummer,
        gemeente: p.gemeente, oppervlakte: p.oppervlakte, geometrie: p.geometrie,
      }
      await zet({ kavel })
      signaal('kavel', kavel)
      // de geometrie blijft in de sessie maar hoort niet in het gesprek
      const { geometrie, ...voorGesprek } = kavel
      return {
        ok: true, kavel: voorGesprek,
        ...(p.oppervlakte > MOEDERPERCEEL_M2 ? { waarschijnlijkMoederperceel: true } : {}),
      }
    },

    // zet de kaart in tekenmodus; de klant klikt hoekpunten en de app
    // meldt zich via kavelIntekenen zodra het vlak gesloten is
    async kavelTekenenStarten() {
      signaal('tekenModus', { aan: true })
      return { ok: true, uitleg: 'de kaart staat in tekenmodus; de klant klikt de hoekpunten van de kavel en sluit het vlak' }
    },

    // de zelf ingetekende kavel: hoekpunten in lon/lat, oppervlakte
    // wordt hier berekend en de herkomst expliciet vastgelegd
    async kavelIntekenen({ punten }) {
      if (!Array.isArray(punten) || punten.length < 3) {
        return { ok: false, fout: 'teken minstens drie hoekpunten' }
      }
      const oppervlakte = Math.round(ringOppervlakteM2(punten))
      if (oppervlakte < 20) return { ok: false, fout: 'het getekende vlak is onwaarschijnlijk klein; teken de kavel opnieuw' }
      const ring = [...punten, punten[0]]
      const kavel = {
        herkomst: 'zelf ingetekend',
        adres: kavelBron.adres?.weergavenaam ?? null,
        lon: kavelBron.adres?.lon ?? null,
        lat: kavelBron.adres?.lat ?? null,
        perceelId: null, sectie: null, perceelnummer: null, gemeente: null,
        oppervlakte, geometrie: { type: 'Polygon', coordinates: [ring] },
      }
      await zet({ kavel })
      signaal('kavel', kavel)
      signaal('tekenModus', { aan: false })
      return { ok: true, kavel: { herkomst: kavel.herkomst, adres: kavel.adres, oppervlakte } }
    },

    async programmaVastleggen(args) {
      const velden = ['woonoppervlakte', 'verdiepingen', 'slaapkamers', 'badkamers', 'keuken', 'bijzonderheden']
      const updates = {}
      for (const v of velden) {
        if (args[v] !== undefined && args[v] !== null && args[v] !== '') updates[v] = args[v]
      }
      if (!Object.keys(updates).length) return { ok: false, fout: 'geen programmagegevens meegegeven' }
      const programma = { ...(sessie().programma || {}), ...updates }
      await zet({ programma })
      signaal('programma', programma)
      return { ok: true, programma }
    },

    async stapAfronden({ stap }) {
      if (stap !== sessie().stap) return { ok: false, fout: 'dit is niet de huidige stap' }
      if (stap === 1) {
        const fav = sessie().smaak.favorieten
        if (fav.length < 3 || fav.length > 5) {
          return { ok: false, fout: 'kies eerst 3 tot 5 favorieten (nu ' + fav.length + ')' }
        }
        // de familietelling volgt altijd deterministisch uit de
        // gekozen favorieten, met of zonder gesprek
        const smaak = structuredClone(sessie().smaak)
        smaak.families = {}
        for (const n of fav) {
          const c = COLLECTIE.find(x => x.nummer === n)
          if (c) smaak.families[c.familie] = (smaak.families[c.familie] || 0) + 1
        }
        await zet({ smaak })
        signaal('smaak', smaak)
      }
      if (stap === 2) {
        const kavel = sessie().kavel
        if (!kavel || !(kavel.perceelId || kavel.herkomst === 'zelf ingetekend')) {
          return { ok: false, fout: 'kies eerst het perceel op de kaart of teken de kavel zelf in' }
        }
        const programma = sessie().programma
        if (!programma || !programma.woonoppervlakte || !programma.slaapkamers) {
          return { ok: false, fout: 'leg eerst het programma vast (minstens woonoppervlakte en slaapkamers)' }
        }
      }
      if (stap === 3 && !sessie().model?.gekozenId) {
        return { ok: false, fout: 'kies eerst een variant als uitgangspunt' }
      }
      signaal('stapAfgerond', { stap })
      const volgendeBeschikbaar = GEBOUWDE_STAPPEN.includes(stap + 1)
      return {
        ok: true, stap, volgendeStapBeschikbaar: volgendeBeschikbaar,
        ...(volgendeBeschikbaar ? {} : { let: 'de volgende stap is nog niet beschikbaar in de app; rond af met de melding dat die binnenkort volgt en beloof hem niet nu' }),
      }
    },

    async naarStap({ stap }) {
      if (!Number.isInteger(stap) || stap < 0 || stap > 4) return { ok: false, fout: 'stap moet 0 tot 4 zijn' }
      await zet({ stap })
      signaal('stap', { stap })
      const beschikbaar = GEBOUWDE_STAPPEN.includes(stap)
      return {
        ok: true, stap, beschikbaar,
        ...(beschikbaar ? {} : { let: 'deze stap is nog niet ingericht in de app; meld dat hij binnenkort volgt en beloof er nu niets over' }),
      }
    },

    // stap 3: een nieuwe set van vijf varianten, gestuurd door het
    // smaakprofiel, het programma en de kavel; een gekozen favoriet
    // blijft staan
    async setVerversen() {
      const s = sessie()
      const oud = s.model || {}
      const ronde = (oud.ronde ?? -1) + 1
      const behoud = oud.gekozenId ? (oud.varianten || []).find(v => v.id === oud.gekozenId) : null
      const { prog, varianten } = await genereerSmaakSet({
        smaak: s.smaak, programma: s.programma, kavel: s.kavel, ronde, behoud,
      })
      if (!varianten.length) return { ok: false, fout: 'er kwam geen variant door de bouwregels; pas het programma aan' }
      const bewaard = varianten.map(variantVoorSessie)
      const alle = behoud ? [behoud, ...bewaard] : bewaard
      const model = { prog, ronde, varianten: alle, gekozenId: oud.gekozenId || null, wijzigingen: oud.wijzigingen || [] }
      await zet({ model })
      signaal('model', model)
      return {
        ok: true, ronde,
        varianten: alle.map(v => ({ id: v.id, naam: v.naam, smaakZin: v.smaakZin, oppervlakte: v.opp, past: v.past })),
      }
    },

    async variantKiezen({ variantId }) {
      const m = sessie().model
      const v = (m?.varianten || []).find(x => x.id === String(variantId))
      if (!v) return { ok: false, fout: 'onbekende variant; noem een id uit de huidige set' }
      const model = { ...m, gekozenId: v.id }
      await zet({ model })
      signaal('model', model)
      return { ok: true, gekozen: { id: v.id, naam: v.naam, smaakZin: v.smaakZin } }
    },

    // het aanpasgesprek: elke wens wordt een parameterwijziging die
    // door de wetten en het bouwvlak gaat; wat niet kan, wordt eerlijk
    // geweigerd met de reden
    async parameterWijzigen({ pad, waarde }) {
      const m = sessie().model
      const gekozen = (m?.varianten || []).find(x => x.id === m?.gekozenId)
      if (!gekozen) return { ok: false, fout: 'kies eerst een variant, dan kunnen we aanpassen' }
      const regel = WIJZIGBAAR[pad]
      if (!regel) {
        return { ok: false, fout: 'dit is niet aan te passen; wel: ' + Object.entries(WIJZIGBAAR).map(([p, r]) => p + ' (' + r.naam + ')').join(', ') }
      }
      const params = structuredClone(gekozen.params)
      if (regel.cat) {
        const matId = typeof waarde === 'string' ? waarde : waarde?.mat
        const def = MATERIALEN[matId]
        if (!def || def.cat !== regel.cat) {
          const keuzes = Object.entries(MATERIALEN).filter(([, d]) => d.cat === regel.cat).map(([id]) => id)
          return { ok: false, fout: 'onbekend ' + regel.naam + '; kies uit: ' + keuzes.join(', ') }
        }
        const kleur = (typeof waarde === 'object' && waarde?.kleur && def.kleuren.some(k => k.id === waarde.kleur))
          ? waarde.kleur : def.kleuren[0].id
        const doel = pad.split('.')[1]
        params.materialen[doel] = { mat: matId, kleur }
        if (doel === 'accent') params.materialen.accent.forceer = true
      } else {
        const getal = Number(waarde)
        if (!Number.isFinite(getal)) return { ok: false, fout: regel.naam + ' moet een getal zijn' }
        const max = typeof regel.max === 'function' ? regel.max(m.prog) : regel.max
        if (getal < regel.min || getal > max) {
          return { ok: false, fout: regel.naam + ' moet tussen ' + regel.min + ' en ' + max + ' ' + regel.eenheid + ' liggen (bouwregels)' }
        }
        if (regel.nietPlat && params.volume.plat) {
          return { ok: false, fout: 'dit model heeft een plat dak; een dakhelling is er niet' }
        }
        const [a, b] = pad.split('.')
        params[a][b] = getal
      }
      // door het bouwvlak en de wetten; wat faalt, komt er niet in
      const voet = params.volume.b * params.volume.d
      if (voet > (m.prog?.bouwvlak || Infinity) + .5) {
        return { ok: false, fout: 'dan wordt de voetafdruk ' + Math.round(voet) + ' m2 en dat past niet in het bouwvlak van ' + m.prog.bouwvlak + ' m2' }
      }
      let gebouwd, fouten
      try {
        gebouwd = bouwModel(params)
        fouten = valideerModel(gebouwd)
        if (fouten.length) { gebouwd = repareerModel(gebouwd); fouten = valideerModel(gebouwd) }
      } catch (e) {
        return { ok: false, fout: 'deze wijziging komt niet door de bouwregels (' + String(e.message || e) + ')' }
      }
      if (fouten.length) {
        return { ok: false, fout: 'deze wijziging komt niet door de bouwregels: ' + fouten.slice(0, 2).join('; ') }
      }
      const nieuweVarianten = m.varianten.map(v => (v.id === gekozen.id ? {
        ...v, params,
        voet: Math.round(voet),
        goot: Math.max(...gebouwd.volumes.map(x => x.goot)),
        nok: Math.max(...gebouwd.volumes.map(x => x.nok)),
        helling: Math.round(params.volume.helling || 0),
      } : v))
      const wijziging = { pad, waarde, om: new Date().toISOString() }
      const model = { ...m, varianten: nieuweVarianten, wijzigingen: [...(m.wijzigingen || []), wijziging] }
      await zet({ model })
      signaal('model', model)
      const na = nieuweVarianten.find(v => v.id === gekozen.id)
      return {
        ok: true, gewijzigd: regel.naam, waarde,
        resultaat: { voet: na.voet, goot: Number(na.goot.toFixed(1)), nok: Number(na.nok.toFixed(1)) },
      }
    },
  }

  return {
    async voerUit(naam, args) {
      const f = uitvoerders[naam]
      if (!f) return { ok: false, fout: 'onbekende functie ' + naam }
      try { return await f(args || {}) } catch (e) {
        return { ok: false, fout: String(e.message || e) }
      }
    },
  }
}
