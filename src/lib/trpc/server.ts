import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { AuthUser } from '@/lib/modules/auth/types';
import { AppErrorCode, errorCodeToMessage } from '@/lib/core/errors';

// Auto-set JWT_SECRET if not configured (for single-admin / demo deployments)
if (!process.env.JWT_SECRET) {
  process.env.JWT_SECRET = `auto_${crypto.randomUUID().replace(/-/g, '')}`;
}

// Lazy-initialized auth service
let _authService: any = null;
let _userRepo: any = null;
let _ensureAdminPromise: Promise<AuthUser> | null = null;

async function getUserRepo() {
  if (_userRepo) return _userRepo;
  const { getPrisma } = await import('@/lib/db');
  const { UserRepository } = await import('@/lib/modules/auth/user.repository');
  const prisma = getPrisma();
  _userRepo = new UserRepository(prisma);
  return _userRepo;
}

async function getAuthService() {
  if (_authService) return _authService;
  const { AuthService } = await import('@/lib/modules/auth/auth.service');
  const { Logger } = await import('@/lib/core/logger');
  const logger = new Logger('auth');
  _authService = new AuthService(await getUserRepo(), logger);
  return _authService;
}

async function ensureAdmin(): Promise<AuthUser> {
  if (_ensureAdminPromise) return _ensureAdminPromise;

  _ensureAdminPromise = (async () => {
    const userRepo = await getUserRepo();
    const authService = await getAuthService();

    const existing = await userRepo.findByUsername('admin');
    if (existing) {
      return userRepo.toAuthUser(existing);
    }

    const bcrypt = await import('bcryptjs');
    const adminPassword = process.env.ADMIN_PASSWORD || `admin_${crypto.randomUUID().slice(0, 8)}`;
    const hashFn = (bcrypt.default ?? bcrypt).hash;
    const passwordHash = await hashFn(adminPassword, 10);
    const admin = await userRepo.create({
      username: 'admin',
      email: 'admin@ai-task-hub.local',
      passwordHash,
      displayName: '\u7ba1\u7406\u5458',
      role: 'admin',
    });

    const { Logger } = await import('@/lib/core/logger');
    const logger = new Logger('auth');
    logger.info('Auto-created default admin user');

    return userRepo.toAuthUser(admin);
  })();

  return _ensureAdminPromise;
}

export const createTRPCContext = async (opts: { req?: Request }) => {
  let user: AuthUser | null = null;

  if (opts.req) {
    try {
      const authService = await getAuthService();
      user = await authService.getUserFromRequest(opts.req);
    } catch {}
  }

  if (!user) {
    user = await ensureAdmin();
  }

  return { user, req: opts.req };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ error, path }) {
    const code = error.code;
    const appCode = (error.cause as any)?.code ?? AppErrorCode.INTERNAL_ERROR;
    let message = error.message;
    if (code === 'INTERNAL_SERVER_ERROR' && !message.includes('\u8bf7')) {
      message = errorCodeToMessage(appCode);
    }
    return { code, message, path };
  },
});

export const createTRPCRouter = t.router;
export const publicProcedure = t.procedure;
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({ code: 'UNAUTHORIZED', message: errorCodeToMessage(AppErrorCode.UNAUTHORIZED) });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  return next({ ctx: { ...ctx, user: ctx.user } });
});
