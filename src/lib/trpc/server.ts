import { initTRPC, TRPCError } from '@trpc/server';
import type { AuthUser } from '@/lib/modules/auth/types';
import { AuthService } from '@/lib/modules/auth/auth.service';
import { UserRepository } from '@/lib/modules/auth/user.repository';
import { Logger } from '@/lib/core/logger';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

// Lazy-initialized auth service
let _authService: AuthService | null = null;

function getAuthService(): AuthService {
  if (_authService) return _authService;

  const dbPath = process.env.DATABASE_URL?.replace(/^file:/, '') ?? './prisma/dev.db';
  const adapter = new PrismaBetterSqlite3({ url: dbPath });
  const prisma = new PrismaClient({ adapter });
  const userRepo = new UserRepository(prisma);
  const logger = new Logger('auth');

  _authService = new AuthService(userRepo, logger);
  return _authService;
}

export const createTRPCContext = async (opts: { req?: Request }) => {
  let user: AuthUser | null = null;

  if (opts.req) {
    const authService = getAuthService();
    user = await authService.getUserFromRequest(opts.req);
  }

  return {
    user,
    req: opts.req,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create();

export const createTRPCRouter = t.router;

/**
 * Public procedure - no auth required
 */
export const publicProcedure = t.procedure;

/**
 * Protected procedure - requires valid JWT
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: '请先登录',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

/**
 * Admin procedure - requires admin role
 */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: '需要管理员权限',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});
