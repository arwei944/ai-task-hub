interface QueueEntry {
  resolve: () => void;
  reject: (reason: Error) => void;
  priority: number;
  workflowId?: string;
  timer?: ReturnType<typeof setTimeout>;
}

/**
 * 并发控制器
 * 限制同时运行的工作流执行数量
 * 支持优先级队列、per-workflow 并发限制和获取超时
 */
export class ConcurrencyController {
  private runningCount = 0;
  private readonly queue: QueueEntry[] = [];
  private readonly workflowRunningCounts = new Map<string, number>();
  private readonly workflowLimits = new Map<string, number>();
  private readonly workflowQueues = new Map<string, QueueEntry[]>();

  constructor(private maxConcurrency: number = 5) {}

  /**
   * 获取一个执行槽位，如果已满则等待
   * @param workflowId - 可选的工作流 ID，用于 per-workflow 并发限制
   * @param priority - 优先级（0=最高, 5=最低, 默认3），数值越小优先级越高
   * @param timeoutMs - 可选超时（毫秒），超时后抛出 Error
   */
  async acquire(workflowId?: string, priority: number = 3, timeoutMs?: number): Promise<void> {
    // 检查全局并发限制
    const globalOk = this.runningCount < this.maxConcurrency;
    // 检查 per-workflow 并发限制
    const workflowOk = workflowId
      ? (this.workflowRunningCounts.get(workflowId) ?? 0) < this.getWorkflowLimit(workflowId)
      : true;

    if (globalOk && workflowOk) {
      this.runningCount++;
      if (workflowId) {
        this.workflowRunningCounts.set(workflowId, (this.workflowRunningCounts.get(workflowId) ?? 0) + 1);
      }
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const entry: QueueEntry = {
        resolve,
        reject,
        priority: Math.max(0, Math.min(5, priority)),
        workflowId,
      };

      // 加入全局队列（按优先级排序插入）
      this.insertByPriority(this.queue, entry);

      // 如果有 workflowId，也加入 per-workflow 队列
      if (workflowId) {
        if (!this.workflowQueues.has(workflowId)) {
          this.workflowQueues.set(workflowId, []);
        }
        this.insertByPriority(this.workflowQueues.get(workflowId)!, entry);
      }

      // 设置超时
      if (timeoutMs && timeoutMs > 0) {
        entry.timer = setTimeout(() => {
          // 从队列中移除
          this.removeFromQueue(this.queue, entry);
          if (workflowId) {
            const wq = this.workflowQueues.get(workflowId);
            if (wq) {
              this.removeFromQueue(wq, entry);
            }
          }
          reject(new Error(`Concurrency acquisition timed out after ${timeoutMs}ms`));
        }, timeoutMs);
      }
    });
  }

  /**
   * 释放一个执行槽位
   * @param workflowId - 可选的工作流 ID，用于 per-workflow 计数
   */
  release(workflowId?: string): void {
    this.runningCount = Math.max(0, this.runningCount - 1);

    if (workflowId) {
      const current = this.workflowRunningCounts.get(workflowId) ?? 0;
      this.workflowRunningCounts.set(workflowId, Math.max(0, current - 1));
    }

    // 尝试从队列中唤醒下一个等待的执行
    this.tryDequeue();
  }

  /** 获取当前全局运行数 */
  getRunningCount(): number {
    return this.runningCount;
  }

  /** 获取全局等待队列长度 */
  getQueueLength(): number {
    return this.queue.length;
  }

  /** 获取指定工作流的当前运行数 */
  getWorkflowRunningCount(workflowId: string): number {
    return this.workflowRunningCounts.get(workflowId) ?? 0;
  }

  /** 获取指定工作流的等待队列长度 */
  getWorkflowQueueLength(workflowId: string): number {
    return this.workflowQueues.get(workflowId)?.length ?? 0;
  }

  /** 设置指定工作流的并发限制 */
  setWorkflowLimit(workflowId: string, limit: number): void {
    this.workflowLimits.set(workflowId, Math.max(1, limit));
    // 唤醒可能因限制降低而等待的执行
    this.tryDequeue();
  }

  /** 获取指定工作流的并发限制 */
  getWorkflowLimit(workflowId: string): number {
    return this.workflowLimits.get(workflowId) ?? this.maxConcurrency;
  }

  /** 更新全局最大并发数 */
  setMaxConcurrency(max: number): void {
    this.maxConcurrency = Math.max(1, max);
    // 唤醒等待的执行
    this.tryDequeue();
  }

  /** 尝试从队列中唤醒等待的执行 */
  private tryDequeue(): void {
    // 按优先级顺序尝试唤醒
    while (this.runningCount < this.maxConcurrency && this.queue.length > 0) {
      const entry = this.queue[0];
      if (!entry) break;

      // 检查 per-workflow 限制
      if (entry.workflowId) {
        const wLimit = this.getWorkflowLimit(entry.workflowId);
        const wRunning = this.workflowRunningCounts.get(entry.workflowId) ?? 0;
        if (wRunning >= wLimit) {
          // 跳过这个 entry，尝试下一个（不能 shift，因为它还在 per-workflow 队列中）
          // 但我们需要避免无限循环，所以 break
          break;
        }
      }

      // 可以执行
      this.queue.shift();
      this.removeFromWorkflowQueue(entry);

      if (entry.timer) {
        clearTimeout(entry.timer);
      }

      this.runningCount++;
      if (entry.workflowId) {
        this.workflowRunningCounts.set(
          entry.workflowId,
          (this.workflowRunningCounts.get(entry.workflowId) ?? 0) + 1,
        );
      }

      entry.resolve();
    }
  }

  /** 从 per-workflow 队列中移除 entry */
  private removeFromWorkflowQueue(entry: QueueEntry): void {
    if (!entry.workflowId) return;
    const wq = this.workflowQueues.get(entry.workflowId);
    if (wq) {
      this.removeFromQueue(wq, entry);
    }
  }

  /** 从数组中移除指定 entry */
  private removeFromQueue(arr: QueueEntry[], entry: QueueEntry): void {
    const idx = arr.indexOf(entry);
    if (idx !== -1) {
      arr.splice(idx, 1);
    }
  }

  /** 按优先级插入队列（数值越小优先级越高，排在前面） */
  private insertByPriority(arr: QueueEntry[], entry: QueueEntry): void {
    // 找到第一个优先级比 entry 低（数值更大）的位置
    let insertIdx = arr.length;
    for (let i = 0; i < arr.length; i++) {
      if (arr[i].priority > entry.priority) {
        insertIdx = i;
        break;
      }
    }
    arr.splice(insertIdx, 0, entry);
  }
}
