// ============================================================
// Projects REST API
// ============================================================

import { NextResponse } from 'next/server';
import { getPrisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

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
