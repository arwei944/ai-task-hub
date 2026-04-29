import { describe, it, expect } from 'vitest';
import {
  AppErrorCode,
  errorCodeToStatus,
  errorCodeToMessage,
  errorCodeToToastType,
  createAppError,
} from '@/lib/core/errors';

describe('errors', () => {
  // --- 错误码映射 (HTTP status) ---
  describe('errorCodeToStatus', () => {
    it('should map UNAUTHORIZED to 401', () => {
      expect(errorCodeToStatus(AppErrorCode.UNAUTHORIZED)).toBe(401);
    });

    it('should map FORBIDDEN to 403', () => {
      expect(errorCodeToStatus(AppErrorCode.FORBIDDEN)).toBe(403);
    });

    it('should map NOT_FOUND to 404', () => {
      expect(errorCodeToStatus(AppErrorCode.NOT_FOUND)).toBe(404);
    });

    it('should map TASK_NOT_FOUND to 404', () => {
      expect(errorCodeToStatus(AppErrorCode.TASK_NOT_FOUND)).toBe(404);
    });

    it('should map VALIDATION_ERROR to 400', () => {
      expect(errorCodeToStatus(AppErrorCode.VALIDATION_ERROR)).toBe(400);
    });

    it('should map TASK_DUPLICATE to 409', () => {
      expect(errorCodeToStatus(AppErrorCode.TASK_DUPLICATE)).toBe(409);
    });

    it('should map RATE_LIMITED to 429', () => {
      expect(errorCodeToStatus(AppErrorCode.RATE_LIMITED)).toBe(429);
    });

    it('should map AI_RATE_LIMITED to 429', () => {
      expect(errorCodeToStatus(AppErrorCode.AI_RATE_LIMITED)).toBe(429);
    });

    it('should map SERVICE_UNAVAILABLE to 503', () => {
      expect(errorCodeToStatus(AppErrorCode.SERVICE_UNAVAILABLE)).toBe(503);
    });

    it('should map INTERNAL_ERROR to 500', () => {
      expect(errorCodeToStatus(AppErrorCode.INTERNAL_ERROR)).toBe(500);
    });

    it('should map DATABASE_ERROR to 500', () => {
      expect(errorCodeToStatus(AppErrorCode.DATABASE_ERROR)).toBe(500);
    });

    it('should map AI_TIMEOUT to 504', () => {
      expect(errorCodeToStatus(AppErrorCode.AI_TIMEOUT)).toBe(504);
    });

    it('should map AI_MODEL_ERROR to 502', () => {
      expect(errorCodeToStatus(AppErrorCode.AI_MODEL_ERROR)).toBe(502);
    });

    it('should map TASK_INVALID_TRANSITION to 422', () => {
      expect(errorCodeToStatus(AppErrorCode.TASK_INVALID_TRANSITION)).toBe(422);
    });

    it('should return 500 for unknown error codes', () => {
      expect(errorCodeToStatus('UNKNOWN_ERROR')).toBe(500);
    });
  });

  // --- 中文消息 ---
  describe('errorCodeToMessage', () => {
    it('should return Chinese message for UNAUTHORIZED', () => {
      expect(errorCodeToMessage(AppErrorCode.UNAUTHORIZED)).toBe('请先登录');
    });

    it('should return Chinese message for FORBIDDEN', () => {
      expect(errorCodeToMessage(AppErrorCode.FORBIDDEN)).toBe('权限不足');
    });

    it('should return Chinese message for TASK_NOT_FOUND', () => {
      expect(errorCodeToMessage(AppErrorCode.TASK_NOT_FOUND)).toBe('任务不存在');
    });

    it('should return Chinese message for INVALID_CREDENTIALS', () => {
      expect(errorCodeToMessage(AppErrorCode.INVALID_CREDENTIALS)).toBe('用户名或密码错误');
    });

    it('should return Chinese message for AI_TIMEOUT', () => {
      expect(errorCodeToMessage(AppErrorCode.AI_TIMEOUT)).toBe('AI 请求超时');
    });

    it('should return Chinese message for AI_RATE_LIMITED', () => {
      expect(errorCodeToMessage(AppErrorCode.AI_RATE_LIMITED)).toBe('AI 调用频率超限，请稍后重试');
    });

    it('should return Chinese message for INTERNAL_ERROR', () => {
      expect(errorCodeToMessage(AppErrorCode.INTERNAL_ERROR)).toBe('服务器内部错误');
    });

    it('should return default message for unknown error codes', () => {
      expect(errorCodeToMessage('TOTALLY_UNKNOWN')).toBe('操作失败，请稍后重试');
    });

    it('should cover all defined error codes with messages', () => {
      // Ensure every AppErrorCode has a Chinese message
      const allCodes = Object.values(AppErrorCode) as string[];
      for (const code of allCodes) {
        const msg = errorCodeToMessage(code);
        expect(msg).toBeTruthy();
        expect(msg.length).toBeGreaterThan(0);
      }
    });
  });

  // --- Toast 类型 ---
  describe('errorCodeToToastType', () => {
    it('should return warning for RATE_LIMITED', () => {
      expect(errorCodeToToastType(AppErrorCode.RATE_LIMITED)).toBe('warning');
    });

    it('should return warning for AI_RATE_LIMITED', () => {
      expect(errorCodeToToastType(AppErrorCode.AI_RATE_LIMITED)).toBe('warning');
    });

    it('should return warning for AI_TIMEOUT', () => {
      expect(errorCodeToToastType(AppErrorCode.AI_TIMEOUT)).toBe('warning');
    });

    it('should return warning for SERVICE_UNAVAILABLE', () => {
      expect(errorCodeToToastType(AppErrorCode.SERVICE_UNAVAILABLE)).toBe('warning');
    });

    it('should return error for most error codes', () => {
      expect(errorCodeToToastType(AppErrorCode.UNAUTHORIZED)).toBe('error');
      expect(errorCodeToToastType(AppErrorCode.NOT_FOUND)).toBe('error');
      expect(errorCodeToToastType(AppErrorCode.INTERNAL_ERROR)).toBe('error');
    });
  });

  // --- createAppError ---
  describe('createAppError', () => {
    it('should create error with default message and status', () => {
      const err = createAppError(AppErrorCode.TASK_NOT_FOUND);
      expect(err.code).toBe(AppErrorCode.TASK_NOT_FOUND);
      expect(err.message).toBe('任务不存在');
      expect(err.statusCode).toBe(404);
      expect(err.details).toBeUndefined();
    });

    it('should create error with custom message', () => {
      const err = createAppError(AppErrorCode.VALIDATION_ERROR, 'Custom validation msg');
      expect(err.message).toBe('Custom validation msg');
    });

    it('should create error with details', () => {
      const details = { field: 'title', reason: 'too short' };
      const err = createAppError(AppErrorCode.VALIDATION_ERROR, undefined, details);
      expect(err.details).toEqual(details);
    });

    it('should create error with both custom message and details', () => {
      const err = createAppError(
        AppErrorCode.TASK_INVALID_TRANSITION,
        'Cannot go from done to todo',
        { from: 'done', to: 'todo' },
      );
      expect(err.code).toBe(AppErrorCode.TASK_INVALID_TRANSITION);
      expect(err.message).toBe('Cannot go from done to todo');
      expect(err.statusCode).toBe(422);
      expect(err.details).toEqual({ from: 'done', to: 'todo' });
    });

    it('should accept string code not in enum', () => {
      const err = createAppError('CUSTOM_ERROR', 'Custom error');
      expect(err.code).toBe('CUSTOM_ERROR');
      expect(err.message).toBe('Custom error');
      expect(err.statusCode).toBe(500);
    });
  });
});
