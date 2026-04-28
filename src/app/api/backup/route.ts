// ============================================================
// Data Backup API Route
// ============================================================
//
// GET  /api/backup - Export all data as JSON
// POST /api/backup - Import data from JSON
//

import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

function getPrisma() {
  const dbPath = process.env.DATABASE_URL?.replace(/^file:/, '') ?? './prisma/dev.db';
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  return new PrismaClient({ adapter });
}

// Tables to export (in dependency order)
const TABLES = [
  'User', 'Task', 'TaskDependency', 'TaskHistory', 'TaskTag',
  'Tag', 'AIAuditLog', 'Agent', 'AgentOperationLog',
  'Notification', 'NotificationChannel',
  'Deployment', 'Plugin',
] as const;

/**
 * GET /api/backup - Export all data
 */
export async function GET() {
  try {
    const prisma = getPrisma();
    const backup: Record<string, unknown[]> = {};
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    for (const table of TABLES) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const records = await (prisma as any)[table.charAt(0).toLowerCase() + table.slice(1)].findMany();
        backup[table] = records.map((r: any) => {
          const { _count, ...rest } = r;
          return rest;
        });
      } catch {
        backup[table] = [];
      }
    }

    await prisma.$disconnect();

    // Save to file
    const backupDir = join(process.cwd(), 'backups');
    if (!existsSync(backupDir)) {
      mkdirSync(backupDir, { recursive: true });
    }
    const filePath = join(backupDir, `backup-${timestamp}.json`);
    writeFileSync(filePath, JSON.stringify(backup, null, 2));

    return NextResponse.json({
      success: true,
      tables: Object.keys(backup),
      recordCounts: Object.fromEntries(Object.entries(backup).map(([k, v]) => [k, v.length])),
      file: filePath,
      timestamp,
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}

/**
 * POST /api/backup - Import data
 * Body: { data: Record<string, any[]> }
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { data } = body as { data: Record<string, unknown[]> };

    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid data format. Expected { data: { TableName: [...] } }' },
        { status: 400 },
      );
    }

    const prisma = getPrisma();
    const results: Record<string, number> = {};

    for (const [table, records] of Object.entries(data)) {
      if (!Array.isArray(records)) continue;

      const modelName = table.charAt(0).toLowerCase() + table.slice(1);

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const model = (prisma as any)[modelName];
        if (!model || typeof model.createMany !== 'function') {
          results[table] = 0;
          continue;
        }

        // Clean records (remove id, timestamps for insert)
        const cleaned = records.map((r: any) => {
          const { id, createdAt, updatedAt, _count, ...rest } = r;
          return rest;
        }).filter((r: any) => Object.keys(r).length > 0);

        if (cleaned.length > 0) {
          await model.createMany({ data: cleaned, skipDuplicates: true });
        }

        results[table] = cleaned.length;
      } catch (error: any) {
        results[`${table}_error`] = error.message;
      }
    }

    await prisma.$disconnect();

    return NextResponse.json({
      success: true,
      imported: results,
      totalRecords: Object.values(results).reduce((sum, v) => sum + (typeof v === 'number' ? v : 0), 0),
    });
  } catch (error: any) {
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 },
    );
  }
}
