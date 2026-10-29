require('dotenv').config({ quiet: true });
const { Client } = require('pg');
const { randomBytes } = require('node:crypto');
const { spawnSync } = require('node:child_process');
const assert = require('node:assert/strict');

(async () => {
  const name = 'hivibe_verify_' + randomBytes(6).toString('hex');
  const url = new URL(process.env.DATABASE_URL);
  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const admin = new Client({ connectionString: adminUrl.href });
  let created = false;
  try {
    await admin.connect();
    await admin.query('CREATE DATABASE "' + name + '"');
    created = true;
    url.pathname = '/' + name;
    for (let attempt = 0; attempt < 2; attempt++) {
      const result = spawnSync(
        process.execPath,
        ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
        {
          env: { ...process.env, DATABASE_URL: url.href },
          encoding: 'utf8',
          timeout: 60000,
        },
      );
      assert.equal(result.status, 0, 'migrate deploy falló en base aislada');
      if (attempt === 1) assert.match(result.stdout, /No pending migrations/);
    }
    const check = new Client({ connectionString: url.href });
    await check.connect();
    try {
      const migrations = await check.query(
        'SELECT count(*)::int AS count FROM "_prisma_migrations" WHERE finished_at IS NOT NULL',
      );
      assert.equal(migrations.rows[0].count, 5);
      const tables = await check.query(
        "SELECT count(*)::int AS count FROM information_schema.tables WHERE table_schema='public' AND table_name <> '_prisma_migrations'",
      );
      assert.equal(tables.rows[0].count, 9);
    } finally {
      await check.end();
    }
    console.log(
      'OK: cinco migraciones, nueve tablas y segunda ejecución sin pendientes en base vacía aislada.',
    );
  } finally {
    if (created) await admin.query('DROP DATABASE "' + name + '"');
    await admin.end();
  }
})().catch(() => {
  console.error(
    'Falló la comprobación de migraciones. Revisa PostgreSQL y .env.',
  );
  process.exitCode = 1;
});
