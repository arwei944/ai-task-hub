// ============================================================
// Auth Service - JWT + Password Hashing
// ============================================================

import { SignJWT, jwtVerify } from 'jose';
import bcrypt from 'bcryptjs';
import type { ILogger } from '@/lib/core/types';
import { UserRepository } from './user.repository';
import type {
  AuthUser,
  AuthResponse,
  JwtPayload,
  LoginCredentials,
  RegisterData,
  UserRole,
} from './types';

const SALT_ROUNDS = 10;
const TOKEN_EXPIRY = '7d'; // 7 days

export class AuthService {
  private secretKey: Uint8Array;

  constructor(
    private userRepo: UserRepository,
    private logger: ILogger,
  ) {
    const secret = process.env.JWT_SECRET;
    if (!secret || secret.trim() === '') {
      if (process.env.NODE_ENV === 'production') {
        throw new Error('JWT_SECRET environment variable is required in production');
      }
      // Dev/test: generate a random secret per process startup
      const randomSecret = `dev_${crypto.randomUUID()}_${Date.now()}`;
      this.logger.warn(`JWT_SECRET is not set! Using auto-generated random secret for ${process.env.NODE_ENV || 'development'} mode. Tokens will not survive restarts.`);
      this.secretKey = new TextEncoder().encode(randomSecret);
    } else {
      this.secretKey = new TextEncoder().encode(secret);
    }
  }

  /**
   * Register a new user
   */
  async register(data: RegisterData): Promise<AuthResponse> {
    // Check if username or email already exists
    const existingUser = await this.userRepo.findByUsername(data.username);
    if (existingUser) {
      throw new Error('用户名已存在');
    }

    const existingEmail = await this.userRepo.findByEmail(data.email);
    if (existingEmail) {
      throw new Error('邮箱已被注册');
    }

    // Hash password
    const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

    // Check if this is the first user (auto-admin)
    const userCount = await this.userRepo.count();
    const isFirstUser = userCount === 0;

    // Create user
    const user = await this.userRepo.create({
      username: data.username,
      email: data.email,
      passwordHash,
      displayName: data.displayName,
      role: isFirstUser ? 'admin' : undefined,
    });

    // Generate JWT
    const token = await this.generateToken({
      userId: user.id,
      username: user.username,
      role: user.role as UserRole,
    });

    this.logger.info(`User registered: ${user.username}`);

    return {
      user: this.userRepo.toAuthUser(user),
      token,
    };
  }

  /**
   * Login with credentials
   */
  async login(credentials: LoginCredentials): Promise<AuthResponse> {
    const user = await this.userRepo.findByUsername(credentials.username);
    if (!user) {
      throw new Error('用户名或密码错误');
    }

    if (!user.isActive) {
      throw new Error('账户已被禁用');
    }

    // Verify password
    const isValid = await bcrypt.compare(credentials.password, user.passwordHash);
    if (!isValid) {
      throw new Error('用户名或密码错误');
    }

    // Update last login
    await this.userRepo.updateLastLogin(user.id);

    // Generate JWT
    const token = await this.generateToken({
      userId: user.id,
      username: user.username,
      role: user.role as UserRole,
    });

    this.logger.info(`User logged in: ${user.username}`);

    return {
      user: this.userRepo.toAuthUser(user),
      token,
    };
  }

  /**
   * Verify JWT token and return user
   */
  async verifyToken(token: string): Promise<AuthUser | null> {
    try {
      const { payload } = await jwtVerify(token, this.secretKey);
      const jwtPayload = payload as unknown as JwtPayload;

      const user = await this.userRepo.findById(jwtPayload.userId);
      if (!user || !user.isActive) {
        return null;
      }

      return this.userRepo.toAuthUser(user);
    } catch {
      return null;
    }
  }

  /**
   * Get current user from request (Bearer token or cookie)
   */
  async getUserFromRequest(request: Request): Promise<AuthUser | null> {
    // Try Authorization header first
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      return this.verifyToken(authHeader.slice(7));
    }

    // Try cookie
    const cookieHeader = request.headers.get('cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(/(?:^|;\s*)token=([^;]+)/);
      if (match) {
        return this.verifyToken(match[1]);
      }
    }

    return null;
  }

  /**
   * Generate JWT token
   */
  private async generateToken(payload: JwtPayload): Promise<string> {
    return new SignJWT({ ...payload })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(TOKEN_EXPIRY)
      .sign(this.secretKey);
  }

  /**
   * Change password
   */
  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<void> {
    const user = await this.userRepo.findById(userId);
    if (!user) throw new Error('用户不存在');

    const isValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isValid) throw new Error('原密码错误');

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await this.userRepo.update(userId, { passwordHash } as Parameters<typeof this.userRepo.update>[1]);

    this.logger.info(`Password changed for user: ${user.username}`);
  }
}
