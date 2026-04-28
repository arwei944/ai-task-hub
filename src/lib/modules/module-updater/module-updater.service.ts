// ============================================================
// Module Hot Update Service
// ============================================================
//
// Provides runtime module lifecycle management:
// - Hot reload: disable → re-enable module (preserving state)
// - Rollback: revert to previous module version
// - Dynamic enable/disable: start/stop modules at runtime
//

import type { ILogger } from '@/lib/core/types';
import type { IModuleRegistry } from '@/lib/core/types';
import type { IEventBus } from '@/lib/core/types';
import type { Module } from '@/lib/core/types';
import { ModuleVersionRepository } from './module-version.repository';
import { AppVersionRepository } from './app-version.repository';
import type {
  HotUpdateOptions,
  HotUpdateResult,
  ModuleUpdateInfo,
  VersionCheckResult,
} from './types';

export class ModuleUpdaterService {
  private updateHistory: Map<string, HotUpdateResult[]> = new Map();
  private updatingModules: Set<string> = new Set();

  constructor(
    private moduleVersionRepo: ModuleVersionRepository,
    private appVersionRepo: AppVersionRepository,
    private registry: IModuleRegistry,
    private eventBus: IEventBus,
    private logger: ILogger,
  ) {}

  /**
   * Hot reload a module: disable → re-enable
   * This preserves the module registration but restarts its lifecycle
   */
  async hotReload(moduleId: string, reason?: string): Promise<HotUpdateResult> {
    if (this.updatingModules.has(moduleId)) {
      return {
        success: false,
        moduleId,
        currentVersion: 'unknown',
        action: 'reloaded',
        timestamp: new Date(),
        error: 'Module is already being updated',
      };
    }

    const startTime = Date.now();
    this.updatingModules.add(moduleId);

    try {
      const info = this.registry.get(moduleId);
      if (!info) {
        throw new Error(`Module not found: ${moduleId}`);
      }

      const wasEnabled = info.status === 'enabled';

      // Disable if enabled
      if (wasEnabled) {
        await this.registry.disable(moduleId);
        this.logger.info(`[HotUpdate] Module disabled: ${moduleId}`);
      }

      // Re-enable
      await this.registry.enable(moduleId);
      this.logger.info(`[HotUpdate] Module re-enabled: ${moduleId}`);

      const result: HotUpdateResult = {
        success: true,
        moduleId,
        previousVersion: info.module.version,
        currentVersion: info.module.version,
        action: 'reloaded',
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };

      // Record version history
      await this.moduleVersionRepo.create({
        moduleId,
        version: info.module.version,
        changelog: reason ?? `Hot reload at ${new Date().toISOString()}`,
      });

      // Emit event
      await this.eventBus.emitAsync({
        type: 'module.hot-reloaded',
        payload: { moduleId, version: info.module.version, reason },
        timestamp: new Date(),
        source: 'module-updater',
      });

      this.recordHistory(moduleId, result);
      return result;
    } catch (error: any) {
      const result: HotUpdateResult = {
        success: false,
        moduleId,
        currentVersion: 'unknown',
        action: 'reloaded',
        timestamp: new Date(),
        error: error.message,
        duration: Date.now() - startTime,
      };

      this.recordHistory(moduleId, result);

      await this.eventBus.emitAsync({
        type: 'module.update-failed',
        payload: { moduleId, error: error.message },
        timestamp: new Date(),
        source: 'module-updater',
      });

      return result;
    } finally {
      this.updatingModules.delete(moduleId);
    }
  }

