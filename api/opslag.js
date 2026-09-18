// Opslag voor de Live Architect API: Railway Postgres wanneer
// DATABASE_URL gezet is, anders een bestandsstore (lokale ontwikkeling
// en tests). Beide implementaties bieden hetzelfde kleine contract:
//   sessieMaak(token, data), sessieLees(token), sessieSchrijf(token, data)
//   verbruikVandaag(), verbruikTel(minuten)          afgerekend archief
//   uitgifteMaak({sessieToken, gereserveerdMin})     een tokenuitgifte
//   uitgifteHartslag(id), uitgifteEinde(id)          leven en afrekenen
//   uitgiftenVandaag()                               audittrail van vandaag
//
// De eerlijke telling: bij de start wordt de maximale duur
// gereserveerd (bescherming), bij het einde wordt afgerekend op de
// werkelijke duur en gaat het restant terug. Een weggevallen
// verbinding verloopt via de hartslag: blijft die uit, dan wordt de
// uitgifte afgerekend op de laatst geziene hartslag in plaats van de
// volle reservering vast te houden.
import fs from 'fs'
import path from 'path'
import crypto from 'crypto'

const dagVanVandaag = () => new Date().toISOString().slice(0, 10)
const HARTSLAG_VERLOOP_MS = parseInt(process.env.STEM_HARTSLAG_VERLOOP_MS || '180000', 10)

const minutenTussen = (start, einde) =>
  Math.max(1, Math.ceil((new Date(einde) - new Date(start)) / 60000))

// rekent een uitgifte af op werkelijke duur (tot `tot`), geklemd op de
// reservering; retourneert de verbruikte minuten
function rekenAf(u, tot) {
  return Math.min(u.gereserveerdMin, minutenTussen(u.startOm, tot))
}

// ---- bestandsstore ----
function bestandsStore(map) {
  fs.mkdirSync(path.join(map, 'sessies'), { recursive: true })
  const sessiePad = token => path.join(map, 'sessies', token.replace(/[^A-Za-z0-9_-]/g, '') + '.json')
  const verbruikPad = path.join(map, 'stemverbruik.json')
  const uitgiftenPad = path.join(map, 'stemuitgiften.json')
  const leesVerbruik = () => {
    try { return JSON.parse(fs.readFileSync(verbruikPad, 'utf8')) } catch { return {} }
  }
  const leesUitgiften = () => {
    try { return JSON.parse(fs.readFileSync(uitgiftenPad, 'utf8')) } catch { return [] }
  }
  return {
    soort: 'bestand',
    async sessieMaak(token, data) {
      fs.writeFileSync(sessiePad(token), JSON.stringify(data))
    },
    async sessieLees(token) {
      try { return JSON.parse(fs.readFileSync(sessiePad(token), 'utf8')) } catch { return null }
    },
    async sessieSchrijf(token, data) {
      fs.writeFileSync(sessiePad(token), JSON.stringify(data))
    },
    async verbruikVandaag() {
      return leesVerbruik()[dagVanVandaag()] || 0
    },
    async verbruikTel(minuten) {
      const v = leesVerbruik()
      const dag = dagVanVandaag()
      v[dag] = (v[dag] || 0) + minuten
      fs.writeFileSync(verbruikPad, JSON.stringify(v))
      return v[dag]
    },
    async uitgifteMaak({ sessieToken, gereserveerdMin }) {
      const u = leesUitgiften()
      const id = crypto.randomBytes(8).toString('base64url')
      const nu = new Date().toISOString()
      u.push({ id, dag: dagVanVandaag(), sessieToken, startOm: nu, gereserveerdMin, verbruiktMin: null, hartslagOm: nu })
      fs.writeFileSync(uitgiftenPad, JSON.stringify(u))
      return { id }
    },
    async uitgifteHartslag(id) {
      const u = leesUitgiften()
      const rij = u.find(x => x.id === id)
      if (!rij) return false
      rij.hartslagOm = new Date().toISOString()
      fs.writeFileSync(uitgiftenPad, JSON.stringify(u))
      return true
    },
    async uitgifteEinde(id) {
      const u = leesUitgiften()
      const rij = u.find(x => x.id === id)
      if (!rij) return null
      if (rij.verbruiktMin == null) {
        rij.verbruiktMin = rekenAf(rij, new Date().toISOString())
        fs.writeFileSync(uitgiftenPad, JSON.stringify(u))
        await this.verbruikTel(rij.verbruiktMin)
      }
      return { verbruiktMin: rij.verbruiktMin }
    },
    // verlopen actieve uitgiften (hartslag te oud) afrekenen op de
    // laatst geziene hartslag, en de actuele reservering teruggeven
    async ruimOpEnReserveerd() {
      const u = leesUitgiften()
      const nu = Date.now()
      let gereserveerd = 0
      let geschreven = false
      for (const rij of u) {
        if (rij.verbruiktMin != null || rij.dag !== dagVanVandaag()) continue
        if (nu - new Date(rij.hartslagOm) > HARTSLAG_VERLOOP_MS) {
          rij.verbruiktMin = rekenAf(rij, rij.hartslagOm)
          await this.verbruikTel(rij.verbruiktMin)
          geschreven = true
        } else {
          gereserveerd += rij.gereserveerdMin
        }
      }
      if (geschreven) fs.writeFileSync(uitgiftenPad, JSON.stringify(u))
      return gereserveerd
    },
    async uitgiftenVandaag() {
      return leesUitgiften().filter(x => x.dag === dagVanVandaag())
    },
  }
}

