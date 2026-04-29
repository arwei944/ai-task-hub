import type { SOLOSubAgentType } from '../types';

interface RESTClientConfig {
  endpoint?: string;
  defaultTimeoutMs: number;
}

export class SOLORESTClient {
  constructor(private config: RESTClientConfig) {}

  async call(params: {
    prompt: string;
    subAgentType?: SOLOSubAgentType;
    sessionId: string;
    timeoutMs?: number;
  }): Promise<{ data?: unknown; error?: string; durationMs: number; tokensUsed?: number }> {
    const startTime = Date.now();
    const durationMs = Date.now() - startTime;
    return {
      data: { message: 'REST client placeholder - Phase A', prompt: params.prompt, subAgentType: params.subAgentType, sessionId: params.sessionId },
      durationMs,
    };
  }
}