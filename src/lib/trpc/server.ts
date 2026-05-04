import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { AuthUser } from '@/lib/modules/auth/types';
import { AppErrorCode, errorCodeToMessage } from '@/lib/core/errors';
import { DIContainer } from '@/lib/core/v3';
import { registerAllServices } from '@/lib/core/v3/service-factory';
import { ServiceAccessor } from '@/lib/core/v3/trpc-context';

// Auto-set JWT_SECRET if not configured (for single-admin / demo deployments)
// JWT_SECRET: require from env or generate once and persist to /data
if (!process.env.JWT_SECRET) {
  const fs = require('fs');
  const path = require('path');
  const secretPath = path.join(process.env.DATA_DIR || '/data', '.jwt_secret');
  try {
    if (fs.existsSync(secretPath)) {
      process.env.JWT_SECRET = fs.readFileSync(secretPath, 'utf-8').trim();
    } else {
      const secret = crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
      fs.mkdirSync(path.dirname(secretPath), { recursive: true });
      fs.writeFileSync(secretPath, secret, 'utf-8');
      process.env.JWT_SECRET = secret;
      console.log(`[auth] Generated new JWT_SECRET and saved to ${secretPath}`);
    }
  } catch {
    // Fallback for read-only filesystems (e.g., some CI environments)
    process.env.JWT_SECRET = `dev_${crypto.randomUUID().replace(/-/g, '')}`;
    console.warn('[auth] WARNING: Using ephemeral JWT_SECRET (filesystem not writable). Tokens will invalidate on restart.');
  }
}

// ---- v3 Service Container (singleton) ----

let _container: DIContainer | null = null;
let _services: ServiceAccessor | null = null;
let _initPromise: Promise<void> | null = null;

async function ensureServicesInitialized(): Promise<void> {
  if (_services) return;
  if (_initPromise) {
    await _initPromise;
    return;
  }

  _initPromise = (async () => {
    const container = new DIContainer();
    await registerAllServices(container);
    _container = container;
    _services = new ServiceAccessor(container);
  })();

  await _initPromise;
}

function getServices(): ServiceAccessor {
  if (!_services) {
    throw new Error('Services not initialized. Call ensureServicesInitialized() first.');
  }
  return _services;
}

// ---- Auth (kept for backward compatibility) ----

let _ensureAdminPromise: Promise<AuthUser> | null = null;

async function ensureAdmin(): Promise<AuthUser> {
  if (_ensureAdminPromise) return _ensureAdminPromise;

  _ensureAdminPromise = (async () => {
    await ensureServicesInitialized();
    const services = getServices();
    const userRepo = services.userRepo;
    const authService = services.authService;

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
      displayName: '管理员',
      role: 'admin',
    });

    // Log admin credentials so the user can actually log in
    if (!process.env.ADMIN_PASSWORD) {
      services.logger.warn(
        '╔══════════════════════════════════════════════════════════════╗\n' +
        '║  DEFAULT ADMIN CREDENTIALS (set ADMIN_PASSWORD to override) ║\n' +
        `║  Username: admin                                            ║\n` +
        `║  Password: ${adminPassword.padEnd(50)}║\n` +
        '╚══════════════════════════════════════════════════════════════╝',
      );
    } else {
      services.logger.info('Auto-created default admin user (password set via ADMIN_PASSWORD)');
    }
    return userRepo.toAuthUser(admin);
  })();

  return _ensureAdminPromise;
}

// ---- tRPC Context ----

export const createTRPCContext = async (opts: { req?: Request }) => {
  // Ensure all services are initialized
  await ensureServicesInitialized();
  const services = getServices();

  let user: AuthUser | null = null;

  if (opts.req) {
    try {
      const authService = services.authService;
      user = await authService.getUserFromRequest(opts.req);
    } catch {}
  }

  if (!user) {
    user = await ensureAdmin();
  }

  return {
    user,
    req: opts.req,
    services, // v3: type-safe service accessor
  };
};

// ---- tRPC Instance ----

const t = initTRPC.context<typeof createTRPCContext>().create({
  transformer: superjson,
  errorFormatter({ error, path }) {
    const code = error.code;
    const appCode = (error.cause as any)?.code ?? AppErrorCode.INTERNAL_ERROR;
    let message = error.message;
    if (code === 'INTERNAL_SERVER_ERROR' && !message.includes('请')) {
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
  if (ctx.user.role !== 'admin') {
    throw new TRPCError({ code: 'FORBIDDEN', message: 'Admin access required' });
  }
  return next({ ctx: { ...ctx, user: ctx.user } });
});

// Re-export for router access
export { getServices, ensureServicesInitialized };
