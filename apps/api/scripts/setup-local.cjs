const { existsSync, readFileSync, writeFileSync } = require('node:fs');
const { randomBytes } = require('node:crypto');
const { resolve } = require('node:path');
const target = resolve(__dirname, '../.env');
if (existsSync(target)) {
  console.log('.env ya existe; se conservó sin cambios.');
} else {
  const password = randomBytes(24).toString('hex');
  const secret = randomBytes(48).toString('hex');
  const template = readFileSync(resolve(__dirname, '../.env.example'), 'utf8');
  writeFileSync(
    target,
    template
      .replaceAll('CHANGE_DATABASE_PASSWORD', password)
      .replaceAll('CHANGE_JWT_SECRET', secret),
    { mode: 0o600, flag: 'wx' },
  );
  console.log('.env local creado con secretos aleatorios. No lo subas a Git.');
}
