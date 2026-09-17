// Opslag voor de Live Architect API: Railway Postgres wanneer
// DATABASE_URL gezet is, anders een bestandsstore (lokale ontwikkeling
// en tests). Beide implementaties bieden hetzelfde kleine contract:
//   sessieMaak(token, data), sessieLees(token),
//   sessieSchrijf(token, data), verbruikVandaag(), verbruikTel(minuten)
import fs from 'fs'
import path from 'path'

const dagVanVandaag = () => new Date().toISOString().slice(0, 10)

// ---- bestandsstore ----
function bestandsStore(map) {
  fs.mkdirSync(path.join(map, 'sessies'), { recursive: true })
  const sessiePad = token => path.join(map, 'sessies', token.replace(/[^A-Za-z0-9_-]/g, '') + '.json')
  const verbruikPad = path.join(map, 'stemverbruik.json')
  const leesVerbruik = () => {
    try { return JSON.parse(fs.readFileSync(verbruikPad, 'utf8')) } catch { return {} }
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
  }
}

export async function maakOpslag() {
  if (process.env.DATABASE_URL) return postgresStore(process.env.DATABASE_URL)
  const map = process.env.OPSLAG_PAD || path.join(process.cwd(), '.data')
  return bestandsStore(map)
}
