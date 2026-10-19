'use strict';

// Run in the staged release before stopping the existing service. No network,
// database, SMTP, OAuth credentials or production state are accessed here.
async function main() {
  if (Number(process.versions.node.split('.')[0]) < 20) throw new Error('Node.js 20+ required');
  require('ws');
  const { Pool } = require('pg');
  const { hash, verify, Algorithm } = require('@node-rs/argon2');
  if ([Pool, hash, verify].some(value => typeof value !== 'function')) {
    throw new Error('A runtime dependency does not expose the expected API');
  }
  const probe = 'azhi71-local-native-runtime-check';
  const encoded = await hash(probe, { algorithm: Algorithm.Argon2id, memoryCost: 8192, timeCost: 1, parallelism: 1 });
  if (!encoded.startsWith('$argon2id$') || !await verify(encoded, probe)) throw new Error('Argon2id runtime verification failed');
  const sharp = require('sharp');
  const avatar = await sharp({ create: { width: 256, height: 256, channels: 3, background: '#00d5e8' } }).webp().toBuffer();
  if ((await sharp(avatar).metadata()).format !== 'webp') throw new Error('Avatar WebP codec verification failed');
  process.stdout.write('Runtime dependencies, Argon2id and avatar WebP codec: OK\n');
}

main().catch(error => {
  process.stderr.write(`Runtime dependency preflight failed: ${error.code || error.name}\n`);
  process.exitCode = 1;
});
