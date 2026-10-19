'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const crypto = require('node:crypto');
const { createDatabase } = require('../server/db');

function fakePool({ fail = () => false, applied = [] } = {}) {
  const calls = [];
  const releases = [];
  const client = {
    async query(sql, params) {
      calls.push({ sql, params });
      if (fail(sql, params)) throw Object.assign(new Error('deliberate query failure'), { code: 'TEST_FAILURE' });
      return { rows: sql.startsWith('SELECT version, checksum') ? applied : [], rowCount: 0 };
    },
    release(discard) { releases.push(discard); },
  };
  return { calls, releases, connect: async () => client, query: (...args) => client.query(...args), end: async () => {} };
}

test('database configuration requires an explicit persistent connection', () => {
  assert.throws(() => createDatabase({ connectionString: '' }), /DATABASE_URL is required/);
});

test('transactions commit only after the callback succeeds and release the client', async () => {
  const pool = fakePool();
  const db = createDatabase({ pool });
  const result = await db.transaction(async client => {
    await client.query('SELECT $1::int AS value', [42]);
    return 42;
  });
  assert.equal(result, 42);
  assert.deepEqual(pool.calls.map(call => call.sql), ['BEGIN', 'SELECT $1::int AS value', 'COMMIT']);
  assert.deepEqual(pool.releases, [false]);
});

test('failed transactions roll back, preserve the original error and discard a broken socket', async () => {
  for (const brokenRollback of [false, true]) {
    const pool = fakePool({ fail: sql => brokenRollback && sql === 'ROLLBACK' });
    const db = createDatabase({ pool });
    const cause = new Error('domain operation rejected');
    await assert.rejects(db.transaction(async () => { throw cause; }), error => error === cause);
    assert.deepEqual(pool.calls.map(call => call.sql), ['BEGIN', 'ROLLBACK']);
    assert.deepEqual(pool.releases, [brokenRollback]);
  }
});

test('migrations lock a dedicated connection, use transactions and reject edited applied SQL', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'azhi-migration-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const file = '001_example.sql';
  const sql = 'CREATE TABLE migration_example (id INTEGER PRIMARY KEY);';
  await fs.writeFile(path.join(directory, file), sql);
  await fs.writeFile(path.join(directory, 'README.md'), 'ignored migration documentation');
  const checksum = crypto.createHash('sha256').update(sql).digest('hex');
  const pool = fakePool();
  assert.deepEqual(await createDatabase({ pool }).migrate({ directory }), [file]);
  assert.match(pool.calls[0].sql, /pg_advisory_lock/);
  const beginIndex = pool.calls.findIndex(call => call.sql === 'BEGIN');
  assert.equal(pool.calls[beginIndex + 1].sql, sql);
  assert.deepEqual(pool.calls[beginIndex + 2].params, [file, checksum]);
  assert.equal(pool.calls[beginIndex + 3].sql, 'COMMIT');
  assert.match(pool.calls.at(-1).sql, /pg_advisory_unlock/);
  assert.deepEqual(pool.releases, [false]);

  const alreadyApplied = fakePool({ applied: [{ version: file, checksum }] });
  assert.deepEqual(await createDatabase({ pool: alreadyApplied }).migrate({ directory }), []);
  assert.ok(!alreadyApplied.calls.some(call => call.sql === 'BEGIN'));
  await fs.appendFile(path.join(directory, file), '\n-- unexpected deployed edit');
  const edited = fakePool({ applied: [{ version: file, checksum }] });
  await assert.rejects(createDatabase({ pool: edited }).migrate({ directory }), /checksum changed/);
  assert.match(edited.calls.at(-1).sql, /pg_advisory_unlock/);
});

test('failed migrations roll back without recording their version and always release the migration lock', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'azhi-migration-failure-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  await fs.writeFile(path.join(directory, '001_broken.sql'), 'BROKEN SQL;');
  const pool = fakePool({ fail: sql => sql === 'BROKEN SQL;' });
  await assert.rejects(createDatabase({ pool }).migrate({ directory }), /deliberate query failure/);
  assert.ok(pool.calls.some(call => call.sql === 'ROLLBACK'));
  assert.ok(!pool.calls.some(call => call.sql.startsWith('INSERT INTO schema_migrations')));
  assert.match(pool.calls.at(-1).sql, /pg_advisory_unlock/);
  assert.deepEqual(pool.releases, [false]);
});

test('migration unlock failure destroys its pooled connection', async t => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'azhi-migration-unlock-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  const pool = fakePool({ fail: sql => sql.includes('pg_advisory_unlock') });
  assert.deepEqual(await createDatabase({ pool }).migrate({ directory }), []);
  assert.deepEqual(pool.releases, [true]);
});

