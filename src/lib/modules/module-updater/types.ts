// ============================================================
// Module Hot Update System - Types
// ============================================================

export interface HotUpdateOptions {
  /** Module ID to update */
  moduleId: string;
  /** Target version (optional, defaults to latest) */
  targetVersion?: string;
  /** Whether to force update even if checks fail */
  force?: boolean;
  /** Reason for the update */
  reason?: string;
}

export interface HotUpdateResult {
  success: boolean;
  moduleId: string;
  previousVersion?: string;
  currentVersion: string;
  action: 'enabled' | 'disabled' | 'reloaded' | 'rollback';
  timestamp: Date;
  error?: string;
  duration?: number;
}

export interface ModuleUpdateInfo {
  moduleId: string;
  currentVersion: string;
  status: 'idle' | 'updating' | 'error';
  lastUpdateAt?: Date;
  lastError?: string;
  updateHistory: HotUpdateResult[];
}

export interface AppVersionInfo {
  version: string;
  channel: 'stable' | 'beta' | 'canary';
  releaseNotes?: string;
  checksum?: string;
  isCurrent: boolean;
  publishedAt: Date;
}

export interface VersionCheckResult {
  currentVersion: string;
  latestVersion: string;
  hasUpdate: boolean;
  channel: string;
  releaseNotes?: string;
  downloadUrl?: string;
}
