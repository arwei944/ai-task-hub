/**
 * 并发控制器
 * 限制同时运行的工作流执行数量
 */
export class ConcurrencyController {
  private runningCount = 0;
  private readonly queue: Array<{ resolve: () => void }> = [];

  constructor(private maxConcurrency: number = 5) {}

  /** 获取一个执行槽位，如果已满则等待 */
  async acquire(): Promise<void> {
    if (this.runningCount < this.maxConcurrency) {
      this.runningCount++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push({ resolve });
    });
  }

  /** 释放一个执行槽位 */
  release(): void {
    this.runningCount = Math.max(0, this.runningCount - 1);
    const next = this.queue.shift();
    if (next) {
      this.runningCount++;
      next.resolve();
    }
  }

  /** 获取当前运行数 */
  getRunningCount(): number {
    return this.runningCount;
  }

  /** 获取等待队列长度 */
  getQueueLength(): number {
    return this.queue.length;
  }

  /** 更新最大并发数 */
  setMaxConcurrency(max: number): void {
    this.maxConcurrency = Math.max(1, max);
    // 唤醒等待的执行
    while (this.runningCount < this.maxConcurrency && this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) {
        this.runningCount++;
        next.resolve();
      }
    }
  }
}
