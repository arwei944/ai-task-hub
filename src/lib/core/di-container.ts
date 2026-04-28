import { type IDIContainer, type RegisterOptions, DIResolveError } from './types';

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
    options?: RegisterOptions
  ): void {
    if (this.services.has(token)) {
      console.warn(`[DI] Service "${token}" is being re-registered`);
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
      throw new DIResolveError(token);
    }

    // Circular dependency detection
    if (this.resolving.has(token)) {
      throw new DIResolveError(token, `Circular dependency detected: ${token}`);
    }

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

  getRegisteredTokens(): string[] {
    return [...this.services.keys()];
  }

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
