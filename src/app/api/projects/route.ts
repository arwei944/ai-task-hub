// ============================================================
// Projects REST API
// ============================================================

import { NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

export const dynamic = 'force-dynamic';

function getPrisma() {
  const dbPath = process.env.DATABASE_URL?.replace(/^file:/, '') ?? './prisma/dev.db';
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  return new PrismaClient({ adapter });
}

// GET /api/projects
export async function GET() {
  try {
    const prisma = getPrisma();
    const projects = await prisma.project.findMany({
      orderBy: { updatedAt: 'desc' },
      include: {
        _count: { select: { tasks: true, activities: true } },
        creator: { select: { id: true, name: true, clientType: true } },
      },
    });
    await prisma.$disconnect();
    return NextResponse.json({ projects });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
