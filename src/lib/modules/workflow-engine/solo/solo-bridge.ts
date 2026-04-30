import { v4 as uuidv4 } from 'uuid';
import type { Logger } from '@/lib/core/logger';
import type { EventBus } from '@/lib/core/event-bus';
import type { SOLOBridgeConfig, SOLOCallParams, SOLOCallResult, SOLOCallRecord, SOLOCallMode, SOLOSubAgentType } from '../types';
import { SOLOMCPClient } from './mcp-client';
import { SOLORESTClient } from './rest-client';
import { SOLOPullClient } from './pull-client';
import type { PendingPullTask, PullTaskResult } from './pull-client';

/** SOLO 客户端接口 */
interface SOLOClient {
  call(params: {
    prompt: string;
    subAgentType?: SOLOSubAgentType;
    sessionId: string;
    timeoutMs?: number;
    context?: Record<string, unknown>;
  }): Promise<{ data?: unknown; error?: string; durationMs: number; tokensUsed?: number }>;
  healthCheck?(): Promise<boolean>;
}

/** 熔断器状态 */
type CircuitState = 'closed' | 'open' | 'half_open';

/** 熔断器配置 */
interface CircuitBreakerConfig {
  failureThreshold: number;
  cooldownMs: number;
}

/** SOLO Bridge 健康状态 */
export interface SOLOBridgeHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  circuitState: CircuitState;
  clients: Record<string, { connected: boolean; endpoint?: string }>;
  activeSessions: number;
  consecutiveFailures: number;
  cooldownUntil?: number;
}

/** SOLO Bridge 统计信息 */
export interface SOLOBridgeStats {
  totalCalls: number;
  successCalls: number;
  failedCalls: number;
  successRate: number;
  avgDurationMs: number;
  totalTokensUsed: number;
  callsByMode: Record<string, number>;
  callsBySubAgent: Record<string, number>;
}

/**
 * SOLO Bridge
 * 工作流引擎与 SOLO AI 之间的桥接层
 *
 * 支持三种通信模式：MCP（协议）、REST（HTTP API）、Pull（SOLO 主动拉取）。
 * 内置熔断器模式：连续 3 次失败后进入 30 秒冷却期。
 * 提供健康检查和统计接口。
 */
export class SOLOBridge {
  private clients: Map<SOLOCallMode, SOLOClient>;
  private mcpClient: SOLOMCPClient | null = null;
  private restClient: SOLORESTClient | null = null;
  private pullClient: SOLOPullClient | null = null;
  private callRecords: SOLOCallRecord[] = [];
  private activeSessions = new Map<string, number>(); // sessionId -> lastUsed timestamp
  private readonly maxRecords = 1000;

  // 熔断器
  private circuitState: CircuitState = 'closed';
  private consecutiveFailures = 0;
  private cooldownUntil = 0;
  private readonly circuitConfig: CircuitBreakerConfig = {
    failureThreshold: 3,
    cooldownMs: 30000,
  };

  // 统计
  private totalCalls = 0;
  private successCalls = 0;
  private failedCalls = 0;
  private totalDurationMs = 0;
  private totalTokensUsed = 0;
  private callsByMode: Record<string, number> = {};
  private callsBySubAgent: Record<string, number> = {};

  constructor(
    private config: SOLOBridgeConfig,
    private eventBus?: EventBus,
    private logger?: Logger,
  ) {
    this.clients = new Map();
    this.initClients();
  }

  private initClients(): void {
    // MCP 客户端
    this.mcpClient = new SOLOMCPClient({
      endpoint: this.config.mcpEndpoint,
      defaultTimeoutMs: this.config.defaultTimeoutMs,
    });
    this.clients.set('mcp', this.mcpClient);

    // REST 客户端
    this.restClient = new SOLORESTClient({
      endpoint: this.config.restEndpoint,
      defaultTimeoutMs: this.config.defaultTimeoutMs,
    });
    this.clients.set('rest', this.restClient);

    // Pull 客户端 (SOLO 主动拉取)
    this.pullClient = new SOLOPullClient({
      defaultTimeoutMs: this.config.defaultTimeoutMs,
    });
    this.clients.set('pull', this.pullClient);

    this.logger?.info('SOLO Bridge initialized', {
      modes: Array.from(this.clients.keys()),
      defaultMode: this.config.defaultMode,
      mcpEndpoint: this.config.mcpEndpoint ?? 'http://localhost:3001/mcp',
      restEndpoint: this.config.restEndpoint ?? 'http://localhost:3001/api/solo/call',
    });
  }

