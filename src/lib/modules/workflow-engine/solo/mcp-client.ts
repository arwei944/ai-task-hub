import type { SOLOSubAgentType } from '../types';

interface MCPClientConfig {
  endpoint?: string;
  defaultTimeoutMs: number;
}

/**
 * SOLO MCP 客户端
 * 通过 MCP 协议与 SOLO 通信
 * Phase A: 基础框架，实际 MCP 调用待 Phase B 完善
 */
export class SOLOMCPClient {
  constructor(private config: MCPClientConfig) {}

  async call(params: {
    prompt: string;
    subAgentType?: SOLOSubAgentType;
    sessionId: string;
    timeoutMs?: number;
  }): Promise<{ data?: unknown; error?: string; durationMs: number; tokensUsed?: number }> {
    const startTime = Date.now();

    // Phase A: MCP 客户端占位实现
    // TODO Phase B: 实现实际的 MCP 协议通信
    // 将通过 @modelcontextprotocol/sdk 连接 SOLO MCP Server

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
