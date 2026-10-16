'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');

const MIGRATIONS_PATH = path.join(__dirname, 'migrations');
// One connection holds this lock through the complete migration run. A second
// application process must wait, then reread schema_migrations before applying.
const MIGRATION_LOCK = '657439182042781';

function createDatabase({ connectionString = process.env.DATABASE_URL, pool: suppliedPool } = {}) {
  if (!suppliedPool && (!connectionString || typeof connectionString !== 'string')) {
    throw new Error('DATABASE_URL is required for persistent player accounts');
  }
  const pool = suppliedPool || new (require('pg').Pool)({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
    application_name: 'azhi-player-service',
  });
  // An idle pool socket failure must not crash the game loop. Failed queries
  // still reject normally so account/match routes cannot report fake success.
  if (!suppliedPool) pool.on('error', err => console.error('[database] idle connection error:', err.code || err.name));

  async function transaction(fn) {
    const client = await pool.connect();
    let began = false;
    let discard = false;
    try {
      await client.query('BEGIN');
      began = true;
      const result = await fn(client);
      await client.query('COMMIT');
      return result;
    } catch (error) {
      if (began) {
        try { await client.query('ROLLBACK'); } catch (_) { discard = true; }
      }
      throw error;
    } finally {
      client.release(discard);
    }
  }

  async function migrate({ directory = MIGRATIONS_PATH } = {}) {
    const files = (await fs.readdir(directory)).filter(file => /^\d{3,}_[a-z0-9_-]+\.sql$/.test(file)).sort();
    const client = await pool.connect();
    let locked = false;
    try {
      await client.query('SELECT pg_advisory_lock($1::bigint)', [MIGRATION_LOCK]);
      locked = true;
      await client.query(`CREATE TABLE IF NOT EXISTS schema_migrations (
        version TEXT PRIMARY KEY,
        checksum TEXT NOT NULL,
        applied_at TIMESTAMPTZ NOT NULL DEFAULT clock_timestamp()
      )`);
      const applied = new Map((await client.query('SELECT version, checksum FROM schema_migrations ORDER BY version')).rows.map(row => [row.version, row.checksum]));
      for (const [version] of applied) {
        if (!files.includes(version)) throw new Error(`Applied migration is missing: ${version}`);
      }
      const newlyApplied = [];
      for (const file of files) {
        const sql = await fs.readFile(path.join(directory, file), 'utf8');
        const checksum = crypto.createHash('sha256').update(sql).digest('hex');
        if (applied.has(file)) {
          if (applied.get(file) !== checksum) throw new Error(`Applied migration checksum changed: ${file}`);
          continue;
        }
        await client.query('BEGIN');
        try {
          await client.query(sql);
          await client.query('INSERT INTO schema_migrations (version, checksum) VALUES ($1, $2)', [file, checksum]);
          await client.query('COMMIT');
          newlyApplied.push(file);
        } catch (error) {
          try { await client.query('ROLLBACK'); } catch (_) { /* Preserve the SQL error. */ }
          throw error;
        }
      }
      return newlyApplied;
    } finally {
      let unlockFailed = false;
      if (locked) {
        try { await client.query('SELECT pg_advisory_unlock($1::bigint)', [MIGRATION_LOCK]); }
        catch (_) { unlockFailed = true; }
      }
      // A failed unlock must discard the connection, never return a locked
      // session to the shared pool.
      client.release(unlockFailed);
    }
  }

  return { pool, query: (sql, params) => pool.query(sql, params), transaction, migrate, close: () => pool.end() };
}

module.exports = { createDatabase };
