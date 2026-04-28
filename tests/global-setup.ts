import { execSync } from 'child_process';
import { join } from 'path';
import { mkdirSync, existsSync } from 'fs';

export default async function setup() {
  const testDbDir = join(process.cwd(), 'test-db');
  mkdirSync(testDbDir, { recursive: true });

  const dbPath = join(testDbDir, 'test-task-core.db');

  // If database exists, delete it to ensure clean schema
  if (existsSync(dbPath)) {
    const fs = await import('fs');
    fs.unlinkSync(dbPath);
  }

  // Push latest schema to test database
  execSync(`npx prisma db push --url "file:./test-db/test-task-core.db" --accept-data-loss 2>&1`, {
    stdio: 'inherit',
    cwd: process.cwd(),
  });

  console.log('Test database schema synced successfully');
}
