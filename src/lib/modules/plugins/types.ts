// ============================================================
// Plugin Types
// ============================================================

export interface PluginManifest {
  name: string;
  displayName: string;
  description?: string;
  version: string;
  author?: string;
  homepage?: string;
  license?: string;
  entryPoint: string;
  capabilities?: PluginCapability[];
  configSchema?: Record<string, unknown>; // JSON Schema for plugin config
  settingsSchema?: Record<string, unknown>; // JSON Schema for user settings
}

export type PluginCapability =
  | 'task-tool'      // Adds custom task tools
  | 'ai-processor'   // Adds AI processing capability
  | 'notification'   // Adds notification channel
  | 'webhook'        // Adds webhook handler
  | 'dashboard-widget' // Adds dashboard widget
  | 'data-source'    // Adds external data source
  | 'export'         // Adds export format
  | 'ui-extension';  // Adds UI components

export interface PluginInstance {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  version: string;
  author: string | null;
  homepage: string | null;
  license: string | null;
  entryPoint: string;
  config: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  isEnabled: boolean;
  installedAt: Date;
  updatedAt: Date;
}

export interface PluginRegistry {
  name: string;
  displayName: string;
  description?: string;
  version: string;
  author?: string;
  capabilities: PluginCapability[];
  isEnabled: boolean;
  /** Called when plugin is loaded */
  activate?(ctx: PluginContext): Promise<void>;
  /** Called when plugin is unloaded */
  deactivate?(): Promise<void>;
}

export interface PluginContext {
  /** Register a custom tool */
  registerTool(tool: CustomToolDefinition): void;
  /** Register a webhook handler */
  registerWebhook(type: string, handler: (body: unknown) => Promise<unknown>): void;
  /** Emit events to the event bus */
  emit(eventType: string, payload: unknown): void;
  /** Access plugin config */
  getConfig(): Record<string, unknown>;
  /** Update plugin settings */
  updateSettings(settings: Record<string, unknown>): Promise<void>;
  /** Logger scoped to plugin name */
  logger: {
    info(msg: string): void;
    warn(msg: string): void;
    error(msg: string): void;
    debug(msg: string): void;
  };
}

export interface CustomToolDefinition {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}
