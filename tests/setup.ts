/**
 * Runs in every test worker. globalSetup already created and migrated the test
 * database and exported its URL; this makes sure the worker uses it.
 */
import 'dotenv/config';

if (process.env.TEST_DATABASE_URL) {
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
}

if (!process.env.DATABASE_URL?.includes('stisa_test')) {
  throw new Error(
    `Refusing to run tests against ${process.env.DATABASE_URL ?? '(unset)'} — ` +
      'the suite must only ever touch the disposable stisa_test database.',
  );
}
