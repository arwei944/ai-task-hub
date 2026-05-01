import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { AuthUser } from '@/lib/modules/auth/types';
import { AuthService } from '@/lib/modules/auth/auth.service';
import { UserRepository } from '@/lib/modules/auth/user.repository';
import { Logger } from '@/lib/core/logger';
import { getPrisma } from '@/lib/db';
import { AppErrorCode, errorCodeToMessage } from '@/lib/core/errors';

// Lazy-initialized auth service
let _authService: AuthService | null = null;
let _userRepo: UserRepository | null = null;
let _ensureAdminPromise: Promise<AuthUser> | null = null;

function getUserRepo(): UserRepository {
  if (_userRepo) return _userRepo;
  _userRepo = new UserRepository(getPrisma());
  return _userRepo;
}

function getAuthService(): AuthService {
  if (_authService) return _authService;
  const logger = new Logger('auth');
  _authService = new AuthService(getUserRepo(), logger);
  return _authService;
}

/**
 * Ensure the default admin user exists and return it.
 * Runs only once (singleton promise) to avoid race conditions.
 */
async function ensureAdmin(): Promise<AuthUser> {
  if (_ensureAdminPromise) return _ensureAdminPromise;

  _ensureAdminPromise = (async () => {
    const userRepo = getUserRepo();
    const authService = getAuthService();

    // Check if any admin user exists
    const existing = await userRepo.findByUsername('admin');
    if (existing) {
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
      displayName: '管理员',
      role: 'admin',
    });

    const logger = new Logger('auth');
    if (!process.env.ADMIN_PASSWORD) {
      logger.warn(`Auto-created admin user with random password: ${adminPassword}. Set ADMIN_PASSWORD env var to customize.`);
    } else {
      logger.info('Auto-created default admin user with ADMIN_PASSWORD');
    }

    return userRepo.toAuthUser(admin);
  })();

  return _ensureAdminPromise;
}

export const createTRPCContext = async (opts: { req?: Request }) => {
  let user: AuthUser | null = null;

  // Try JWT auth first (for REST API / Agent API calls)
  if (opts.req) {
    const authService = getAuthService();
    user = await authService.getUserFromRequest(opts.req);
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

const logger = new Logger('trpc');

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ error, path }) {
    const code = error.code;
    const appCode = (error.cause as any)?.code ?? AppErrorCode.INTERNAL_ERROR;

    logger.error(`[tRPC] ${path ?? 'unknown'}: [${code}] ${error.message}`, {
      code,
      appCode,
      path,
    });

    let message = error.message;
    if (code === 'INTERNAL_SERVER_ERROR' && !message.includes('请')) {
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