test('real PostgreSQL enforces persistent identity, active-match uniqueness and atomic rollback', {
  skip: !process.env.AZHI_TEST_DATABASE_URL && 'Set AZHI_TEST_DATABASE_URL to an isolated PostgreSQL database',
}, async t => {
  const connectionString = process.env.AZHI_TEST_DATABASE_URL;
  const { Pool } = require('pg');
  const admin = new Pool({ connectionString });
  const schema = `azhi_db_test_${crypto.randomBytes(8).toString('hex')}`;
  await admin.query(`CREATE SCHEMA ${schema}`);
  const pool = new Pool({ connectionString, options: `-csearch_path=${schema}` });
  const db = createDatabase({ pool });
  t.after(async () => {
    await db.close();
    await admin.query(`DROP SCHEMA ${schema} CASCADE`);
    await admin.end();
  });
  const applied = await db.migrate();
  assert.deepEqual(applied, ['001_player_accounts_and_competition.sql','002_casual_skill.sql','003_username_recovery.sql','004_custom_player_avatars.sql']);
  assert.deepEqual(await db.migrate(), []);
  const season = (await db.query('SELECT * FROM seasons WHERE id=$1', ['season-01'])).rows[0];
  assert.equal(season.status, 'draft');
  assert.equal(season.starts_at, null);
  assert.equal(season.ends_at, null);

  const ids = [crypto.randomUUID(), crypto.randomUUID()];
  for (let i = 0; i < ids.length; i++) {
    await db.query('INSERT INTO users (id,username,password_hash,display_name) VALUES ($1,$2,$3,$4)', [ids[i], `player${i}`, '$argon2id$test-encoded-password', `玩家${i}`]);
  }
  await assert.rejects(db.query('INSERT INTO users (id,username,display_name) VALUES ($1,$2,$3)', [crypto.randomUUID(), 'PLAYER0', '另位玩家']), error => error.code === '23514');
  await assert.rejects(db.query('INSERT INTO users (id,username,display_name) VALUES ($1,$2,$3)', [crypto.randomUUID(), 'player0', '另位玩家']), error => error.code === '23505');
  await assert.rejects(db.query('UPDATE users SET avatar=$1 WHERE id=$2', ['untrusted-external-url', ids[0]]), error => error.code === '23514');
  await db.query(`INSERT INTO matches(id,mode,stage) VALUES ('match-a','quick','night'),('match-b','quick','garage')`);
  for (const match of ['match-a', 'match-b']) {
    await db.query('INSERT INTO match_participants(match_id,user_id,slot,character_id) VALUES ($1,$2,0,$3)', [match, ids[0], 'azhi']);
  }
  await db.query('INSERT INTO active_match_users(user_id,match_id) VALUES ($1,$2)', [ids[0], 'match-a']);
  await assert.rejects(db.query('INSERT INTO active_match_users(user_id,match_id) VALUES ($1,$2)', [ids[0], 'match-b']), error => error.code === '23505');
  await assert.rejects(db.query('INSERT INTO active_match_users(user_id,match_id) VALUES ($1,$2)', [ids[1], 'match-b']), error => error.code === '23503');
  await assert.rejects(db.transaction(async client => {
    await client.query('UPDATE users SET display_name=$1 WHERE id=$2', ['不得保存', ids[0]]);
    await client.query("UPDATE matches SET status='completed' WHERE id='match-a'");
  }), error => error.code === '23514');
  assert.equal((await db.query('SELECT display_name FROM users WHERE id=$1', [ids[0]])).rows[0].display_name, '玩家0');

  // The source of persistence is PostgreSQL, rather than this JavaScript object.
  const secondDb = createDatabase({ pool: new Pool({ connectionString, options: `-csearch_path=${schema}` }) });
  try {
    assert.equal((await secondDb.query('SELECT count(*)::int AS total FROM users')).rows[0].total, 2);
  } finally { await secondDb.close(); }

  const brokenDirectory = await fs.mkdtemp(path.join(os.tmpdir(), 'azhi-real-failed-migration-'));
  t.after(() => fs.rm(brokenDirectory, { recursive: true, force: true }));
  for(const file of applied)await fs.copyFile(path.join(__dirname,'..','server','migrations',file),path.join(brokenDirectory,file));
  await fs.writeFile(path.join(brokenDirectory, '004_atomic_failure.sql'), 'CREATE TABLE should_not_exist(id INT); SELECT * FROM nonexistent_migration_table;');
  await assert.rejects(db.migrate({ directory: brokenDirectory }), error => error.code === '42P01');
  assert.equal((await db.query("SELECT to_regclass('should_not_exist') AS value")).rows[0].value, null);
  assert.equal((await db.query('SELECT count(*)::int AS total FROM schema_migrations')).rows[0].total, applied.length);
} );
