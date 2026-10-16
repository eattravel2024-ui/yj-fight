'use strict';

// Run in the staged release before stopping the existing service. No network,
// database, SMTP, OAuth credentials or production state are accessed here.
async function main() {
  if (Number(process.versions.node.split('.')[0]) < 20) throw new Error('Node.js 20+ required');
  require('ws');
  const { Pool } = require('pg');
  const { createTransport } = require('nodemailer');
  const { hash, verify, Algorithm } = require('@node-rs/argon2');
  const { jwtVerify, createRemoteJWKSet } = await import('jose');
  if ([Pool, createTransport, hash, verify, jwtVerify, createRemoteJWKSet].some(value => typeof value !== 'function')) {
    throw new Error('A runtime dependency does not expose the expected API');
  }
  const probe = 'azhi71-local-native-runtime-check';
  const encoded = await hash(probe, { algorithm: Algorithm.Argon2id, memoryCost: 8192, timeCost: 1, parallelism: 1 });
  if (!encoded.startsWith('$argon2id$') || !await verify(encoded, probe)) throw new Error('Argon2id runtime verification failed');
  process.stdout.write('Runtime dependencies and Argon2id native binary: OK\n');
}

main().catch(error => {
  process.stderr.write(`Runtime dependency preflight failed: ${error.code || error.name}\n`);
  process.exitCode = 1;
});
