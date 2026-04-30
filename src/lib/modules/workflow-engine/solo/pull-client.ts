import { v4 as uuidv4 } from 'uuid';
import type { SOLOSubAgentType } from '../types';

interface PullClientConfig {
  defaultTimeoutMs: number;
}

/** 待处理的拉取任务 */
export interface PendingPullTask {
  id: string;
  prompt: string;
  subAgentType: SOLOSubAgentType;
  sessionId: string;
  context?: Record<string, unknown>;
  createdAt: number;
  timeoutMs: number;
}

/** 拉取任务结果 */
export interface PullTaskResult {
  data?: unknown;
  error?: string;
  durationMs: number;
  tokensUsed?: number;
}

/**
 * SOLO Pull 客户端
 * SOLO 主动拉取任务执行
 *
 * 维护内存中的任务队列，当 call() 被调用时将任务加入队列并挂起 Promise。
 * SOLO 通过 pollTasks() 获取待处理任务，执行完成后通过 completeTask() 返回结果。
 * 支持超时机制：如果超时未收到结果，自动 reject。
 */
export class SOLOPullClient {
  private defaultTimeoutMs: number;
  /** 待处理任务队列 */
  private taskQueue: PendingPullTask[] = [];
  /** 等待中的 Promise 回调 { taskId -> { resolve, reject, timer } } */
  private pendingResolvers = new Map<string, {
    resolve: (result: PullTaskResult) => void;
    reject: (error: Error) => void;
    timer: ReturnType<typeof setTimeout>;
    startTime: number;
  }>();

  constructor(private config: PullClientConfig) {
    this.defaultTimeoutMs = config.defaultTimeoutMs;
  }

  /**
   * 调用 SOLO（Pull 模式）
   * 将任务加入队列，挂起等待 SOLO 拉取并返回结果
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
    const timeoutMs = params.timeoutMs ?? this.defaultTimeoutMs;
    const taskId = uuidv4();

    const task: PendingPullTask = {
      id: taskId,
      prompt: params.prompt,
      subAgentType: params.subAgentType ?? 'explore',
      sessionId: params.sessionId,
      context: params.context,
      createdAt: Date.now(),
      timeoutMs,
    };

    // 将任务加入队列
    this.taskQueue.push(task);

    // 创建挂起的 Promise
    return new Promise<{ data?: unknown; error?: string; durationMs: number; tokensUsed?: number }>(
      (resolve, reject) => {
        const startTime = Date.now();

        // 设置超时定时器
        const timer = setTimeout(() => {
          // 从队列中移除超时任务
          this.taskQueue = this.taskQueue.filter(t => t.id !== taskId);
          this.pendingResolvers.delete(taskId);
          reject(new Error(`Pull task timed out after ${timeoutMs}ms`));
        }, timeoutMs);

        // 存储回调
        this.pendingResolvers.set(taskId, {
          resolve: (result) => {
            clearTimeout(timer);
            resolve({
              ...result,
              durationMs: Date.now() - startTime,
            });
          },
          reject: (error) => {
            clearTimeout(timer);
            reject(error);
          },
          timer,
          startTime,
        });
      },
    );
  }

  /**
   * 轮询待处理任务（SOLO 调用此方法获取任务）
   *
   * @param maxTasks - 最多返回的任务数量（默认 1）
   * @returns 待处理的任务列表
   */
  pollTasks(maxTasks: number = 1): PendingPullTask[] {
    const tasks = this.taskQueue.splice(0, maxTasks);
    return tasks;
  }

  /**
   * 完成任务（SOLO 调用此方法返回执行结果）
   *
   * @param taskId - 任务 ID
   * @param result - 执行结果
   * @returns true 表示成功完成，false 表示任务不存在
   */
  completeTask(taskId: string, result: PullTaskResult): boolean {
    const resolver = this.pendingResolvers.get(taskId);
    if (!resolver) {
      return false;
    }

    resolver.resolve(result);
    this.pendingResolvers.delete(taskId);
    return true;
  }

  /**
   * 健康检查 - Pull 模式始终可用（内存队列）
   * @returns true
   */
  async healthCheck(): Promise<boolean> {
    return true;
  }

  /**
   * 获取当前待处理任务数量
   */
  getPendingCount(): number {
    return this.taskQueue.length;
  }

  /**
   * 获取当前等待结果的 Promise 数量
   */
  getWaitingCount(): number {
    return this.pendingResolvers.size;
  }

  /**
   * 清理所有待处理任务和等待中的 Promise
   * 用于关闭时清理资源
   */
  cleanup(): void {
    // 拒绝所有等待中的 Promise
    for (const [taskId, resolver] of this.pendingResolvers.entries()) {
      clearTimeout(resolver.timer);
      resolver.reject(new Error('Pull client cleanup: task cancelled'));
    }
    this.pendingResolvers.clear();
    this.taskQueue = [];
  }
}
