// ============================================================
// Integration Adapter Interface
// ============================================================
//
// All platform integrations must implement this interface.
// New integrations can be added by creating a module that
// registers an IntegrationAdapter implementation.
//

import type { TaskService } from '@/lib/modules/task-core/task.service';

export interface SyncOptions {
  /** Sync only tasks updated after this timestamp */
  since?: Date;
  /** Maximum number of tasks to sync */
  limit?: number;
  /** Specific external IDs to sync */
  externalIds?: string[];
}

export interface SyncResult {
  success: boolean;
  synced: number;
  created: number;
  updated: number;
  errors: string[];
}

export interface PushResult {
  success: boolean;
  externalId?: string;
  externalUrl?: string;
  error?: string;
}

export interface IntegrationAdapter {
  /** Unique type identifier (e.g., 'github', 'feishu', 'notion') */
  readonly type: string;

  /** Human-readable name */
  readonly name: string;

  /** Sync tasks from external platform */
  pullTasks(options?: SyncOptions, taskService?: TaskService): Promise<SyncResult>;

  /** Push a task to external platform */
  pushTask(task: { title: string; description?: string; status?: string; priority?: string; externalId?: string }): Promise<PushResult>;

  /** Handle incoming webhook payload */
  handleWebhook(payload: unknown, headers?: Record<string, string>): Promise<void>;

  /** Test the connection to the external platform */
  testConnection(config: Record<string, string>): Promise<{ success: boolean; error?: string }>;
}

export interface IntegrationConfig {
  [key: string]: string | number | boolean | undefined;
}