// ---- Postgres ----
async function postgresStore(url) {
  const { default: pg } = await import('pg')
  const pool = new pg.Pool({ connectionString: url, ssl: url.includes('railway') ? { rejectUnauthorized: false } : undefined })
  await pool.query(`
    CREATE TABLE IF NOT EXISTS sessies (
      token TEXT PRIMARY KEY,
      data JSONB NOT NULL,
      gemaakt TIMESTAMPTZ NOT NULL DEFAULT now(),
      bijgewerkt TIMESTAMPTZ NOT NULL DEFAULT now()
    );
    CREATE TABLE IF NOT EXISTS stemverbruik (
      dag DATE PRIMARY KEY,
      minuten INTEGER NOT NULL DEFAULT 0
    );
    CREATE TABLE IF NOT EXISTS stemuitgiften (
      id TEXT PRIMARY KEY,
      dag DATE NOT NULL,
      sessie_token TEXT,
      start_om TIMESTAMPTZ NOT NULL DEFAULT now(),
      gereserveerd_min INTEGER NOT NULL,
      verbruikt_min INTEGER,
      hartslag_om TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `)
  return {
    soort: 'postgres',
    async sessieMaak(token, data) {
      await pool.query('INSERT INTO sessies (token, data) VALUES ($1, $2)', [token, data])
    },
    async sessieLees(token) {
      const r = await pool.query('SELECT data FROM sessies WHERE token = $1', [token])
      return r.rows[0]?.data || null
    },
    async sessieSchrijf(token, data) {
      await pool.query('UPDATE sessies SET data = $2, bijgewerkt = now() WHERE token = $1', [token, data])
    },
    async verbruikVandaag() {
      const r = await pool.query('SELECT minuten FROM stemverbruik WHERE dag = $1', [dagVanVandaag()])
      return r.rows[0]?.minuten || 0
    },
    async verbruikTel(minuten) {
      const r = await pool.query(`
        INSERT INTO stemverbruik (dag, minuten) VALUES ($1, $2)
        ON CONFLICT (dag) DO UPDATE SET minuten = stemverbruik.minuten + $2
        RETURNING minuten
      `, [dagVanVandaag(), minuten])
      return r.rows[0].minuten
    },
    async uitgifteMaak({ sessieToken, gereserveerdMin }) {
      const id = crypto.randomBytes(8).toString('base64url')
      await pool.query(
        'INSERT INTO stemuitgiften (id, dag, sessie_token, gereserveerd_min) VALUES ($1, $2, $3, $4)',
        [id, dagVanVandaag(), sessieToken, gereserveerdMin])
      return { id }
    },
    async uitgifteHartslag(id) {
      const r = await pool.query('UPDATE stemuitgiften SET hartslag_om = now() WHERE id = $1', [id])
      return r.rowCount > 0
    },
    async uitgifteEinde(id) {
      const r = await pool.query('SELECT * FROM stemuitgiften WHERE id = $1', [id])
      const rij = r.rows[0]
      if (!rij) return null
      if (rij.verbruikt_min == null) {
        const verbruikt = Math.min(rij.gereserveerd_min, minutenTussen(rij.start_om, new Date().toISOString()))
        await pool.query('UPDATE stemuitgiften SET verbruikt_min = $2 WHERE id = $1', [id, verbruikt])
        await this.verbruikTel(verbruikt)
        return { verbruiktMin: verbruikt }
      }
      return { verbruiktMin: rij.verbruikt_min }
    },
    async ruimOpEnReserveerd() {
      // verlopen actieve uitgiften afrekenen op de laatste hartslag
      const verlopen = await pool.query(`
        UPDATE stemuitgiften
        SET verbruikt_min = LEAST(gereserveerd_min,
          GREATEST(1, CEIL(EXTRACT(EPOCH FROM (hartslag_om - start_om)) / 60)::int))
        WHERE verbruikt_min IS NULL AND dag = $1 AND hartslag_om < now() - ($2 || ' milliseconds')::interval
        RETURNING verbruikt_min
      `, [dagVanVandaag(), String(HARTSLAG_VERLOOP_MS)])
      for (const rij of verlopen.rows) await this.verbruikTel(rij.verbruikt_min)
      const actief = await pool.query(
        'SELECT COALESCE(SUM(gereserveerd_min), 0) AS som FROM stemuitgiften WHERE verbruikt_min IS NULL AND dag = $1',
        [dagVanVandaag()])
      return Number(actief.rows[0].som)
    },
    async uitgiftenVandaag() {
      const r = await pool.query('SELECT * FROM stemuitgiften WHERE dag = $1 ORDER BY start_om', [dagVanVandaag()])
      return r.rows.map(x => ({
        id: x.id, dag: String(x.dag).slice(0, 10), sessieToken: x.sessie_token,
        startOm: x.start_om, gereserveerdMin: x.gereserveerd_min,
        verbruiktMin: x.verbruikt_min, hartslagOm: x.hartslag_om,
      }))
    },
  }
}

export async function maakOpslag() {
  if (process.env.DATABASE_URL) return postgresStore(process.env.DATABASE_URL)
  const map = process.env.OPSLAG_PAD || path.join(process.cwd(), '.data')
  return bestandsStore(map)
}
