// ============================================================
// Auth Types
// ============================================================

export type UserRole = 'admin' | 'user' | 'agent';

export interface AuthUser {
  id: string;
  username: string;
  email: string;
  displayName: string | null;
  role: UserRole;
  avatar: string | null;
  isActive: boolean;
}

export interface LoginCredentials {
  username: string;
  password: string;
}

export interface RegisterData {
  username: string;
  email: string;
  password: string;
  displayName?: string;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

export interface JwtPayload {
  userId: string;
  username: string;
  role: UserRole;
}
