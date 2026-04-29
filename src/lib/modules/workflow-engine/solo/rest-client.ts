import type { SOLOSubAgentType } from '../types';

interface RESTClientConfig {
  endpoint?: string;
  defaultTimeoutMs: number;
}

/**
 * SOLO REST 客户端
 * 通过 REST API 与 SOLO 通信
 * Phase A: 基础框架，实际 REST 调用待 Phase B 完善
 */
export class SOLORESTClient {
  constructor(private config: RESTClientConfig) {}

  async call(params: {
    prompt: string;
    subAgentType?: SOLOSubAgentType;
    sessionId: string;
    timeoutMs?: number;
  }): Promise<{ data?: unknown; error?: string; durationMs: number; tokensUsed?: number }> {
    const startTime = Date.now();

    // Phase A: REST 客户端占位实现
    // TODO Phase B: 实现实际的 REST API 调用
    // 将通过 fetch 调用 SOLO REST API endpoint

    const durationMs = Date.now() - startTime;

    return {
      data: {
        message: 'REST client placeholder - Phase A',
        prompt: params.prompt,
        subAgentType: params.subAgentType,
        sessionId: params.sessionId,
      },
      durationMs,
    };
  }
}
