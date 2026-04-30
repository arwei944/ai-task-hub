// Core types
export * from './types';

// Core implementations
export { EventBus } from './event-bus';
export type { EventBusConfig } from './event-bus';
export { DIContainer } from './di-container';
export { ModuleRegistry } from './registry';
export { ConfigAccessor } from './config';
export { Logger } from './logger';
export { ModuleKernel } from './kernel';

// Centralized version management (single source of truth)
export {
  APP_VERSION,
  APP_NAME,
  APP_CODENAME,
  getModuleVersion,
  getFullVersionString,
  getVersionInfo,
  parseSemver,
  compareVersions,
  isPrerelease,
  isStable,
  VERSION_HISTORY,
} from './version';

// Events (v2)
export * from './events';
