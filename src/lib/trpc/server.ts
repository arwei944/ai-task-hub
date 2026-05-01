import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { AuthUser } from '@/lib/modules/auth/types';
import { AppErrorCode, errorCodeToMessage } from '@/lib/core/errors';

// Lazy-initialized auth service (all dynamic imports to avoid better-sqlite3 static binding crash)
let _authService: any = null;
let _userRepo: any = null;
let _ensureAdminPromise: Promise<AuthUser> | null = null;
let _logger: any = null;

async function getLogger() {
  if (_logger) return _logger;
  const { Logger } = await import('@/lib/core/logger');
  _logger = new Logger('trpc');
  return _logger;
}

async function getUserRepo() {
  if (_userRepo) return _userRepo;
  try {
    console.log('[tRPC] getUserRepo: importing db...');
    const { getPrisma } = await import('@/lib/db');
    console.log('[tRPC] getUserRepo: db imported, getting prisma...');
    const prisma = getPrisma();
    console.log('[tRPC] getUserRepo: got prisma, creating UserRepo...');
    const { UserRepository } = await import('@/lib/modules/auth/user.repository');
    _userRepo = new UserRepository(prisma);
    console.log('[tRPC] getUserRepo: UserRepo created successfully');
    return _userRepo;
  } catch (err: any) {
    console.error('[tRPC] getUserRepo FAILED:', err?.message, err?.stack);
    throw err;
  }
}

async function getAuthService() {
  if (_authService) return _authService;
  try {
    const { AuthService } = await import('@/lib/modules/auth/auth.service');
    const { Logger } = await import('@/lib/core/logger');
    const logger = new Logger('auth');
    _authService = new AuthService(await getUserRepo(), logger);
    return _authService;
  } catch (err: any) {
    console.error('[tRPC] getAuthService FAILED:', err?.message, err?.stack);
    throw err;
  }
}

/**
 * Ensure the default admin user exists and return it.
 * Runs only once (singleton promise) to avoid race conditions.
 */
async function ensureAdmin(): Promise<AuthUser> {
  if (_ensureAdminPromise) return _ensureAdminPromise;

  _ensureAdminPromise = (async () => {
    try {
      console.log('[tRPC] ensureAdmin: starting...');
      const userRepo = await getUserRepo();
      const authService = await getAuthService();

      // Check if any admin user exists
      const existing = await userRepo.findByUsername('admin');
      if (existing) {
        console.log('[tRPC] ensureAdmin: admin user found');
        return userRepo.toAuthUser(existing);
      }

      // Auto-create admin user with configurable password
      const bcrypt = await import('bcryptjs');
      const adminPassword = process.env.ADMIN_PASSWORD || `admin_${crypto.randomUUID().slice(0, 8)}`;
      const passwordHash = await bcrypt.default.hash(adminPassword, 10);
      const admin = await userRepo.create({
        username: 'admin',
        email: 'admin@ai-task-hub.local',
        passwordHash,
        displayName: '\u7ba1\u7406\u5458',
        role: 'admin',
      });

      const { Logger } = await import('@/lib/core/logger');
      const logger = new Logger('auth');
      if (!process.env.ADMIN_PASSWORD) {
        logger.warn(`Auto-created admin user with random password: ${adminPassword}. Set ADMIN_PASSWORD env var to customize.`);
      } else {
        logger.info('Auto-created default admin user with ADMIN_PASSWORD');
      }

      console.log('[tRPC] ensureAdmin: admin user created');
      return userRepo.toAuthUser(admin);
    } catch (err: any) {
      console.error('[tRPC] ensureAdmin FAILED:', err?.message, err?.stack);
      throw err;
    }
  })();

  return _ensureAdminPromise;
}

export const createTRPCContext = async (opts: { req?: Request }) => {
  try {
    console.log('[tRPC] createTRPCContext: starting...');
    let user: AuthUser | null = null;

    // Try JWT auth first (for REST API / Agent API calls)
    if (opts.req) {
      try {
        const authService = await getAuthService();
        user = await authService.getUserFromRequest(opts.req);
      } catch (err: any) {
        console.log('[tRPC] createTRPCContext: JWT auth failed (expected):', err?.message);
      }
    }

    // Fallback: auto-authenticate as admin (no login required)
    if (!user) {
      console.log('[tRPC] createTRPCContext: falling back to ensureAdmin...');
      user = await ensureAdmin();
    }

    console.log('[tRPC] createTRPCContext: success, user=', user?.username);
    return {
      user,
      req: opts.req,
    };
  } catch (err: any) {
    console.error('[tRPC] createTRPCContext FAILED:', err?.message, err?.stack);
    // Return a minimal context to allow the request to proceed
    // This helps us see the actual error from the procedure
    throw err;
  }
};

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ error, path }) {
    const code = error.code;
    const appCode = (error.cause as any)?.code ?? AppErrorCode.INTERNAL_ERROR;

    // Log the full error for debugging
    console.error(`[tRPC Error] ${path ?? 'unknown'}: [${code}] ${error.message}`, error.cause);

    let message = error.message;
    if (code === 'INTERNAL_SERVER_ERROR' && !message.includes('\u8bf7')) {
      message = errorCodeToMessage(appCode);
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
  // In single-admin mode, all authenticated users are admin
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});
