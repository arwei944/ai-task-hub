import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import os from 'os';
import path from 'path';
import fs from 'fs';

const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS "Task" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "title" TEXT NOT NULL,
  "description" TEXT,
  "status" TEXT NOT NULL DEFAULT 'todo',
  "priority" TEXT NOT NULL DEFAULT 'medium',
  "progress" INTEGER NOT NULL DEFAULT 0,
  "type" TEXT NOT NULL DEFAULT 'general',
  "phase" TEXT NOT NULL DEFAULT 'implementation',
  "source" TEXT NOT NULL DEFAULT 'manual',
  "sourceRef" TEXT,
  "assignee" TEXT,
  "creator" TEXT,
  "parentTaskId" TEXT,
  "projectId" TEXT,
  "dueDate" DATETIME,
  "startedAt" DATETIME,
  "completedAt" DATETIME,
  "metadata" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE TABLE IF NOT EXISTS "TaskDependency" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "taskId" TEXT NOT NULL,
  "dependsOnId" TEXT NOT NULL,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "TaskHistory" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "taskId" TEXT NOT NULL,
  "field" TEXT NOT NULL,
  "oldValue" TEXT,
  "newValue" TEXT,
  "actor" TEXT,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "Tag" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "name" TEXT NOT NULL,
  "color" TEXT NOT NULL DEFAULT '#6B7280',
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "TaskTag" (
  "taskId" TEXT NOT NULL,
  "tagId" TEXT NOT NULL,
  PRIMARY KEY ("taskId", "tagId")
);
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "username" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "displayName" TEXT,
  "role" TEXT NOT NULL DEFAULT 'user',
  "avatar" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT 1,
  "lastLoginAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
`;

export async function createTestPrisma(): Promise<PrismaClient> {
  // Use a temp file-based SQLite DB for proper table sharing
  const tmpFile = path.join(os.tmpdir(), `test-${Date.now()}-${Math.random().toString(36).slice(2)}.db`);
  const adapter = new PrismaBetterSqlite3({ url: tmpFile });
  const prisma = new PrismaClient({ adapter }) as any;

  // Create tables using executeRawUnsafe
  const statements = SCHEMA_SQL.split(';').map(s => s.trim()).filter(s => s.length > 0);
  for (const stmt of statements) {
    await prisma.$executeRawUnsafe(stmt);
  }

  // Store tmp file path for cleanup
  (prisma as any).__testDbPath = tmpFile;

  return prisma;
}

export async function cleanupTestPrisma(prisma: any): Promise<void> {
  const dbPath = prisma.__testDbPath;
  if (dbPath && fs.existsSync(dbPath)) {
    try { fs.unlinkSync(dbPath); } catch {}
  }
  await prisma.$disconnect();
}

export async function cleanDatabase(prisma: any): Promise<void> {
  await prisma.$executeRawUnsafe(`DELETE FROM "TaskTag"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "TaskHistory"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "TaskDependency"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Task"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "Tag"`);
  await prisma.$executeRawUnsafe(`DELETE FROM "User"`);
}
