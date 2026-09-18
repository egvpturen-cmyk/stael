// Uitvoerder van de function calls van de Architect: elke call wordt
// een controleerbare mutatie op het sessie-object (via de API) plus een
// optioneel UI-signaal. De state is leidend; wat hier niet door de
// bewaking komt, gebeurt niet. Puur JavaScript zonder React, zodat de
// gesprekstest hem in node kan draaien.
import { sessiePatch } from './api.js'
import { COLLECTIE } from './collectie.js'
import { zoekAdres, adresDetail, percelenRond } from './pdok.js'

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
      kavelBron = { adres: detail, percelen }
      signaal('kavelBron', kavelBron)
      return {
        ok: true, adres: detail.weergavenaam, aantalPercelen: percelen.length,
        percelen: percelen.map(p => ({ id: p.id, sectie: p.sectie, perceelnummer: p.perceelnummer, oppervlakte: p.oppervlakte })),
      }
    },

    async kavelKiezen({ perceelId }) {
      const p = kavelBron.percelen.find(x => x.id === String(perceelId))
      if (!p) return { ok: false, fout: 'onbekend perceel; zoek eerst het adres en wijs het perceel op de kaart aan' }
      const kavel = {
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
      return { ok: true, kavel: voorGesprek }
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
        if (!kavel || !kavel.perceelId) return { ok: false, fout: 'kies eerst het perceel op de kaart' }
        const programma = sessie().programma
        if (!programma || !programma.woonoppervlakte || !programma.slaapkamers) {
          return { ok: false, fout: 'leg eerst het programma vast (minstens woonoppervlakte en slaapkamers)' }
        }
      }
      signaal('stapAfgerond', { stap })
      return { ok: true, stap }
    },

    async naarStap({ stap }) {
      if (!Number.isInteger(stap) || stap < 0 || stap > 4) return { ok: false, fout: 'stap moet 0 tot 4 zijn' }
      await zet({ stap })
      signaal('stap', { stap })
      return { ok: true, stap }
    },

    // parameterWijzigen en setVerversen krijgen hun echte uitvoering in
    // onderdeel E (stap 3); tot die tijd melden ze eerlijk hun grens
    async parameterWijzigen() {
      return { ok: false, fout: 'aanpassen kan pas in stap 3 (modellen)' }
    },
    async setVerversen() {
      return { ok: false, fout: 'nieuwe sets kunnen pas in stap 3 (modellen)' }
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
