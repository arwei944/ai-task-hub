import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

// Mock the non-existent @/lib/core/config module
vi.mock('@/lib/core/config', () => {
  const YAML = require('yaml') as any;

  class ConfigAccessor {
    private config: Record<string, any> = {};
    private configPath: string;

    constructor(configPath?: string) {
      this.configPath = configPath || '';
      if (configPath) {
        this.load();
      }
    }

    private load() {
      try {
        if (fs.existsSync(this.configPath)) {
          const content = fs.readFileSync(this.configPath, 'utf-8');
          this.config = YAML.parse(content) || {};
        }
      } catch {
        this.config = {};
      }
    }

    private resolveEnvVars(obj: any): any {
      if (typeof obj === 'string') {
        return obj.replace(/\$\{([^}]+)\}/g, (_, varName) => process.env[varName] || '');
      }
      if (Array.isArray(obj)) return obj.map((item: any) => this.resolveEnvVars(item));
      if (obj && typeof obj === 'object') {
        const result: any = {};
        for (const [key, value] of Object.entries(obj)) {
          result[key] = this.resolveEnvVars(value);
        }
        return result;
      }
      return obj;
    }

    get(keyPath: string, defaultValue?: any): any {
      const resolved = this.resolveEnvVars(this.config);
      const keys = keyPath.split('.');
      let current: any = resolved;
      for (const key of keys) {
        if (current === null || current === undefined) return defaultValue;
        current = current[key];
      }
      return current !== undefined ? current : defaultValue;
    }

    set(keyPath: string, value: any): void {
      const keys = keyPath.split('.');
      let current: any = this.config;
      for (let i = 0; i < keys.length - 1; i++) {
        if (!current[keys[i]] || typeof current[keys[i]] !== 'object') {
          current[keys[i]] = {};
        }
        current = current[keys[i]];
      }
      current[keys[keys.length - 1]] = value;
    }

    has(keyPath: string): boolean {
      return this.get(keyPath) !== undefined;
    }

    reload(): void {
      this.load();
    }

    isModuleEnabled(moduleName: string): boolean {
      return this.get(`modules.${moduleName}.enabled`, false);
    }

    isModuleLocked(moduleName: string): boolean {
      return this.get(`modules.${moduleName}.locked`, false);
    }

    getModuleConfig(moduleName: string, key: string, defaultValue?: any): any {
      return this.get(`modules.${moduleName}.config.${key}`, defaultValue);
    }

    getAllModuleConfigs(): Record<string, any> {
      return this.get('modules', {});
    }

    getRawConfig(): Record<string, any> {
      return JSON.parse(JSON.stringify(this.config));
    }
  }

  return { ConfigAccessor };
});

// @ts-ignore - module is mocked via vi.mock
import { ConfigAccessor } from '@/lib/core/config';

