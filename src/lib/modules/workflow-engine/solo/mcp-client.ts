import type { SOLOSubAgentType } from '../types';

interface MCPClientConfig {
  endpoint?: string;
  defaultTimeoutMs: number;
}

export class SOLOMCPClient {
  constructor(private config: MCPClientConfig) {}

  async call(params: {
    prompt: string;
    subAgentType?: SOLOSubAgentType;
    sessionId: string;
    timeoutMs?: number;
  }): Promise<{ data?: unknown; error?: string; durationMs: number; tokensUsed?: number }> {
    const startTime = Date.now();
    const durationMs = Date.now() - startTime;
    return {
      data: {
        message: 'MCP client placeholder - Phase A',
        prompt: params.prompt,
        subAgentType: params.subAgentType,
        sessionId: params.sessionId,
      },
      durationMs,
    };
  }
}