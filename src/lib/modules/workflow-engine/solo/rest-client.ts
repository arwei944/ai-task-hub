import type { SOLOSubAgentType } from '../types';

interface RESTClientConfig {
  endpoint?: string;
  defaultTimeoutMs: number;
}

/** SOLO REST API 响应格式 */
interface SOLORestResponse {
  data?: unknown;
  error?: string;
  durationMs?: number;
  tokensUsed?: number;
}

/**
 * SOLO REST 客户端
 * 通过 REST API 与 SOLO 通信
 *
 * 使用 fetch 调用 SOLO REST API 端点，
 * 支持 AbortController 超时控制和自动重试。
 */
export class SOLORESTClient {
  private endpoint: string;
  private defaultTimeoutMs: number;
  private maxRetries = 1;

  constructor(private config: RESTClientConfig) {
    this.endpoint = config.endpoint ?? 'http://localhost:3001/api/solo/call';
    this.defaultTimeoutMs = config.defaultTimeoutMs;
  }

  /**
   * 调用 SOLO REST API
   * POST JSON 请求体到 SOLO 端点，解析响应返回结果
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
    context?: Record<string, unknown>;
  }): Promise<{ data?: unknown; error?: string; durationMs: number; tokensUsed?: number }> {
    const startTime = Date.now();
    const timeoutMs = params.timeoutMs ?? this.defaultTimeoutMs;

    const requestBody = {
      prompt: params.prompt,
      subAgentType: params.subAgentType ?? 'explore',
      sessionId: params.sessionId,
      context: params.context ?? {},
    };

    let lastError: string | undefined;

    // 重试逻辑：最多重试 maxRetries 次
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        const result = await this.fetchWithTimeout(this.endpoint, requestBody, timeoutMs);
        const durationMs = Date.now() - startTime;

        return {
          data: result.data,
          error: result.error,
          durationMs,
          tokensUsed: result.tokensUsed,
        };
      } catch (error) {
        lastError = error instanceof Error ? error.message : String(error);

        // 仅在网络错误时重试，不重试业务错误
        if (attempt < this.maxRetries && this.isNetworkError(error)) {
          // 等待一小段时间后重试
          await this.delay(Math.min(1000 * (attempt + 1), 3000));
          continue;
        }

        break;
      }
    }

    const durationMs = Date.now() - startTime;
    return {
      error: `REST call failed: ${lastError}`,
      durationMs,
    };
  }

  /**
   * 健康检查 - 验证 REST API 是否可达
   * @returns true 表示 API 可用
   */
  async healthCheck(): Promise<boolean> {
    try {
      const result = await this.fetchWithTimeout(
        this.endpoint.replace('/call', '/health'),
        {},
        5000,
      );
      return !result.error;
    } catch (err) {
      console.debug('[rest-client] Health check failed:', err instanceof Error ? err.message : err);
      return false;
    }
  }

  /**
   * 获取配置的 REST 端点
   */
  getEndpoint(): string {
    return this.endpoint;
  }

  /**
   * 带超时的 fetch 请求
   */
  private async fetchWithTimeout(
    url: string,
    body: Record<string, unknown>,
    timeoutMs: number,
  ): Promise<SOLORestResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => `HTTP ${response.status}`);
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }

      const json = await response.json() as SOLORestResponse;
      return json;
    } finally {
      clearTimeout(timer);
    }
  }

  /**
   * 判断是否为网络错误（可重试）
   */
  private isNetworkError(error: unknown): boolean {
    if (error instanceof Error) {
      // AbortError (超时)
      if (error.name === 'AbortError') return true;
      // 网络相关错误
      const networkPatterns = [
        'ECONNREFUSED',
        'ECONNRESET',
        'ENOTFOUND',
        'ETIMEDOUT',
        'fetch failed',
        'network error',
        'Failed to fetch',
      ];
      return networkPatterns.some(p => error.message.toLowerCase().includes(p.toLowerCase()));
    }
    return false;
  }

  /**
   * 延迟指定毫秒
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
