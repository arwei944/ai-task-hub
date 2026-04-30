import type { StepHandler, StepResult } from '../types';

/** HTTP 请求步骤支持的配置 */
interface HttpRequestConfig {
  url?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
  headers?: Record<string, string>;
  body?: string;
  timeout?: number;
}

/** HTTP 请求步骤返回的结果 */
interface HttpRequestResult extends StepResult {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: string;
  ok: boolean;
}

/**
 * HTTP 请求步骤
 * 使用 Node.js 内置 fetch 发起 HTTP 请求
 */
export class HttpRequestStep implements StepHandler {
  async execute(config: Record<string, unknown>, context: Record<string, unknown>): Promise<StepResult> {
    const {
      url,
      method = 'GET',
      headers = {},
      body,
      timeout = 30000,
    } = config as HttpRequestConfig;

    if (!url) {
      throw new Error('http-request step requires "url" in config');
    }

    // 解析模板变量
    const resolvedUrl = this.resolveTemplate(String(url), context);
    const resolvedMethod = String(method).toUpperCase() as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    const resolvedHeaders: Record<string, string> = {};
    for (const [key, value] of Object.entries(headers)) {
      resolvedHeaders[key] = this.resolveTemplate(String(value), context);
    }
    const resolvedBody = body ? this.resolveTemplate(String(body), context) : undefined;

    // 验证 HTTP 方法
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'];
    if (!validMethods.includes(resolvedMethod)) {
      throw new Error(`Invalid HTTP method: ${resolvedMethod}. Supported: ${validMethods.join(', ')}`);
    }

    // 构建请求选项
    const fetchOptions: RequestInit = {
      method: resolvedMethod,
      headers: resolvedHeaders,
    };

    if (resolvedBody && resolvedMethod !== 'GET') {
      fetchOptions.body = resolvedBody;
    }

    // 设置超时
    const controller = new AbortController();
    fetchOptions.signal = controller.signal;
    const timeoutId = setTimeout(() => controller.abort(), Number(timeout));

    try {
      const response = await fetch(resolvedUrl, fetchOptions);

      // 收集响应头
      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // 读取响应体
      const responseBody = await response.text();

      const result: HttpRequestResult = {
        status: response.status,
        statusText: response.statusText,
        headers: responseHeaders,
        body: responseBody,
        ok: response.ok,
      };

      // 如果响应状态码表示错误，仍然返回结果但标记 ok=false
      // 调用方可以根据 ok 字段决定是否继续
      if (!response.ok) {
        result.error = `HTTP ${response.status}: ${response.statusText}`;
      }

      return result;
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof DOMException && error.name === 'AbortError') {
        return {
          status: 0,
          statusText: 'Timeout',
          headers: {},
          body: '',
          ok: false,
          error: `Request timed out after ${timeout}ms`,
        };
      }

      throw new Error(`HTTP request failed: ${error instanceof Error ? error.message : String(error)}`);
    } finally {
      clearTimeout(timeoutId);
    }
  }

  private resolveTemplate(template: string, context: Record<string, unknown>): string {
    return template.replace(/\{\{(\w+(?:\.\w+)*)\}\}/g, (_, path) => {
      const parts = path.split('.');
      let value: unknown = context;
      for (const part of parts) {
        if (value && typeof value === 'object') {
          value = (value as Record<string, unknown>)[part];
        } else {
          return '';
        }
      }
      return value !== undefined ? String(value) : '';
    });
  }
}
