import type { SOLOSubAgentType } from '../types';

interface PullClientConfig {
  defaultTimeoutMs: number;
}

export class SOLOPullClient {
  constructor(private config: PullClientConfig) {}

  async call(params: {
    prompt: string;
    subAgentType?: SOLOSubAgentType;
    sessionId: string;
    timeoutMs?: number;
  }): Promise<{ data?: unknown; error?: string; durationMs: number; tokensUsed?: number }> {
    const startTime = Date.now();
    const durationMs = Date.now() - startTime;
    return {
      data: { message: 'Pull client placeholder - Phase A', prompt: params.prompt, subAgentType: params.subAgentType, sessionId: params.sessionId },
      durationMs,
    };
  }
}