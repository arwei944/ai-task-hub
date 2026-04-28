import type { ILogger } from './types';

export class Logger implements ILogger {
  private context: string;

  constructor(context: string = 'root') {
    this.context = context;
  }

  private format(level: string, message: string, args: unknown[]): string {
    const timestamp = new Date().toISOString();
    const argsStr = args.length > 0 ? ' ' + args.map((a) => JSON.stringify(a)).join(' ') : '';
    return `[${timestamp}] [${level}] [${this.context}]${argsStr} ${message}`;
  }

  debug(message: string, ...args: unknown[]): void {
    if (process.env.NODE_ENV === 'development') {
      console.debug(this.format('DEBUG', message, args));
    }
  }

  info(message: string, ...args: unknown[]): void {
    console.info(this.format('INFO', message, args));
  }

  warn(message: string, ...args: unknown[]): void {
    console.warn(this.format('WARN', message, args));
  }

  error(message: string, ...args: unknown[]): void {
    console.error(this.format('ERROR', message, args));
  }

  child(context: string): ILogger {
    return new Logger(`${this.context}:${context}`);
  }
}
