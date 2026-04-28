import fs from 'fs';
import path from 'path';
import yaml from 'js-yaml';
import type { IConfigAccessor } from './types';

interface ModuleConfig {
  enabled: boolean;
  locked?: boolean;
  config?: Record<string, unknown>;
}

interface AppConfig {
  modules: Record<string, ModuleConfig>;
  app?: Record<string, unknown>;
}

export class ConfigAccessor implements IConfigAccessor {
  private config: AppConfig;
  private configPath: string;

  constructor(configPath?: string) {
    this.configPath = configPath ?? path.join(process.cwd(), 'config', 'modules.yaml');
    this.config = this.loadConfig();
  }

  private loadConfig(): AppConfig {
    try {
      if (fs.existsSync(this.configPath)) {
        const raw = fs.readFileSync(this.configPath, 'utf-8');
        const parsed = yaml.load(raw) as AppConfig;
        return this.resolveEnvVars(parsed);
      }
    } catch (error) {
      console.warn(`[Config] Failed to load config from ${this.configPath}:`, error);
    }
    return { modules: {} };
  }

  private resolveEnvVars(config: AppConfig): AppConfig {
    const jsonStr = JSON.stringify(config);
    const resolved = jsonStr.replace(/\$\{(\w+)\}/g, (_, varName) => {
      return process.env[varName] ?? '';
    });
    return JSON.parse(resolved);
  }

  reload(): void {
    this.config = this.loadConfig();
  }

  get<T>(key: string, defaultValue?: T): T {
    const keys = key.split('.');
    let current: unknown = this.config;
    for (const k of keys) {
      if (current && typeof current === 'object' && k in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[k];
      } else {
        return defaultValue as T;
      }
    }
    return current as T;
  }

  set(key: string, value: unknown): void {
    const keys = key.split('.');
    let current: Record<string, unknown> = this.config as unknown as Record<string, unknown>;
    for (let i = 0; i < keys.length - 1; i++) {
      if (!(keys[i] in current)) {
        current[keys[i]] = {};
      }
      current = current[keys[i]] as Record<string, unknown>;
    }
    current[keys[keys.length - 1]] = value;
  }

  has(key: string): boolean {
    try {
      const value = this.get(key);
      return value !== undefined;
    } catch {
      return false;
    }
  }

  getModuleConfig<T>(moduleId: string, key?: string, defaultValue?: T): T {
    const moduleConf = this.config.modules[moduleId];
    if (!moduleConf) return defaultValue as T;
    if (!key) return (moduleConf.config ?? defaultValue) as T;
    const keys = key.split('.');
    let current: unknown = moduleConf.config;
    for (const k of keys) {
      if (current && typeof current === 'object' && k in (current as Record<string, unknown>)) {
        current = (current as Record<string, unknown>)[k];
      } else {
        return defaultValue as T;
      }
    }
    return current as T;
  }

  isModuleEnabled(moduleId: string): boolean {
    return this.config.modules[moduleId]?.enabled ?? false;
  }

  isModuleLocked(moduleId: string): boolean {
    return this.config.modules[moduleId]?.locked ?? false;
  }

  getAllModuleConfigs(): Record<string, ModuleConfig> {
    return { ...this.config.modules };
  }

  getRawConfig(): AppConfig {
    return { ...this.config };
  }
}
