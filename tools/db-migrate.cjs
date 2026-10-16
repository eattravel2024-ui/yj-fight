#!/usr/bin/env node
'use strict';

const { createDatabase } = require('../server/db');

async function main() {
  let database;
  try {
    database = createDatabase();
    const applied = await database.migrate();
    console.log(applied.length ? `Applied migrations: ${applied.join(', ')}` : 'Database schema is current.');
  } catch (error) {
    // Connection strings can contain credentials. Never log config or arbitrary
    // server-provided SQL detail fields here.
    console.error(`Database migration failed: ${error.code || error.message}`);
    process.exitCode = 1;
  } finally {
    if (database) await database.close();
  }
}

if (require.main === module) main();
module.exports = { main };
