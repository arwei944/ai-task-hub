// ============================================================
// AI Task Hub v3.0 — Lightweight DI Container
// ============================================================
// 极简 DI 容器，~60 行，支持单例/瞬态注册、循环依赖检测
// ============================================================

import type { IDIContainer } from './types';
import { DIResolveError } from '@/lib/core/types';

interface RegisteredService {
  factory: (container: IDIContainer) => unknown;
  singleton: boolean;
  instance?: unknown;
  tags: string[];
}

export class DIContainer implements IDIContainer {
  private services = new Map<string, RegisteredService>();
  private resolving = new Set<string>();

  register<T>(
    token: string,
    factory: (container: IDIContainer) => T,
    options?: { singleton?: boolean; tags?: string[] }
  ): void {
    if (this.services.has(token)) {
      console.warn(`[DI:v3] Service "${token}" is being re-registered`);
    }
    this.services.set(token, {
      factory,
      singleton: options?.singleton ?? true,
      tags: options?.tags ?? [],
    });
  }

  resolve<T>(token: string): T {
    const service = this.services.get(token);
    if (!service) {
      throw new DIResolveError(token, `[DI:v3] Cannot resolve: "${token}"`);
    }

    // 循环依赖检测
    if (this.resolving.has(token)) {
      throw new DIResolveError(token, `[DI:v3] Circular dependency: ${token}`);
    }

    // 单例直接返回
    if (service.singleton && service.instance !== undefined) {
      return service.instance as T;
    }

    this.resolving.add(token);
    try {
      const instance = service.factory(this) as T;
      if (service.singleton) {
        service.instance = instance;
      }
      return instance;
    } finally {
      this.resolving.delete(token);
    }
  }

  has(token: string): boolean {
    return this.services.has(token);
  }

  reset(): void {
    for (const service of this.services.values()) {
      service.instance = undefined;
    }
  }

  /** 获取所有已注册的 token */
  getRegisteredTokens(): string[] {
    return [...this.services.keys()];
  }

  /** 按标签查找 token */
  getByTag(tag: string): string[] {
    const tokens: string[] = [];
    for (const [token, service] of this.services.entries()) {
      if (service.tags.includes(tag)) {
        tokens.push(token);
      }
    }
    return tokens;
  }
}
