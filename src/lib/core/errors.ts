// ============================================================
// Unified Error Codes & Error Utilities
// ============================================================

export enum AppErrorCode {
  // Auth errors (1xxx)
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  USER_NOT_FOUND = 'USER_NOT_FOUND',
  USER_ALREADY_EXISTS = 'USER_ALREADY_EXISTS',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',
  PASSWORD_TOO_WEAK = 'PASSWORD_TOO_WEAK',

  // Task errors (2xxx)
  TASK_NOT_FOUND = 'TASK_NOT_FOUND',
  TASK_INVALID_TRANSITION = 'TASK_INVALID_TRANSITION',
  TASK_DUPLICATE = 'TASK_DUPLICATE',
  TASK_VALIDATION_FAILED = 'TASK_VALIDATION_FAILED',

  // AI errors (3xxx)
  AI_MODEL_ERROR = 'AI_MODEL_ERROR',
  AI_TIMEOUT = 'AI_TIMEOUT',
  AI_RATE_LIMITED = 'AI_RATE_LIMITED',
  AI_PARSE_FAILED = 'AI_PARSE_FAILED',
  AI_NOT_CONFIGURED = 'AI_NOT_CONFIGURED',

  // Plugin errors (4xxx)
  PLUGIN_NOT_FOUND = 'PLUGIN_NOT_FOUND',
  PLUGIN_ALREADY_INSTALLED = 'PLUGIN_ALREADY_INSTALLED',
  PLUGIN_LOAD_FAILED = 'PLUGIN_LOAD_FAILED',
  PLUGIN_ACTIVATION_FAILED = 'PLUGIN_ACTIVATION_FAILED',

  // Integration errors (5xxx)
  INTEGRATION_NOT_CONFIGURED = 'INTEGRATION_NOT_CONFIGURED',
  INTEGRATION_API_ERROR = 'INTEGRATION_API_ERROR',
  WEBHOOK_INVALID_PAYLOAD = 'WEBHOOK_INVALID_PAYLOAD',

  // System errors (9xxx)
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  RATE_LIMITED = 'RATE_LIMITED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',
}

export interface AppError {
  code: AppErrorCode | string;
  message: string;
  details?: unknown;
  statusCode: number;
}

/**
 * Map error code to HTTP status code
 */
export function errorCodeToStatus(code: string): number {
  const map: Record<string, number> = {
    [AppErrorCode.UNAUTHORIZED]: 401,
    [AppErrorCode.FORBIDDEN]: 403,
    [AppErrorCode.INVALID_TOKEN]: 401,
    [AppErrorCode.TOKEN_EXPIRED]: 401,
    [AppErrorCode.INVALID_CREDENTIALS]: 401,
    [AppErrorCode.NOT_FOUND]: 404,
    [AppErrorCode.TASK_NOT_FOUND]: 404,
    [AppErrorCode.USER_NOT_FOUND]: 404,
    [AppErrorCode.PLUGIN_NOT_FOUND]: 404,
    [AppErrorCode.VALIDATION_ERROR]: 400,
    [AppErrorCode.TASK_VALIDATION_FAILED]: 400,
    [AppErrorCode.TASK_DUPLICATE]: 409,
    [AppErrorCode.USER_ALREADY_EXISTS]: 409,
    [AppErrorCode.PLUGIN_ALREADY_INSTALLED]: 409,
    [AppErrorCode.TASK_INVALID_TRANSITION]: 422,
    [AppErrorCode.RATE_LIMITED]: 429,
    [AppErrorCode.AI_RATE_LIMITED]: 429,
    [AppErrorCode.SERVICE_UNAVAILABLE]: 503,
    [AppErrorCode.AI_MODEL_ERROR]: 502,
    [AppErrorCode.AI_TIMEOUT]: 504,
    [AppErrorCode.INTERNAL_ERROR]: 500,
    [AppErrorCode.DATABASE_ERROR]: 500,
  };
  return map[code] ?? 500;
}

/**
 * Map error code to user-friendly Chinese message
 */
export function errorCodeToMessage(code: string): string {
  const map: Record<string, string> = {
    [AppErrorCode.UNAUTHORIZED]: '请先登录',
    [AppErrorCode.FORBIDDEN]: '权限不足',
    [AppErrorCode.INVALID_TOKEN]: '登录已失效，请重新登录',
    [AppErrorCode.TOKEN_EXPIRED]: '登录已过期，请重新登录',
    [AppErrorCode.USER_NOT_FOUND]: '用户不存在',
    [AppErrorCode.USER_ALREADY_EXISTS]: '用户已存在',
    [AppErrorCode.INVALID_CREDENTIALS]: '用户名或密码错误',
    [AppErrorCode.PASSWORD_TOO_WEAK]: '密码强度不足',
    [AppErrorCode.TASK_NOT_FOUND]: '任务不存在',
    [AppErrorCode.TASK_INVALID_TRANSITION]: '任务状态转换无效',
    [AppErrorCode.TASK_DUPLICATE]: '任务已存在',
    [AppErrorCode.TASK_VALIDATION_FAILED]: '任务数据验证失败',
    [AppErrorCode.AI_MODEL_ERROR]: 'AI 模型调用失败',
    [AppErrorCode.AI_TIMEOUT]: 'AI 请求超时',
    [AppErrorCode.AI_RATE_LIMITED]: 'AI 调用频率超限，请稍后重试',
    [AppErrorCode.AI_PARSE_FAILED]: 'AI 响应解析失败',
    [AppErrorCode.AI_NOT_CONFIGURED]: 'AI 服务未配置',
    [AppErrorCode.PLUGIN_NOT_FOUND]: '插件不存在',
    [AppErrorCode.PLUGIN_ALREADY_INSTALLED]: '插件已安装',
    [AppErrorCode.PLUGIN_LOAD_FAILED]: '插件加载失败',
    [AppErrorCode.PLUGIN_ACTIVATION_FAILED]: '插件激活失败',
    [AppErrorCode.INTEGRATION_NOT_CONFIGURED]: '集成服务未配置',
    [AppErrorCode.INTEGRATION_API_ERROR]: '集成服务调用失败',
    [AppErrorCode.WEBHOOK_INVALID_PAYLOAD]: 'Webhook 数据无效',
    [AppErrorCode.INTERNAL_ERROR]: '服务器内部错误',
    [AppErrorCode.NOT_FOUND]: '资源不存在',
    [AppErrorCode.VALIDATION_ERROR]: '数据验证失败',
    [AppErrorCode.RATE_LIMITED]: '请求过于频繁，请稍后重试',
    [AppErrorCode.SERVICE_UNAVAILABLE]: '服务暂不可用',
    [AppErrorCode.DATABASE_ERROR]: '数据库操作失败',
  };
  return map[code] ?? '操作失败，请稍后重试';
}

/**
 * Get toast type from error code
 */
export function errorCodeToToastType(code: string): 'error' | 'warning' | 'info' {
  if (['RATE_LIMITED', 'AI_RATE_LIMITED', 'AI_TIMEOUT', 'SERVICE_UNAVAILABLE'].includes(code)) {
    return 'warning';
  }
  return 'error';
}

/**
 * Create a standardized AppError
 */
export function createAppError(
  code: AppErrorCode | string,
  message?: string,
  details?: unknown,
): AppError {
  return {
    code,
    message: message ?? errorCodeToMessage(code),
    details,
    statusCode: errorCodeToStatus(code),
  };
}
