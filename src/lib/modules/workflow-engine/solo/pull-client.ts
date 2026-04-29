import type { SOLOSubAgentType } from '../types';

interface PullClientConfig {
  defaultTimeoutMs: number;
}

/**
 * SOLO Pull 客户端
 * SOLO 主动拉取任务执行
 * Phase A: 基础框架
 */
export class SOLOPullClient {
  constructor(private config: PullClientConfig) {}

  async call(params: {
    prompt: string;
    subAgentType?: SOLOSubAgentType;
    sessionId: string;
    timeoutMs?: number;
  }): Promise<{ data?: unknown; error?: string; durationMs: number; tokensUsed?: number }> {
    const startTime = Date.now();

    // Phase A: Pull 客户端占位实现
    // TODO Phase B: 实现 SOLO 主动拉取模式
    // SOLO 通过 MCP/REST 主动查询待执行任务

    const durationMs = Date.now() - startTime;

    return {
      data: {
        message: 'Pull client placeholder - Phase A',
        prompt: params.prompt,
        subAgentType: params.subAgentType,
        sessionId: params.sessionId,
      },
      durationMs,
    };
  }
}
