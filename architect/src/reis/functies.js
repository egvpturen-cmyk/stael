// Uitvoerder van de function calls van de Architect: elke call wordt
// een controleerbare mutatie op het sessie-object (via de API) plus een
// optioneel UI-signaal. De state is leidend; wat hier niet door de
// bewaking komt, gebeurt niet. Puur JavaScript zonder React, zodat de
// gesprekstest hem in node kan draaien.
import { sessiePatch } from './api.js'
import { COLLECTIE } from './collectie.js'

export function maakFuncties({ token, sessieRef, opUiSignaal }) {
  const sessie = () => sessieRef.huidige
  const zet = async updates => {
    const { sessie: nieuw } = await sessiePatch(token, updates)
    sessieRef.huidige = nieuw
    return nieuw
  }
  const signaal = (naam, data) => { if (opUiSignaal) opUiSignaal(naam, data) }

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
