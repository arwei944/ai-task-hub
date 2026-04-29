import { v4 as uuidv4 } from 'uuid';
import type { Logger } from '@/lib/core/logger';
import type { EventBus } from '@/lib/core/event-bus';
import type { SOLOBridgeConfig, SOLOCallParams, SOLOCallResult, SOLOCallRecord, SOLOCallMode, SOLOSubAgentType } from '../types';
import { SOLOMCPClient } from './mcp-client';
import { SOLORESTClient } from './rest-client';
import { SOLOPullClient } from './pull-client';

interface SOLOClient {
  call(params: {
    prompt: string;
    subAgentType?: SOLOSubAgentType;
    sessionId: string;
    timeoutMs?: number;
  }): Promise<{ data?: unknown; error?: string; durationMs: number; tokensUsed?: number }>;
}

export class SOLOBridge {
  private clients: Map<SOLOCallMode, SOLOClient>;
  private callRecords: SOLOCallRecord[] = [];
  private activeSessions = new Map<string, number>();
  private readonly maxRecords = 1000;

  constructor(
    private config: SOLOBridgeConfig,
    private eventBus?: EventBus,
    private logger?: Logger,
  ) {
    this.clients = new Map();
    this.initClients();
  }

  private initClients(): void {
    this.clients.set('mcp', new SOLOMCPClient({
      endpoint: this.config.mcpEndpoint,
      defaultTimeoutMs: this.config.defaultTimeoutMs,
    }));
    this.clients.set('rest', new SOLORESTClient({
      endpoint: this.config.restEndpoint,
      defaultTimeoutMs: this.config.defaultTimeoutMs,
    }));
    this.clients.set('pull', new SOLOPullClient({
      defaultTimeoutMs: this.config.defaultTimeoutMs,
    }));
    this.logger?.info('SOLO Bridge initialized', {
      modes: Array.from(this.clients.keys()),
      defaultMode: this.config.defaultMode,
    });
  }

  async call(params: SOLOCallParams): Promise<SOLOCallResult> {
    const mode = params.callMode ?? this.config.defaultMode;
    const client = this.clients.get(mode);
    if (!client) {
      const error = `Unknown SOLO call mode: ${mode}`;
      this.logger?.error(error);
      return { success: false, error, sessionId: params.sessionId ?? '', durationMs: 0 };
    }
    const sessionId = params.sessionId ?? this.createSessionId();
    const record = this.createRecord({ ...params, callMode: mode, sessionId });
    try {
      this.eventBus?.emit({ type: 'solo.call.started', payload: record, timestamp: new Date(), source: 'workflow-engine' });
      const startTime = Date.now();
      const result = await client.call({
        prompt: params.prompt,
        subAgentType: params.subAgentType,
        sessionId,
        timeoutMs: params.timeoutMs ?? this.config.defaultTimeoutMs,
      });
      const durationMs = Date.now() - startTime;
      record.output = result.data;
      record.durationMs = durationMs;
      record.tokensUsed = result.tokensUsed;
      record.completedAt = new Date();
      this.eventBus?.emit({ type: 'solo.call.completed', payload: { ...record, output: result.data }, timestamp: new Date(), source: 'workflow-engine' });
      this.activeSessions.set(sessionId, Date.now());
      return { success: true, data: result.data, sessionId, durationMs, tokensUsed: result.tokensUsed };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      record.error = errorMsg;
      record.completedAt = new Date();
      this.eventBus?.emit({ type: 'solo.call.failed', payload: { ...record, error: errorMsg }, timestamp: new Date(), source: 'workflow-engine' });
      return { success: false, error: errorMsg, sessionId, durationMs: record.durationMs };
    } finally {
      this.addRecord(record);
    }
  }

  createSessionId(): string {
    return `solo-${uuidv4().slice(0, 8)}`;
  }

  getRecords(options?: { executionId?: string; stepId?: string; limit?: number }): SOLOCallRecord[] {
    let records = [...this.callRecords];
    if (options?.executionId) records = records.filter(r => r.executionId === options.executionId);
    if (options?.stepId) records = records.filter(r => r.stepId === options.stepId);
    if (options?.limit) records = records.slice(-options.limit);
    return records;
  }

  getActiveSessionCount(): number {
    this.cleanupStaleSessions();
    return this.activeSessions.size;
  }

  private cleanupStaleSessions(): void {
    const staleThreshold = 30 * 60 * 1000;
    const now = Date.now();
    for (const [sessionId, lastUsed] of this.activeSessions.entries()) {
      if (now - lastUsed > staleThreshold) this.activeSessions.delete(sessionId);
    }
  }

  private createRecord(params: {
    executionId: string; stepId: string; stepName: string;
    callMode: SOLOCallMode; subAgentType?: SOLOSubAgentType;
    sessionId: string; prompt: string;
  }): SOLOCallRecord {
    return {
      id: uuidv4(), executionId: params.executionId, stepId: params.stepId,
      stepName: params.stepName, callMode: params.callMode,
      subAgentType: params.subAgentType ?? 'explore', sessionId: params.sessionId,
      prompt: params.prompt, durationMs: 0, startedAt: new Date(),
    };
  }

  private addRecord(record: SOLOCallRecord): void {
    this.callRecords.push(record);
    if (this.callRecords.length > this.maxRecords) {
      this.callRecords = this.callRecords.slice(-this.maxRecords);
    }
  }
}