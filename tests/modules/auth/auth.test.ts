import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { PrismaClient } from '@/generated/prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { Logger } from '@/lib/core/logger';
import { UserRepository } from '@/lib/modules/auth/user.repository';
import { AuthService } from '@/lib/modules/auth/auth.service';
import { join } from 'node:path';

const TEST_DB_PATH = join(process.cwd(), 'test-db', 'test-task-core.db');

const CREATE_USER_TABLE_SQL = `
CREATE TABLE IF NOT EXISTS "User" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "username" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "displayName" TEXT,
  "role" TEXT NOT NULL DEFAULT 'user',
  "avatar" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "lastLoginAt" DATETIME,
  "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" DATETIME NOT NULL
);
CREATE UNIQUE INDEX IF NOT EXISTS "User_username_key" ON "User"("username");
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE INDEX IF NOT EXISTS "User_role_idx" ON "User"("role");
CREATE INDEX IF NOT EXISTS "User_isActive_idx" ON "User"("isActive");
`;

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
    for (const stmt of CREATE_USER_TABLE_SQL.split(';').filter(s => s.trim())) {
      await services.prisma.$executeRawUnsafe(stmt);
    }
    await services.prisma.user.deleteMany();
  });

  afterEach(async () => {
    await services.prisma.$disconnect();
  });

  describe('Register', () => {
    it('should register a new user', async () => {
      const result = await services.authService.register({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
        displayName: 'Test User',
      });

      expect(result.user.username).toBe('testuser');
      expect(result.user.email).toBe('test@example.com');
      expect(result.user.displayName).toBe('Test User');
      expect(result.user.role).toBe('user');
      expect(result.token).toBeTruthy();
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
  });

  describe('Login', () => {
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
  });

  describe('Token verification', () => {
    it('should verify valid token', async () => {
      const { token } = await services.authService.register({
        username: 'testuser',
        email: 'test@example.com',
        password: 'password123',
      });

      const user = await services.authService.verifyToken(token);
      expect(user).not.toBeNull();
      expect(user!.username).toBe('testuser');
    });

    it('should reject invalid token', async () => {
      const user = await services.authService.verifyToken('invalid-token');
      expect(user).toBeNull();
    });
  });

  describe('Change password', () => {
    it('should change password with correct old password', async () => {
      const { user } = await services.authService.register({
        username: 'testuser',
        email: 'test@example.com',
        password: 'oldpassword',
      });

      await services.authService.changePassword(user.id, 'oldpassword', 'newpassword');

      // Old password should not work
      await expect(
        services.authService.login({ username: 'testuser', password: 'oldpassword' }),
      ).rejects.toThrow();

      // New password should work
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
  });
});

describe('UserRepository', () => {
  let services: ReturnType<typeof createServices>;

  beforeEach(async () => {
    services = createServices();
    for (const stmt of CREATE_USER_TABLE_SQL.split(';').filter(s => s.trim())) {
      await services.prisma.$executeRawUnsafe(stmt);
    }
    await services.prisma.user.deleteMany();
  });

  afterEach(async () => {
    await services.prisma.$disconnect();
  });

  it('should find user by username', async () => {
    await services.authService.register({
      username: 'findme',
      email: 'find@example.com',
      password: 'password123',
    });

    const user = await services.userRepo.findByUsername('findme');
    expect(user).not.toBeNull();
    expect(user!.username).toBe('findme');
  });

  it('should list users with filters', async () => {
    await services.authService.register({
      username: 'user1',
      email: 'user1@example.com',
      password: 'password123',
    });
    await services.authService.register({
      username: 'user2',
      email: 'user2@example.com',
      password: 'password123',
    });

    const users = await services.userRepo.list();
    expect(users.length).toBe(2);
  });

  it('should update user', async () => {
    const { user } = await services.authService.register({
      username: 'testuser',
      email: 'test@example.com',
      password: 'password123',
    });

    const updated = await services.userRepo.update(user.id, {
      displayName: 'New Name',
      role: 'admin',
    });

    expect(updated.displayName).toBe('New Name');
    expect(updated.role).toBe('admin');
  });
});
