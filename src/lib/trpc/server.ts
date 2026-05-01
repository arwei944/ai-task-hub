import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { AuthUser } from '@/lib/modules/auth/types';
import { AppErrorCode, errorCodeToMessage } from '@/lib/core/errors';

// Lazy-initialized auth service (all dynamic imports to avoid better-sqlite3 static binding crash)
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

/**
 * Ensure the default admin user exists and return it.
 * Runs only once (singleton promise) to avoid race conditions.
 */
async function ensureAdmin(): Promise<AuthUser> {
  if (_ensureAdminPromise) return _ensureAdminPromise;

  _ensureAdminPromise = (async () => {
    const userRepo = await getUserRepo();
    const authService = await getAuthService();

    // Check if any admin user exists
    const existing = await userRepo.findByUsername('admin');
    if (existing) {
      return userRepo.toAuthUser(existing);
    }

    // Auto-create admin user with configurable password
    // Use static import pattern compatible with Next.js standalone
    let passwordHash: string;
    try {
      const bcrypt = await import('bcryptjs');
      // Handle both ESM default and CJS exports
      const hashFn = bcrypt.default?.hash ?? bcrypt.hash;
      if (!hashFn) throw new Error('bcryptjs hash function not found');
      const adminPassword = process.env.ADMIN_PASSWORD || `admin_${crypto.randomUUID().slice(0, 8)}`;
      passwordHash = await hashFn(adminPassword, 10);
    } catch (err: any) {
      // Fallback: create admin without password hash if bcrypt fails
      console.error('[tRPC] bcryptjs failed, using fallback:', err?.message);
      const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';
      const bcrypt = await import('bcryptjs');
      passwordHash = await (bcrypt.default || bcrypt).hash(adminPassword, 10);
    }

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

  // Try JWT auth first (for REST API / Agent API calls)
  if (opts.req) {
    try {
      const authService = await getAuthService();
      user = await authService.getUserFromRequest(opts.req);
    } catch {}
  }

  // Fallback: auto-authenticate as admin (no login required)
  if (!user) {
    user = await ensureAdmin();
  }

  return {
    user,
    req: opts.req,
  };
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ error, path }) {
    const code = error.code;
    const appCode = (error.cause as any)?.code ?? AppErrorCode.INTERNAL_ERROR;

    // Pass through original error message for debugging
    let message = error.message;
    if (code === 'INTERNAL_SERVER_ERROR') {
      // Include original cause in message for debugging
      const causeMsg = error.cause?.message || error.cause?.toString?.() || '';
      if (causeMsg && !message.includes(causeMsg)) {
        message = `${errorCodeToMessage(appCode)} [${causeMsg}]`;
      } else {
        message = errorCodeToMessage(appCode);
      }
    }

    return {
      code,
      message,
      path,
    };
  },
});

export const createTRPCRouter = t.router;

/**
 * Public procedure - no auth required
 */
export const publicProcedure = t.procedure;

/**
 * Protected procedure - auto-authenticated (admin by default)
 */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: errorCodeToMessage(AppErrorCode.UNAUTHORIZED),
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
 * Admin procedure - always passes (single admin mode)
 */
export const adminProcedure = protectedProcedure.use(async ({ ctx, next }) => {
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});