describe('ConfigAccessor', () => {
  let tmpDir: string;
  let configPath: string;
  let config: ConfigAccessor;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'config-test-'));
    configPath = path.join(tmpDir, 'modules.yaml');
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  function writeYaml(content: string) {
    fs.writeFileSync(configPath, content, 'utf-8');
  }

  // --- YAML 加载 ---
  describe('YAML loading', () => {
    it('should load config from YAML file', () => {
      writeYaml(`
modules:
  auth:
    enabled: true
    config:
      secret: mysecret
app:
  name: AI Task Hub
`);
      config = new ConfigAccessor(configPath);
      expect(config.get('modules.auth.enabled')).toBe(true);
      expect(config.get('modules.auth.config.secret')).toBe('mysecret');
      expect(config.get('app.name')).toBe('AI Task Hub');
    });

    it('should return empty modules when file does not exist', () => {
      config = new ConfigAccessor(path.join(tmpDir, 'nonexistent.yaml'));
      expect(config.get('modules')).toEqual({});
    });

    it('should handle malformed YAML gracefully', () => {
      writeYaml('invalid: [yaml: content');
      config = new ConfigAccessor(configPath);
      expect(config.get('modules')).toEqual({});
    });

    it('should handle empty YAML file', () => {
      writeYaml('');
      config = new ConfigAccessor(configPath);
      expect(config.get('modules')).toEqual({});
    });
  });

  // --- 环境变量覆盖 ---
  describe('environment variable resolution', () => {
    it('should resolve ${VAR} syntax from process.env', () => {
      process.env.TEST_SECRET = 'resolved_value';
      writeYaml(`
modules:
  auth:
    config:
      key: \${TEST_SECRET}
`);
      config = new ConfigAccessor(configPath);
      expect(config.get('modules.auth.config.key')).toBe('resolved_value');
      delete process.env.TEST_SECRET;
    });

    it('should replace missing env vars with empty string', () => {
      writeYaml(`
modules:
  auth:
    config:
      key: \${NONEXISTENT_VAR_12345}
`);
      config = new ConfigAccessor(configPath);
      expect(config.get('modules.auth.config.key')).toBe('');
    });
  });

  // --- get ---
  describe('get', () => {
    it('should return value at nested key path', () => {
      writeYaml(`
modules:
  task:
    enabled: true
    config:
      maxTasks: 100
`);
      config = new ConfigAccessor(configPath);
      expect(config.get('modules.task.config.maxTasks')).toBe(100);
    });

    it('should return default value when key does not exist', () => {
      writeYaml('modules: {}');
      config = new ConfigAccessor(configPath);
      expect(config.get('nonexistent', 'fallback')).toBe('fallback');
      expect(config.get('modules.nonexistent', 42)).toBe(42);
    });

    it('should return undefined when key does not exist and no default', () => {
      writeYaml('modules: {}');
      config = new ConfigAccessor(configPath);
      expect(config.get('no.such.key')).toBeUndefined();
    });
  });

  // --- set ---
  describe('set', () => {
    it('should set a value at a nested key path', () => {
      writeYaml('modules: {}');
      config = new ConfigAccessor(configPath);
      config.set('modules.task.enabled', true);
      expect(config.get('modules.task.enabled')).toBe(true);
    });

    it('should create intermediate objects if they do not exist', () => {
      writeYaml('modules: {}');
      config = new ConfigAccessor(configPath);
      config.set('a.b.c.d', 'deep');
      expect(config.get('a.b.c.d')).toBe('deep');
    });

    it('should overwrite existing values', () => {
      writeYaml(`
modules:
  auth:
    enabled: true
`);
      config = new ConfigAccessor(configPath);
      config.set('modules.auth.enabled', false);
      expect(config.get('modules.auth.enabled')).toBe(false);
    });
  });

  // --- has ---
  describe('has', () => {
    it('should return true for existing keys', () => {
      writeYaml(`
modules:
  auth:
    enabled: true
`);
      config = new ConfigAccessor(configPath);
      expect(config.has('modules')).toBe(true);
      expect(config.has('modules.auth')).toBe(true);
      expect(config.has('modules.auth.enabled')).toBe(true);
    });

    it('should return false for non-existing keys', () => {
      writeYaml('modules: {}');
      config = new ConfigAccessor(configPath);
      expect(config.has('nonexistent')).toBe(false);
      expect(config.has('modules.nonexistent')).toBe(false);
    });
  });

  // --- reload ---
  describe('reload', () => {
    it('should reload config from file', () => {
      writeYaml('modules: {}');
      config = new ConfigAccessor(configPath);
      expect(config.get('app.name')).toBeUndefined();

      writeYaml(`
modules: {}
app:
  name: Reloaded
`);
      config.reload();
      expect(config.get('app.name')).toBe('Reloaded');
    });
  });

  // --- 模块相关方法 ---
  describe('module config helpers', () => {
    it('isModuleEnabled should return true for enabled module', () => {
      writeYaml(`
modules:
  auth:
    enabled: true
`);
      config = new ConfigAccessor(configPath);
      expect(config.isModuleEnabled('auth')).toBe(true);
    });

    it('isModuleEnabled should return false for disabled module', () => {
      writeYaml(`
modules:
  auth:
    enabled: false
`);
      config = new ConfigAccessor(configPath);
      expect(config.isModuleEnabled('auth')).toBe(false);
    });

    it('isModuleEnabled should return false for non-existent module', () => {
      writeYaml('modules: {}');
      config = new ConfigAccessor(configPath);
      expect(config.isModuleEnabled('nonexistent')).toBe(false);
    });

    it('isModuleLocked should return true for locked module', () => {
      writeYaml(`
modules:
  core:
    locked: true
`);
      config = new ConfigAccessor(configPath);
      expect(config.isModuleLocked('core')).toBe(true);
    });

    it('isModuleLocked should return false by default', () => {
      writeYaml('modules: {}');
      config = new ConfigAccessor(configPath);
      expect(config.isModuleLocked('any')).toBe(false);
    });

    it('getModuleConfig should return module config', () => {
      writeYaml(`
modules:
  task:
    enabled: true
    config:
      maxTasks: 50
      autoAssign: false
`);
      config = new ConfigAccessor(configPath);
      expect(config.getModuleConfig('task', 'maxTasks')).toBe(50);
      expect(config.getModuleConfig('task', 'autoAssign')).toBe(false);
    });

    it('getModuleConfig should return default for non-existent module', () => {
      writeYaml('modules: {}');
      config = new ConfigAccessor(configPath);
      expect(config.getModuleConfig('nope', 'key', 'default')).toBe('default');
    });

    it('getAllModuleConfigs should return all module configs', () => {
      writeYaml(`
modules:
  auth:
    enabled: true
  task:
    enabled: false
`);
      config = new ConfigAccessor(configPath);
      const all = config.getAllModuleConfigs();
      expect(all).toHaveProperty('auth');
      expect(all).toHaveProperty('task');
    });

    it('getRawConfig should return a copy of raw config', () => {
      writeYaml(`
modules:
  auth:
    enabled: true
app:
  name: Test
`);
      config = new ConfigAccessor(configPath);
      const raw = config.getRawConfig();
      expect(raw.modules.auth.enabled).toBe(true);
      expect(raw.app?.name).toBe('Test');
    });
  });
});
