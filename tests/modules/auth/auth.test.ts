import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { Logger } from '@/lib/core/logger';
import { UserRepository } from '@/lib/modules/auth/user.repository';
import { AuthService } from '@/lib/modules/auth/auth.service';
import { join } from 'node:path';

const TEST_DB_PATH = join(process.cwd(), 'test-db', 'test-task-core.db');

function createServices() {
  const adapter = new PrismaBetterSqlite3({ url: TEST_DB_PATH });
  const prisma = new PrismaClient({ adapter });
  const logger = new Logger('test');
  const userRepo = new UserRepository(prisma);
  const authService = new AuthService(userRepo, logger);
  return { prisma, userRepo, authService };
}

describe('AuthService', () => {
  let services: ReturnType<typeof createServices>;

  beforeEach(async () => {
    services = createServices();
    await services.prisma.user.deleteMany();
  });

  afterEach(async () => {
    await services.prisma.$disconnect();
  });

  // --- 注册 ---

  it('should register a new user (first user becomes admin)', async () => {
    const result = await services.authService.register({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
      displayName: 'Test User',
    });

    expect(result.user.username).toBe('testuser');
    expect(result.user.email).toBe('test@example.com');
    expect(result.user.displayName).toBe('Test User');
    expect(result.user.role).toBe('admin');
    expect(result.user.isActive).toBe(true);
    expect(result.token).toBeTruthy();
  });

  it('should register second user as regular user', async () => {
    await services.authService.register({
      username: 'admin',
      email: 'admin@example.com',
      password: 'password123',
    });

    const result = await services.authService.register({
      username: 'regular',
      email: 'regular@example.com',
      password: 'password123',
    });

    expect(result.user.role).toBe('user');
  });

  it('should not allow duplicate username', async () => {
    await services.authService.register({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
    });

    await expect(
      services.authService.register({
        username: 'testuser',
        email: 'other@example.com',
        password: 'password123',
      }),
    ).rejects.toThrow('用户名已存在');
  });

  it('should not allow duplicate email', async () => {
    await services.authService.register({
      username: 'user1',
      email: 'test@example.com',
      password: 'password123',
    });

    await expect(
      services.authService.register({
        username: 'user2',
        email: 'test@example.com',
        password: 'password123',
      }),
    ).rejects.toThrow('邮箱已被注册');
  });

  it('should hash password on registration', async () => {
    const result = await services.authService.register({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
    });

    const user = await services.userRepo.findByUsername('testuser');
    expect(user!.passwordHash).not.toBe('password123');
    expect(user!.passwordHash).toBeTruthy();
  });

  // --- 登录 ---

  it('should login with correct credentials', async () => {
    await services.authService.register({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
    });

    const result = await services.authService.login({
      username: 'testuser',
      password: 'password123',
    });

    expect(result.user.username).toBe('testuser');
    expect(result.token).toBeTruthy();
  });

  it('should reject wrong password', async () => {
    await services.authService.register({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
    });

    await expect(
      services.authService.login({
        username: 'testuser',
        password: 'wrongpassword',
      }),
    ).rejects.toThrow('用户名或密码错误');
  });

  it('should reject non-existent user', async () => {
    await expect(
      services.authService.login({
        username: 'nonexistent',
        password: 'password123',
      }),
    ).rejects.toThrow('用户名或密码错误');
  });

  // --- Token 验证 ---

  it('should verify valid token', async () => {
    const { token } = await services.authService.register({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
    });

    const user = await services.authService.verifyToken(token);
    expect(user).not.toBeNull();
    expect(user!.username).toBe('testuser');
    expect(user!.role).toBe('admin');
  });

  it('should reject invalid token', async () => {
    const user = await services.authService.verifyToken('invalid-token');
    expect(user).toBeNull();
  });

  it('should reject empty token', async () => {
    const user = await services.authService.verifyToken('');
    expect(user).toBeNull();
  });

  it('should return null for token of deleted user', async () => {
    const { token } = await services.authService.register({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
    });

    await services.userRepo.delete((await services.userRepo.findByUsername('testuser'))!.id);

    const user = await services.authService.verifyToken(token);
    expect(user).toBeNull();
  });

  // --- 密码修改 ---

  it('should change password with correct old password', async () => {
    const { user } = await services.authService.register({
      username: 'testuser',
      email: 'test@example.com',
      password: 'oldpassword',
    });

    await services.authService.changePassword(user.id, 'oldpassword', 'newpassword');

    await expect(
      services.authService.login({ username: 'testuser', password: 'oldpassword' }),
    ).rejects.toThrow();

    const result = await services.authService.login({
      username: 'testuser',
      password: 'newpassword',
    });
    expect(result.user.username).toBe('testuser');
  });

  it('should reject wrong old password', async () => {
    const { user } = await services.authService.register({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
    });

    await expect(
      services.authService.changePassword(user.id, 'wrongold', 'newpassword'),
    ).rejects.toThrow('原密码错误');
  });

  it('should reject change password for non-existent user', async () => {
    await expect(
      services.authService.changePassword('non-existent', 'old', 'new'),
    ).rejects.toThrow('用户不存在');
  });

  // --- getUserFromRequest ---

  it('should get user from Bearer token', async () => {
    const { token } = await services.authService.register({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
    });

    const request = new Request('http://localhost', {
      headers: { authorization: `Bearer ${token}` },
    });

    const user = await services.authService.getUserFromRequest(request);
    expect(user).not.toBeNull();
    expect(user!.username).toBe('testuser');
  });

  it('should return null when no auth header', async () => {
    const request = new Request('http://localhost');
    const user = await services.authService.getUserFromRequest(request);
    expect(user).toBeNull();
  });

  it('should return null for invalid Bearer token', async () => {
    const request = new Request('http://localhost', {
      headers: { authorization: 'Bearer invalid-token' },
    });

    const user = await services.authService.getUserFromRequest(request);
    expect(user).toBeNull();
  });

  it('should get user from cookie', async () => {
    const { token } = await services.authService.register({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
    });

    const request = new Request('http://localhost', {
      headers: { cookie: `token=${token}` },
    });

    const user = await services.authService.getUserFromRequest(request);
    expect(user).not.toBeNull();
    expect(user!.username).toBe('testuser');
  });
});
