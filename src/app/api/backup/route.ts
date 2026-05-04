// ============================================================
// Data Backup API Route
// ============================================================
//
// GET  /api/backup - Export all data as JSON
// POST /api/backup - Import data from JSON
//

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

// Maximum backup file size: 50MB
const MAX_BACKUP_SIZE = 50 * 1024 * 1024;
// Allowed tables for import (prevent injection of arbitrary table names)
const ALLOWED_TABLES = new Set([
  'User', 'Task', 'TaskDependency', 'TaskHistory', 'TaskTag',
  'Tag', 'AIAuditLog', 'Agent', 'AgentOperationLog',
  'Notification', 'NotificationChannel',
  'Deployment', 'Plugin',
]);

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
export async function GET(request: Request) {
  try {
    // Auth check
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }

    const prisma = getPrisma();
    const backup: Record<string, unknown[]> = {};
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');

    // Query all tables in parallel
    const tableResults = await Promise.all(
      TABLES.map(async (table) => {
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const records = await (prisma as any)[table.charAt(0).toLowerCase() + table.slice(1)].findMany();
          return {
            table,
            records: records.map((r: any) => {
              const { _count, ...rest } = r;
              return rest;
            }),
          };
        } catch {
          return { table, records: [] };
        }
      }),
    );

    for (const { table, records } of tableResults) {
      backup[table] = records;
    }

    await prisma.$disconnect();

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
    // Auth check
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { success: false, error: 'Authentication required' },
        { status: 401 },
      );
    }

    const body = await request.json();
    const { data } = body as { data: Record<string, unknown[]> };

    if (!data || typeof data !== 'object') {
      return NextResponse.json(
        { success: false, error: 'Invalid data format. Expected { data: { TableName: [...] } }' },
        { status: 400 },
      );
    }

    // Validate table names to prevent injection
    const tableNames = Object.keys(data);
    const invalidTables = tableNames.filter(t => !ALLOWED_TABLES.has(t));
    if (invalidTables.length > 0) {
      return NextResponse.json(
        { success: false, error: `Unknown tables not allowed: ${invalidTables.join(', ')}` },
        { status: 400 },
      );
    }

    // Validate total data size
    const dataSize = JSON.stringify(data).length;
    if (dataSize > MAX_BACKUP_SIZE) {
      return NextResponse.json(
        { success: false, error: `Backup data too large: ${(dataSize / 1024 / 1024).toFixed(1)}MB (max ${MAX_BACKUP_SIZE / 1024 / 1024}MB)` },
        { status: 413 },
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
