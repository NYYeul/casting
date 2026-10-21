import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

if (process.env.DEMO_MODE === 'true') {
  process.env.DEMO_BUILD = 'true';
  process.env.SEED_DEMO = 'true';
  const directory = join(process.cwd(), '.demo');
  mkdirSync(directory, { recursive: true });
  for (const suffix of ['', '-wal', '-shm']) {
    rmSync(join(directory, `casting.sqlite${suffix}`), { force: true });
  }
  const { db } = await import('../src/lib/db');
  const connection = db();
  connection.exec('PRAGMA wal_checkpoint(TRUNCATE)');
  const result = connection.prepare('SELECT COUNT(*) AS count FROM users').get();
  connection.close();
  console.log('Prepared sample database:', result);
}
