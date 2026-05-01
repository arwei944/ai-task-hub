import type { SOLOSubAgentType } from '../types';

interface MCPClientConfig {
  endpoint?: string;
  defaultTimeoutMs: number;
}

/** MCP SDK Client 类型（动态导入） */
interface MCPClientInstance {
  connect(transport: unknown): Promise<void>;
  close(): Promise<void>;
  callTool(name: string, args: Record<string, unknown>): Promise<{
    content: Array<{ type: string; text?: string; data?: unknown }>;
  }>;
}

/** MCP SDK StreamableHTTPTransport 类型（动态导入） */
interface MCPTransportInstance {
  start(): Promise<void>;
  close(): Promise<void>;
}

/**
 * SOLO MCP 客户端
 * 通过 MCP 协议与 SOLO 通信
 *
 * 使用 @modelcontextprotocol/sdk 的 Client 类连接 SOLO MCP Server，
 * 支持 StreamableHTTP 传输层，实现连接池复用和健康检查。
 */
export class SOLOMCPClient {
  private endpoint: string;
  private defaultTimeoutMs: number;
  private clientInstance: MCPClientInstance | null = null;
  private transportInstance: MCPTransportInstance | null = null;
  private connected = false;
  private connectPromise: Promise<boolean> | null = null;
  private sdkAvailable: boolean | null = null;

  constructor(private config: MCPClientConfig) {
    this.endpoint = config.endpoint ?? 'http://localhost:3001/mcp';
    this.defaultTimeoutMs = config.defaultTimeoutMs;
  }

  /**
   * 调用 SOLO MCP 服务器
   * 连接到 MCP Server，发送 prompt 并返回 AI 响应
   *
   * @param params.prompt - 发送给 SOLO 的提示文本
   * @param params.subAgentType - SOLO 子智能体类型
   * @param params.sessionId - 会话 ID
   * @param params.timeoutMs - 超时时间（毫秒）
   * @returns 包含 data/error/durationMs/tokensUsed 的结果对象
   */
  async call(params: {
    prompt: string;
    subAgentType?: SOLOSubAgentType;
    sessionId: string;
    timeoutMs?: number;
  }): Promise<{ data?: unknown; error?: string; durationMs: number; tokensUsed?: number }> {
    const startTime = Date.now();
    const timeoutMs = params.timeoutMs ?? this.defaultTimeoutMs;

    try {
      // 尝试连接到 MCP 服务器
      const isConnected = await this.ensureConnection(timeoutMs);
      if (!isConnected || !this.clientInstance) {
        // SDK 不可用或连接失败，返回降级结果
        return {
          error: 'MCP SDK not available or connection failed',
          durationMs: Date.now() - startTime,
        };
      }

      // 通过 MCP 协议发送 prompt
      const result = await this.withTimeout(
        this.clientInstance.callTool('prompt', {
          prompt: params.prompt,
          subAgentType: params.subAgentType ?? 'explore',
          sessionId: params.sessionId,
        }),
        timeoutMs,
      );

      // 解析 MCP 响应
      const textContent = result.content?.find(c => c.type === 'text');
      const responseData = textContent?.text
        ? this.safeParseJSON(textContent.text)
        : undefined;

      const durationMs = Date.now() - startTime;

      return {
        data: responseData ?? { content: result.content },
        durationMs,
        tokensUsed: (responseData as Record<string, unknown>)?.tokensUsed as number | undefined,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const durationMs = Date.now() - startTime;

      // 连接异常时标记断开，下次调用会重连
      this.markDisconnected();

      return {
        error: `MCP call failed: ${errorMsg}`,
        durationMs,
      };
    }
  }

  /**
   * 健康检查 - 验证 MCP 连接是否可用
   * @returns true 表示连接正常
   */
  async healthCheck(): Promise<boolean> {
    try {
      const isConnected = await this.ensureConnection(5000);
      if (!isConnected || !this.clientInstance) {
        return false;
      }
      // 尝试调用一个轻量级工具来验证连接
      await this.withTimeout(
        this.clientInstance.callTool('health', {}),
        5000,
      );
      return true;
    } catch {
      this.markDisconnected();
      return false;
    }
  }

  /**
   * 获取当前连接状态
   */
  isConnected(): boolean {
    return this.connected;
  }

  /**
   * 获取配置的 MCP 端点
   */
  getEndpoint(): string {
    return this.endpoint;
  }

  /**
   * 关闭 MCP 连接
   */
  async close(): Promise<void> {
    try {
      if (this.transportInstance) {
        await this.transportInstance.close();
        this.transportInstance = null;
      }
      if (this.clientInstance) {
        await this.clientInstance.close();
        this.clientInstance = null;
      }
    } catch {
      // 忽略关闭错误
    } finally {
      this.connected = false;
      this.connectPromise = null;
    }
  }

  /**
   * 确保 MCP 连接已建立（带连接池复用）
   */
  private async ensureConnection(timeoutMs: number): Promise<boolean> {
    if (this.connected && this.clientInstance) {
      return true;
    }

    // 避免并发连接
    if (this.connectPromise) {
      return this.connectPromise;
    }

    this.connectPromise = this.establishConnection(timeoutMs);
    try {
      return await this.connectPromise;
    } finally {
      this.connectPromise = null;
    }
  }

  /**
   * 建立新的 MCP 连接
   */
  private async establishConnection(timeoutMs: number): Promise<boolean> {
    try {
      // 动态导入 MCP SDK（保持可选依赖）
      if (this.sdkAvailable === null) {
        try {
          // eslint-disable-next-line @typescript-eslint/ban-ts-comment
          // @ts-expect-error -- dynamic import for optional dependency
          const sdk = await import('@modelcontextprotocol/sdk');
          this.sdkAvailable = !!sdk;
        } catch {
          this.sdkAvailable = false;
          return false;
        }
      }

      if (!this.sdkAvailable) {
        return false;
      }

      // 动态导入所需的类
      const { Client } = await import('@modelcontextprotocol/sdk/client/index.js');
      const { StreamableHTTPClientTransport } = await import(
        '@modelcontextprotocol/sdk/client/streamableHttp.js'
      );

      // 创建传输层
      const transport = new StreamableHTTPClientTransport(new URL(this.endpoint));
      this.transportInstance = transport as unknown as MCPTransportInstance;

      // 创建 MCP 客户端
      const client = new Client({
        name: 'ai-task-hub-solo-bridge',
        version: '1.0.0',
      });
      this.clientInstance = client as unknown as MCPClientInstance;

      // 连接服务器
      await this.withTimeout(client.connect(transport), timeoutMs);
      this.connected = true;

      return true;
    } catch (error) {
      this.connected = false;
      this.clientInstance = null;
      this.transportInstance = null;

      // 如果 SDK 导入失败，标记为不可用
      if (error instanceof Error && error.message.includes('Cannot find module')) {
        this.sdkAvailable = false;
      }

      return false;
    }
  }

  /**
   * 标记连接断开
   */
  private markDisconnected(): void {
    this.connected = false;
    this.clientInstance = null;
    this.transportInstance = null;
  }

  /**
   * 带超时的 Promise 包装
   */
  private withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`MCP operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      promise
        .then((result) => {
          clearTimeout(timer);
          resolve(result);
        })
        .catch((error) => {
          clearTimeout(timer);
          reject(error);
        });
    });
  }

  /**
   * 安全解析 JSON 字符串
   */
  private safeParseJSON(text: string): unknown {
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
}