  /**
   * Enable a module at runtime
   */
  async enableModule(moduleId: string): Promise<HotUpdateResult> {
    const startTime = Date.now();

    try {
      const info = this.registry.get(moduleId);
      if (!info) throw new Error(`Module not found: ${moduleId}`);

      await this.registry.enable(moduleId);

      const result: HotUpdateResult = {
        success: true,
        moduleId,
        currentVersion: info.module.version,
        action: 'enabled',
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };

      this.recordHistory(moduleId, result);
      return result;
    } catch (error: any) {
      return {
        success: false,
        moduleId,
        currentVersion: 'unknown',
        action: 'enabled',
        timestamp: new Date(),
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Disable a module at runtime
   */
  async disableModule(moduleId: string): Promise<HotUpdateResult> {
    const startTime = Date.now();

    try {
      const info = this.registry.get(moduleId);
      if (!info) throw new Error(`Module not found: ${moduleId}`);

      await this.registry.disable(moduleId);

      const result: HotUpdateResult = {
        success: true,
        moduleId,
        currentVersion: info.module.version,
        action: 'disabled',
        timestamp: new Date(),
        duration: Date.now() - startTime,
      };

      this.recordHistory(moduleId, result);
      return result;
    } catch (error: any) {
      return {
        success: false,
        moduleId,
        currentVersion: 'unknown',
        action: 'disabled',
        timestamp: new Date(),
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Rollback a module to its previous version
   */
  async rollback(moduleId: string): Promise<HotUpdateResult> {
    const startTime = Date.now();

    try {
      const previous = await this.moduleVersionRepo.findPrevious(
        moduleId,
        this.registry.get(moduleId)?.module.version ?? '',
      );

      if (!previous) {
        throw new Error('No previous version available for rollback');
      }

      // Hot reload to apply rollback
      const reloadResult = await this.hotReload(moduleId, `Rollback to ${previous.version}`);

      if (reloadResult.success) {
        await this.moduleVersionRepo.updateStatus(previous.id, 'rollback');
      }

      return {
        ...reloadResult,
        previousVersion: previous.version,
        action: 'rollback',
      };
    } catch (error: any) {
      return {
        success: false,
        moduleId,
        currentVersion: 'unknown',
        action: 'rollback',
        timestamp: new Date(),
        error: error.message,
        duration: Date.now() - startTime,
      };
    }
  }

  /**
   * Get update info for a specific module
   */
  getModuleUpdateInfo(moduleId: string): ModuleUpdateInfo {
    const info = this.registry.get(moduleId);
    const history = this.updateHistory.get(moduleId) ?? [];

    return {
      moduleId,
      currentVersion: info?.module.version ?? 'unknown',
      status: this.updatingModules.has(moduleId) ? 'updating' : 'idle',
      lastUpdateAt: history[0]?.timestamp,
      lastError: history[0]?.error,
      updateHistory: history,
    };
  }

  /**
   * Get update info for all modules
   */
  getAllModuleUpdateInfo(): ModuleUpdateInfo[] {
    return this.registry.list().map((info) =>
      this.getModuleUpdateInfo(info.module.id),
    );
  }

  /**
   * Check for app updates
   */
  async checkForUpdates(channel?: string): Promise<VersionCheckResult> {
    const current = await this.appVersionRepo.getCurrent();
    const latest = await this.appVersionRepo.getLatest(channel);

    const currentVersion = current?.version ?? '0.0.0';
    const latestVersion = latest?.version ?? currentVersion;

    return {
      currentVersion,
      latestVersion,
      hasUpdate: this.compareVersions(latestVersion, currentVersion) > 0,
      channel: channel ?? 'stable',
      releaseNotes: latest?.releaseNotes ?? undefined,
    };
  }

  /**
   * Publish a new app version
   */
  async publishVersion(data: {
    version: string;
    channel?: string;
    releaseNotes?: string;
    checksum?: string;
    setAsCurrent?: boolean;
  }) {
    return this.appVersionRepo.create({
      version: data.version,
      channel: data.channel,
      releaseNotes: data.releaseNotes,
      checksum: data.checksum,
      isCurrent: data.setAsCurrent,
    });
  }

  /**
   * Get app version history
   */
  async getVersionHistory(channel?: string) {
    return this.appVersionRepo.list(channel);
  }

  /**
   * Get module version history
   */
  async getModuleVersionHistory(moduleId: string) {
    return this.moduleVersionRepo.findByModuleId(moduleId);
  }

  private recordHistory(moduleId: string, result: HotUpdateResult): void {
    const history = this.updateHistory.get(moduleId) ?? [];
    history.unshift(result);
    // Keep last 50 entries
    if (history.length > 50) history.length = 50;
    this.updateHistory.set(moduleId, history);
  }

  private compareVersions(a: string, b: string): number {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < 3; i++) {
      const va = pa[i] ?? 0;
      const vb = pb[i] ?? 0;
      if (va !== vb) return va - vb;
    }
    return 0;
  }
}
