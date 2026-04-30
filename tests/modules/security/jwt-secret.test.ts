// ============================================================
// C-01: JWT 密钥硬编码默认值 - Critical 安全测试
// ============================================================

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SignJWT, jwtVerify } from 'jose';
import { AuthService } from '@/lib/modules/auth/auth.service';
import { UserRepository } from '@/lib/modules/auth/user.repository';
import { Logger } from '@/lib/core/logger';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const DEFAULT_SECRET = 'ai-task-hub-default-secret-change-in-production';

/**
 * 创建一个最小化的 mock logger
 */
function createMockLogger() {
  return {
    info: () => {},
    warn: () => {},
    error: () => {},
    debug: () => {},
    child: () => createMockLogger(),
  } as any;
}

/**
 * 创建一个 mock UserRepository，仅提供 findById/toAuthUser
 * 用于 JWT 验证测试（不需要真实数据库）
 *
 * 注意：AuthUser 接口使用 `id` 字段（由 toAuthUser 从数据库 user 映射而来），
 * 而 JwtPayload 使用 `userId` 字段（存在 JWT token 中）。
 * verifyToken 先解码 JWT 拿到 payload.userId，再查数据库拿到 user，
 * 最后返回 toAuthUser(user)，其属性名为 `id`。
 */
function createMockUserRepo() {
  return {
    findById: async (id: string) => {
      if (id === 'user-123') {
        return {
          id: 'user-123',
          username: 'testuser',
          email: 'test@example.com',
          displayName: 'Test User',
          role: 'user',
          avatar: null,
          isActive: true,
          passwordHash: 'ignored',
          createdAt: new Date(),
          updatedAt: new Date(),
          lastLoginAt: null,
        };
      }
      return null;
    },
    toAuthUser(user: any) {
      return {
        id: String(user.id),
        username: String(user.username ?? ''),
        email: String(user.email ?? ''),
        displayName: user.displayName ? String(user.displayName) : null,
        role: String(user.role ?? 'user') as any,
        avatar: user.avatar ? String(user.avatar) : null,
        isActive: Boolean(user.isActive),
      };
    },
    findByUsername: async () => null,
    findByEmail: async () => null,
    count: async () => 1,
    create: async () => ({} as any),
    updateLastLogin: async () => ({} as any),
    update: async () => ({} as any),
    list: async () => [],
    delete: async () => ({} as any),
  };
}

describe('C-01: JWT 密钥硬编码默认值', () => {
  let originalJwtSecret: string | undefined;

  beforeEach(() => {
    originalJwtSecret = process.env.JWT_SECRET;
  });

  afterEach(() => {
    if (originalJwtSecret !== undefined) {
      process.env.JWT_SECRET = originalJwtSecret;
    } else {
      delete process.env.JWT_SECRET;
    }
  });

  // C-01-1: 未设置 JWT_SECRET 时使用随机密钥（已修复：不再使用硬编码默认密钥）
  it('C-01-1: 未设置 JWT_SECRET 时使用随机密钥，旧默认密钥签发的 token 应被拒绝', async () => {
    delete process.env.JWT_SECRET;

    const authService = new AuthService(createMockUserRepo(), createMockLogger());

    // 使用旧的硬编码默认密钥签发 token
    const defaultKey = new TextEncoder().encode(DEFAULT_SECRET);
    const token = await new SignJWT({
      userId: 'user-123',
      username: 'testuser',
      role: 'user',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(defaultKey);

    // AuthService 使用随机密钥，应拒绝旧默认密钥签发的 token
    const result = await authService.verifyToken(token);
    expect(result).toBeNull();
  });

  // C-01-2: 默认密钥签发的 token 不可被任意复现（已修复：使用随机密钥）
  it('C-01-2: 未设置 JWT_SECRET 时使用随机密钥，攻击者无法伪造 token', async () => {
    delete process.env.JWT_SECRET;

    const authService = new AuthService(createMockUserRepo(), createMockLogger());

    // 攻击者尝试用旧的硬编码默认密钥伪造 token
    const forgedKey = new TextEncoder().encode(DEFAULT_SECRET);
    const forgedToken = await new SignJWT({
      userId: 'user-123',
      username: 'testuser',
      role: 'admin',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(forgedKey);

    // 系统应拒绝使用旧默认密钥签发的 token（安全修复：不再使用硬编码默认密钥）
    const result = await authService.verifyToken(forgedToken);
    expect(result).toBeNull();
  });

  // C-01-3: 设置自定义 JWT_SECRET 后使用自定义密钥
  it('C-01-3: 设置自定义 JWT_SECRET 后使用自定义密钥签发和验证', async () => {
    const customSecret = 'my-super-secret-key-12345';
    process.env.JWT_SECRET = customSecret;

    const authService = new AuthService(createMockUserRepo(), createMockLogger());

    // 使用自定义密钥签发 token
    const customKey = new TextEncoder().encode(customSecret);
    const token = await new SignJWT({
      userId: 'user-123',
      username: 'testuser',
      role: 'user',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(customKey);

    // AuthService 应能验证自定义密钥签发的 token
    const result = await authService.verifyToken(token);
    expect(result).not.toBeNull();
    expect(result!.id).toBe('user-123');
  });

  // C-01-4: 自定义密钥签发的 token 不能被默认密钥验证
  it('C-01-4: 自定义密钥签发的 token 不能被默认密钥验证，验证应失败返回 null', async () => {
    // 模拟场景：服务端使用了自定义密钥，攻击者尝试用默认密钥伪造
    const customSecret = 'my-super-secret-key-12345';
    process.env.JWT_SECRET = customSecret;

    const authService = new AuthService(createMockUserRepo(), createMockLogger());

    // 攻击者用默认密钥签发 token
    const defaultKey = new TextEncoder().encode(DEFAULT_SECRET);
    const forgedToken = await new SignJWT({
      userId: 'user-123',
      username: 'testuser',
      role: 'admin',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(defaultKey);

    // 使用自定义密钥的 AuthService 应拒绝该 token
    const result = await authService.verifyToken(forgedToken);
    expect(result).toBeNull();
  });

  // C-01-5: JWT_SECRET 为空字符串时的行为（已修复：使用随机密钥）
  it('C-01-5: JWT_SECRET 为空字符串时应视为未设置，使用随机密钥', async () => {
    process.env.JWT_SECRET = '';

    const authService = new AuthService(createMockUserRepo(), createMockLogger());

    // 空字符串走随机密钥路径，旧默认密钥签发的 token 应被拒绝
    const defaultKey = new TextEncoder().encode(DEFAULT_SECRET);
    const token = await new SignJWT({
      userId: 'user-123',
      username: 'testuser',
      role: 'user',
    })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('7d')
      .sign(defaultKey);

    // 使用随机密钥的 AuthService 应拒绝旧默认密钥的 token
    const result = await authService.verifyToken(token);
    expect(result).toBeNull();
  });
});