  /**
   * 调用 SOLO
   * 根据配置的模式选择客户端，通过熔断器保护调用
   *
   * @param params - SOLO 调用参数
   * @returns SOLO 调用结果
   */
  async call(params: SOLOCallParams): Promise<SOLOCallResult> {
    // 检查熔断器状态
    if (this.circuitState === 'open') {
      if (Date.now() < this.cooldownUntil) {
        const errorMsg = `SOLO Bridge circuit breaker is open (cooldown until ${new Date(this.cooldownUntil).toISOString()})`;
        this.logger?.warn(errorMsg);
        return {
          success: false,
          error: errorMsg,
          sessionId: params.sessionId ?? '',
          durationMs: 0,
        };
      }
      // 冷却期结束，进入半开状态
      this.circuitState = 'half_open';
      this.logger?.info('SOLO Bridge circuit breaker entering half-open state');
    }

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
      this.logger?.info(`SOLO call started: ${params.stepName}`, {
        mode,
        subAgent: params.subAgentType,
        sessionId,
      });

      const startTime = Date.now();
      const result = await client.call({
        prompt: params.prompt,
        subAgentType: params.subAgentType,
        sessionId,
        timeoutMs: params.timeoutMs ?? this.config.defaultTimeoutMs,
        context: params.context,
      });
      const durationMs = Date.now() - startTime;

      // 更新记录
      record.output = result.data;
      record.durationMs = durationMs;
      record.tokensUsed = result.tokensUsed;
      record.completedAt = new Date();

      // 更新统计
      this.totalCalls++;
      this.successCalls++;
      this.totalDurationMs += durationMs;
      if (result.tokensUsed) this.totalTokensUsed += result.tokensUsed;
      this.callsByMode[mode] = (this.callsByMode[mode] ?? 0) + 1;
      this.callsBySubAgent[params.subAgentType ?? 'explore'] = (this.callsBySubAgent[params.subAgentType ?? 'explore'] ?? 0) + 1;

      // 熔断器：成功时重置
      if (this.circuitState === 'half_open') {
        this.circuitState = 'closed';
        this.consecutiveFailures = 0;
        this.logger?.info('SOLO Bridge circuit breaker closed (recovered)');
      } else if (this.circuitState === 'closed') {
        this.consecutiveFailures = 0;
      }

      this.eventBus?.emit({ type: 'solo.call.completed', payload: { ...record, output: result.data }, timestamp: new Date(), source: 'workflow-engine' });
      this.logger?.info(`SOLO call completed: ${params.stepName}`, {
        durationMs,
        tokensUsed: result.tokensUsed,
      });

      // 更新会话活跃时间
      this.activeSessions.set(sessionId, Date.now());

      return {
        success: true,
        data: result.data,
        sessionId,
        durationMs,
        tokensUsed: result.tokensUsed,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      record.error = errorMsg;
      record.completedAt = new Date();

      // 更新统计
      this.totalCalls++;
      this.failedCalls++;
      this.callsByMode[mode] = (this.callsByMode[mode] ?? 0) + 1;

      // 熔断器：失败时递增
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= this.circuitConfig.failureThreshold) {
        this.circuitState = 'open';
        this.cooldownUntil = Date.now() + this.circuitConfig.cooldownMs;
        this.logger?.error(`SOLO Bridge circuit breaker opened after ${this.consecutiveFailures} consecutive failures. Cooldown for ${this.circuitConfig.cooldownMs}ms`);
      }

      this.eventBus?.emit({ type: 'solo.call.failed', payload: { ...record, error: errorMsg }, timestamp: new Date(), source: 'workflow-engine' });
      this.logger?.error(`SOLO call failed: ${params.stepName}`, { error: errorMsg });

      return {
        success: false,
        error: errorMsg,
        sessionId,
        durationMs: record.durationMs,
      };
    } finally {
      this.addRecord(record);
    }
  }

  /**
   * 获取 SOLO Bridge 健康状态
   * 检查所有客户端连接状态和熔断器状态
   *
   * @returns 健康状态对象
   */
  async getHealth(): Promise<SOLOBridgeHealth> {
    const clientHealths: Record<string, { connected: boolean; endpoint?: string }> = {};

    // MCP 客户端健康检查
    if (this.mcpClient) {
      try {
        const healthy = await this.mcpClient.healthCheck();
        clientHealths['mcp'] = {
          connected: healthy,
          endpoint: this.mcpClient.getEndpoint(),
        };
      } catch {
        clientHealths['mcp'] = {
          connected: false,
          endpoint: this.mcpClient.getEndpoint(),
        };
      }
    }

    // REST 客户端健康检查
    if (this.restClient) {
      try {
        const healthy = await this.restClient.healthCheck();
        clientHealths['rest'] = {
          connected: healthy,
          endpoint: this.restClient.getEndpoint(),
        };
      } catch {
        clientHealths['rest'] = {
          connected: false,
          endpoint: this.restClient.getEndpoint(),
        };
      }
    }

    // Pull 客户端始终可用
    if (this.pullClient) {
      clientHealths['pull'] = { connected: true };
    }

    // 判断整体健康状态
    const anyConnected = Object.values(clientHealths).some(c => c.connected);
    const defaultClientHealthy = clientHealths[this.config.defaultMode]?.connected ?? false;

    let status: 'healthy' | 'degraded' | 'unhealthy';
    if (this.circuitState === 'open') {
      status = 'unhealthy';
    } else if (defaultClientHealthy) {
      status = 'healthy';
    } else if (anyConnected) {
      status = 'degraded';
    } else {
      status = 'unhealthy';
    }

    return {
      status,
      circuitState: this.circuitState,
      clients: clientHealths,
      activeSessions: this.getActiveSessionCount(),
      consecutiveFailures: this.consecutiveFailures,
      cooldownUntil: this.circuitState === 'open' ? this.cooldownUntil : undefined,
    };
  }

  /**
   * 获取 SOLO Bridge 统计信息
   *
   * @returns 统计数据对象
   */
  getStats(): SOLOBridgeStats {
    return {
      totalCalls: this.totalCalls,
      successCalls: this.successCalls,
      failedCalls: this.failedCalls,
      successRate: this.totalCalls > 0 ? this.successCalls / this.totalCalls : 0,
      avgDurationMs: this.totalCalls > 0 ? Math.round(this.totalDurationMs / this.totalCalls) : 0,
      totalTokensUsed: this.totalTokensUsed,
      callsByMode: { ...this.callsByMode },
      callsBySubAgent: { ...this.callsBySubAgent },
    };
  }

  /**
   * 获取 Pull 模式的待处理任务
   *
   * @param maxTasks - 最多返回的任务数量
   * @returns 待处理的任务列表
   */
  pollPullTasks(maxTasks?: number): PendingPullTask[] {
    if (!this.pullClient) return [];
    return this.pullClient.pollTasks(maxTasks);
  }

  /**
   * 完成 Pull 模式的任务
   *
   * @param taskId - 任务 ID
   * @param result - 执行结果
   * @returns true 表示成功完成
   */
  completePullTask(taskId: string, result: PullTaskResult): boolean {
    if (!this.pullClient) return false;
    return this.pullClient.completeTask(taskId, result);
  }

  /** 创建新的 SOLO 会话 ID */
  createSessionId(): string {
    return `solo-${uuidv4().slice(0, 8)}`;
  }

  /** 获取调用记录 */
  getRecords(options?: { executionId?: string; stepId?: string; limit?: number }): SOLOCallRecord[] {
    let records = [...this.callRecords];

    if (options?.executionId) {
      records = records.filter(r => r.executionId === options.executionId);
    }
    if (options?.stepId) {
      records = records.filter(r => r.stepId === options.stepId);
    }
    if (options?.limit) {
      records = records.slice(-options.limit);
    }

    return records;
  }

  /** 获取活跃会话数 */
  getActiveSessionCount(): number {
    this.cleanupStaleSessions();
    return this.activeSessions.size;
  }

  /** 获取活跃会话列表 */
  getActiveSessions(): Array<{ sessionId: string; lastUsed: number }> {
    this.cleanupStaleSessions();
    return Array.from(this.activeSessions.entries()).map(([sessionId, lastUsed]) => ({
      sessionId,
      lastUsed,
    }));
  }

  /**
   * 重置熔断器（手动恢复）
   */
  resetCircuitBreaker(): void {
    this.circuitState = 'closed';
    this.consecutiveFailures = 0;
    this.cooldownUntil = 0;
    this.logger?.info('SOLO Bridge circuit breaker manually reset');
  }

  /**
   * 清理资源
   */
  async cleanup(): Promise<void> {
    if (this.mcpClient) {
      await this.mcpClient.close();
    }
    if (this.pullClient) {
      this.pullClient.cleanup();
    }
    this.activeSessions.clear();
  }

  /** 清理过期会话 (超过 30 分钟) */
  private cleanupStaleSessions(): void {
    const staleThreshold = 30 * 60 * 1000; // 30 minutes
    const now = Date.now();

    for (const [sessionId, lastUsed] of this.activeSessions.entries()) {
      if (now - lastUsed > staleThreshold) {
        this.activeSessions.delete(sessionId);
      }
    }
  }

  private createRecord(params: {
    executionId: string;
    stepId: string;
    stepName: string;
    callMode: SOLOCallMode;
    subAgentType?: SOLOSubAgentType;
    sessionId: string;
    prompt: string;
  }): SOLOCallRecord {
    return {
      id: uuidv4(),
      executionId: params.executionId,
      stepId: params.stepId,
      stepName: params.stepName,
      callMode: params.callMode,
      subAgentType: params.subAgentType ?? 'explore',
      sessionId: params.sessionId,
      prompt: params.prompt,
      durationMs: 0,
      startedAt: new Date(),
    };
  }

  private addRecord(record: SOLOCallRecord): void {
    this.callRecords.push(record);
    // 限制记录数量
    if (this.callRecords.length > this.maxRecords) {
      this.callRecords = this.callRecords.slice(-this.maxRecords);
    }
  }
}
