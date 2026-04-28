import type { ILogger } from './types';

/**
 * Generate a short request ID for tracing
 */
export function generateRequestId(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
}

/**
 * Global request context for tracing
 */
let _requestId: string | null = null;
let _requestPath: string | null = null;

export function setRequestContext(requestId: string, path?: string): void {
  _requestId = requestId;
  _requestPath = path ?? null;
}

export function clearRequestContext(): void {
  _requestId = null;
  _requestPath = null;
}

export function getRequestId(): string | null {
  return _requestId;
}

export class Logger implements ILogger {
  private context: string;

  constructor(context: string = 'root') {
    this.context = context;
  }

  private format(level: string, message: string, data?: unknown): string {
    const timestamp = new Date().toISOString();
    const base = {
      timestamp,
      level,
      context: this.context,
      message,
      ...(_requestId && { requestId: _requestId }),
      ...(_requestPath && { path: _requestPath }),
      ...(data && typeof data === 'object' ? { data } : {}),
    };

    return JSON.stringify(base);
  }

  private formatHuman(level: string, message: string, args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const reqId = _requestId ? ` [${_requestId}]` : '';
    const argsStr = args.length > 0 ? ' ' + args.map((a) => typeof a === 'string' ? a : JSON.stringify(a)).join(' ') : '';
    return `[${timestamp}] [${level}] [${this.context}]${reqId}${argsStr} ${message}`;
  }

  private output(level: string, message: string, args: unknown[]): void {
    const useJson = process.env.LOG_FORMAT === 'json' || process.env.NODE_ENV === 'production';

    if (useJson) {
      const data = args.length === 1 && typeof args[0] === 'object' ? args[0] : args.length > 0 ? { args } : undefined;
      const jsonStr = this.format(level, message, data);
      switch (level) {
        case 'ERROR': console.error(jsonStr); break;
        case 'WARN': console.warn(jsonStr); break;
        case 'DEBUG': console.debug(jsonStr); break;
        default: console.log(jsonStr);
      }
    } else {
      const humanStr = this.formatHuman(level, message, args);
      switch (level) {
        case 'ERROR': console.error(humanStr); break;
        case 'WARN': console.warn(humanStr); break;
        case 'DEBUG': console.debug(humanStr); break;
        default: console.info(humanStr);
      }
    }
  }

  debug(message: string, ...args: unknown[]): void {
    if (process.env.NODE_ENV === 'development' || process.env.LOG_LEVEL === 'debug') {
      this.output('DEBUG', message, args);
    }
  }

  info(message: string, ...args: unknown[]): void {
    this.output('INFO', message, args);
  }

  warn(message: string, ...args: unknown[]): void {
    this.output('WARN', message, args);
  }

  error(message: string, ...args: unknown[]): void {
    this.output('ERROR', message, args);
  }

  child(context: string): ILogger {
    return new Logger(`${this.context}:${context}`);
  }
}
