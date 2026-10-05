/**
 * Builds a disposable test database before the suite runs.
 *
 * Tests must never touch the development database. Real Member State returns
 * are institutional records, and a test that deletes rows it did not create is
 * exactly the hazard that destroyed a draft during development. So the suite
 * creates its own database, migrates it, seeds the reference data, and points
 * DATABASE_URL at it for the duration of the run.
 *
 * The database is dropped and recreated on every run, so no test can inherit
 * state from a previous one.
 */
import 'dotenv/config';
import { execSync } from 'node:child_process';
import { Client } from 'pg';

const TEST_DB = 'stisa_test';

function baseUrl(): URL {
  const raw = process.env.DATABASE_URL;
  if (!raw) throw new Error('DATABASE_URL is not set.');
  return new URL(raw);
}

export async function setup() {
  const url = baseUrl();

  if (url.pathname.replace('/', '') === TEST_DB) {
    throw new Error(`DATABASE_URL already points at ${TEST_DB}; refusing to recurse.`);
  }

  // Connect to the maintenance database to create/drop the test one.
  const admin = new URL(url.toString());
  admin.pathname = '/postgres';

  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    // Terminate stragglers so DROP cannot block on an idle connection.
    await client.query(
      `select pg_terminate_backend(pid) from pg_stat_activity where datname = $1 and pid <> pg_backend_pid()`,
      [TEST_DB],
    );
    await client.query(`drop database if exists ${TEST_DB}`);
    await client.query(`create database ${TEST_DB}`);
  } finally {
    await client.end();
  }

  const testUrl = new URL(url.toString());
  testUrl.pathname = `/${TEST_DB}`;
  const testDatabaseUrl = testUrl.toString();

  const env = { ...process.env, DATABASE_URL: testDatabaseUrl };
  execSync('npx prisma migrate deploy', { env, stdio: 'pipe' });
  execSync('npx tsx prisma/seed.ts', { env, stdio: 'pipe' });

  // Every test file inherits this.
  process.env.DATABASE_URL = testDatabaseUrl;
  process.env.TEST_DATABASE_URL = testDatabaseUrl;

  return () => {
    // Left in place after the run so a failure can be inspected. The next run
    // drops it.
  };
}
