// ============================================================
// AI Task Hub - Core Type Definitions
// ============================================================

// --- Module System Types ---

export interface Module {
  id: string;
  name: string;
  version: string;
  description?: string;
  locked?: boolean; // If true, cannot be disabled/uninstalled
  dependencies?: string[];
  lifecycle: ModuleLifecycle;
  extensions?: ExtensionPointConfig[];
  providers?: ProviderConfig[];
  eventHandlers?: EventHandlerConfig[];
  apiRoutes?: ApiRouteConfig[];
  mcpTools?: McpToolConfig[];
}

export interface ModuleLifecycle {
  install?(context: ModuleContext): Promise<void>;
  enable?(context: ModuleContext): Promise<void>;
  disable?(): Promise<void>;
  uninstall?(): Promise<void>;
}

export interface ModuleContext {
  eventBus: IEventBus;
  container: IDIContainer;
  registry: IModuleRegistry;
  config: IConfigAccessor;
  db: IDatabaseAccessor;
  logger: ILogger;
}

export interface ModuleInfo {
  module: Module;
  status: ModuleStatus;
  loadedAt?: Date;
  enabledAt?: Date;
  dependencies: string[];
  dependents: string[];
}

export type ModuleStatus = 'registered' | 'installed' | 'enabled' | 'disabled';

// --- Extension Points ---

export interface ExtensionPointConfig {
  point: string;
  interface: string;
  description?: string;
}

// --- Provider (DI) ---

export interface ProviderConfig {
  token: string;
  factory: string; // Factory function reference
  singleton?: boolean; // default: true
  transient?: boolean;
}

// --- Event System ---

export interface EventHandlerConfig {
  event: string;
  handler: string; // Handler reference
  priority?: number; // Higher = earlier execution, default: 0
}

export type EventCallback = (event: DomainEvent) => void | Promise<void>;

export interface DomainEvent {
  type: string;
  payload: unknown;
  timestamp: Date;
  source?: string; // Module ID that emitted the event
}

export interface Unsubscribe {
  (): void;
}

// --- API Routes ---

export interface ApiRouteConfig {
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  handler: string;
  middleware?: string[];
}

// --- MCP Tools ---

export interface McpToolConfig {
  name: string;
  description?: string;
  handler: string;
  inputSchema?: Record<string, unknown>;
}

// --- DI Container ---

export interface IDIContainer {
  register<T>(token: string, factory: (container: IDIContainer) => T, options?: RegisterOptions): void;
  resolve<T>(token: string): T;
  has(token: string): boolean;
  reset(): void;
}

export interface RegisterOptions {
  singleton?: boolean;
  tags?: string[];
}

// --- Event Bus ---

export interface IEventBus {
  emit(event: DomainEvent): void;
  emitAsync(event: DomainEvent): Promise<void>;
  on(eventType: string, callback: EventCallback, options?: OnOptions): Unsubscribe;
  once(eventType: string, callback: EventCallback): Unsubscribe;
  off(eventType: string, callback: EventCallback): void;
  removeAllListeners(eventType?: string): void;
  queryEvents?(filter: any): Promise<any[]>;
  replayEvents?(eventType: string, from?: Date): Promise<void>;
  getEventCount?(eventType?: string): Promise<number>;
}

export interface OnOptions {
  priority?: number;
}

// --- Module Registry ---

export interface IModuleRegistry {
  register(module: Module): void;
  enable(moduleId: string): Promise<void>;
  disable(moduleId: string): Promise<void>;
  uninstall(moduleId: string): Promise<void>;
  get(moduleId: string): ModuleInfo | undefined;
  list(): ModuleInfo[];
  isEnabled(moduleId: string): boolean;
  getEnabledModules(): Module[];
}

// --- Config ---

export interface IConfigAccessor {
  get<T>(key: string, defaultValue?: T): T;
  set(key: string, value: unknown): void;
  has(key: string): boolean;
  getModuleConfig<T>(moduleId: string, key?: string, defaultValue?: T): T;
}

// --- Database ---

export interface IDatabaseAccessor {
  query<T>(sql: string, params?: unknown[]): Promise<T[]>;
  execute(sql: string, params?: unknown[]): Promise<void>;
  transaction<T>(fn: () => Promise<T>): Promise<T>;
}

// --- Logger ---

export interface ILogger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, ...args: unknown[]): void;
  child(context: string): ILogger;
}

// --- Core Error Types ---

export class ModuleError extends Error {
  constructor(
    public readonly moduleId: string,
    message: string,
    public readonly cause?: Error
  ) {
    super(`[${moduleId}] ${message}`);
    this.name = 'ModuleError';
  }
}

export class ModuleNotFoundError extends ModuleError {
  constructor(moduleId: string) {
    super(moduleId, `Module not found: ${moduleId}`);
    this.name = 'ModuleNotFoundError';
  }
}

export class ModuleDependencyError extends ModuleError {
  constructor(moduleId: string, missingDependency: string) {
    super(moduleId, `Missing dependency: ${missingDependency}`);
    this.name = 'ModuleDependencyError';
  }
}

export class ModuleStateError extends ModuleError {
  constructor(moduleId: string, action: string, currentState: ModuleStatus) {
    super(moduleId, `Cannot ${action} module in state: ${currentState}`);
    this.name = 'ModuleStateError';
  }
}

export class DIResolveError extends Error {
  constructor(
    public readonly token: string,
    message?: string
  ) {
    super(message || `Cannot resolve dependency: ${token}`);
    this.name = 'DIResolveError';
  }
}
