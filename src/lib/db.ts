import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

let _prisma: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (_prisma) return _prisma;
  const dbPath = process.env.DATABASE_URL?.replace(/^file:/, '') ?? './data/dev.db';
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  _prisma = new PrismaClient({ adapter });
  return _prisma;
}
