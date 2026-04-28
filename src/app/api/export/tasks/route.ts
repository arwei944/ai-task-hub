// ============================================================
// Data Export API Route
// ============================================================
//
// GET /api/export/tasks?format=csv|json
//

import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const format = searchParams.get('format') ?? 'json';
  const status = searchParams.get('status');
  const priority = searchParams.get('priority');
  const creator = searchParams.get('creator');
  const search = searchParams.get('search');

  try {
    const dbPath = process.env.DATABASE_URL?.replace(/^file:/, '') ?? './prisma/dev.db';
    const adapter = new PrismaBetterSqlite3({ url: dbPath });
    const prisma = new PrismaClient({ adapter });

    const where: any = { deletedAt: null };
    if (status) where.status = status;
    if (priority) where.priority = priority;
    if (creator) where.creator = creator;
    if (search) {
      where.OR = [
        { title: { contains: search } },
        { description: { contains: search } },
      ];
    }

    const tasks = await prisma.task.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      include: { tags: { include: { tag: true } } },
    });

    // Flatten tasks for export
    const flat = tasks.map((t: any) => ({
      id: t.id,
      title: t.title,
      description: t.description ?? '',
      status: t.status,
      priority: t.priority,
      progress: t.progress,
      type: t.type,
      source: t.source,
      creator: t.creator ?? '',
      assignee: t.assignee ?? '',
      dueDate: t.dueDate ?? '',
      createdAt: t.createdAt,
      updatedAt: t.updatedAt,
      tags: t.tags?.map((tt: any) => tt.tag?.name).filter(Boolean).join(', ') ?? '',
    }));

    if (format === 'csv') {
      const headers = ['ID', '标题', '描述', '状态', '优先级', '进度', '类型', '来源', '创建者', '负责人', '截止日期', '标签', '创建时间', '更新时间'];
      const rows = flat.map(t => [
        t.id, t.title, t.description, t.status, t.priority, t.progress, t.type, t.source, t.creator, t.assignee, t.dueDate, t.tags, t.createdAt, t.updatedAt,
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(','));

      const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n');
      return new NextResponse(csv, {
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition': `attachment; filename="tasks_${new Date().toISOString().slice(0, 10)}.csv"`,
        },
      });
    }

    // JSON format
    return new NextResponse(JSON.stringify(flat, null, 2), {
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="tasks_${new Date().toISOString().slice(0, 10)}.json"`,
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
