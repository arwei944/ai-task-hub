import { NextResponse } from 'next/server';

export async function GET() {
  const results: Record<string, { ok: boolean; error?: string; data?: any }> = {};

  // Step 1: Import db
  try {
    const { getPrisma } = await import('@/lib/db');
    const prisma = getPrisma();
    results['db_import'] = { ok: true, data: 'getPrisma() succeeded' };
  } catch (err: any) {
    results['db_import'] = { ok: false, error: err.message + ' | ' + (err.stack || '').slice(0, 200) };
  }

  // Step 2: Query database
  try {
    const { getPrisma } = await import('@/lib/db');
    const prisma = getPrisma();
    const count = await prisma.task.count();
    results['db_query'] = { ok: true, data: { taskCount: count } };
  } catch (err: any) {
    results['db_query'] = { ok: false, error: err.message + ' | ' + (err.stack || '').slice(0, 200) };
  }

  // Step 3: Import UserRepository
  try {
    const { getPrisma } = await import('@/lib/db');
    const { UserRepository } = await import('@/lib/modules/auth/user.repository');
    const prisma = getPrisma();
    const repo = new UserRepository(prisma);
    results['user_repo'] = { ok: true, data: 'UserRepository created' };
  } catch (err: any) {
    results['user_repo'] = { ok: false, error: err.message + ' | ' + (err.stack || '').slice(0, 200) };
  }

  // Step 4: Import AuthService
  try {
    const { getPrisma } = await import('@/lib/db');
    const { UserRepository } = await import('@/lib/modules/auth/user.repository');
    const { AuthService } = await import('@/lib/modules/auth/auth.service');
    const { Logger } = await import('@/lib/core/logger');
    const prisma = getPrisma();
    const userRepo = new UserRepository(prisma);
    const authService = new AuthService(userRepo, new Logger('test'));
    results['auth_service'] = { ok: true, data: 'AuthService created' };
  } catch (err: any) {
    results['auth_service'] = { ok: false, error: err.message + ' | ' + (err.stack || '').slice(0, 200) };
  }

  // Step 5: Import bcryptjs
  try {
    const bcrypt = await import('bcryptjs');
    const hashFn = bcrypt.default?.hash ?? bcrypt.hash;
    const hash = await hashFn('test', 10);
    results['bcryptjs'] = { ok: true, data: 'bcryptjs works' };
  } catch (err: any) {
    results['bcryptjs'] = { ok: false, error: err.message + ' | ' + (err.stack || '').slice(0, 200) };
  }

  // Step 6: Import tRPC server
  try {
    const { createTRPCContext } = await import('@/lib/trpc/server');
    const ctx = await createTRPCContext({ req: null as any });
    results['trpc_context'] = { ok: true, data: { user: ctx.user?.username } };
  } catch (err: any) {
    results['trpc_context'] = { ok: false, error: err.message + ' | ' + (err.stack || '').slice(0, 500) };
  }

  // Step 7: Import appRouter
  try {
    const { appRouter } = await import('@/lib/trpc/root-router');
    results['app_router'] = { ok: true, data: Object.keys(appRouter._def.record).join(', ') };
  } catch (err: any) {
    results['app_router'] = { ok: false, error: err.message + ' | ' + (err.stack || '').slice(0, 200) };
  }

  return NextResponse.json(results);
}
