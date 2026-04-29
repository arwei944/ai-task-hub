export class ConcurrencyController {
  private runningCount = 0;
  private readonly queue: Array<{ resolve: () => void }> = [];
  constructor(private maxConcurrency: number = 5) {}

  async acquire(): Promise<void> {
    if (this.runningCount < this.maxConcurrency) { this.runningCount++; return; }
    return new Promise<void>((resolve) => { this.queue.push({ resolve }); });
  }

  release(): void {
    this.runningCount = Math.max(0, this.runningCount - 1);
    const next = this.queue.shift();
    if (next) { this.runningCount++; next.resolve(); }
  }

  getRunningCount(): number { return this.runningCount; }
  getQueueLength(): number { return this.queue.length; }

  setMaxConcurrency(max: number): void {
    this.maxConcurrency = Math.max(1, max);
    while (this.runningCount < this.maxConcurrency && this.queue.length > 0) {
      const next = this.queue.shift();
      if (next) { this.runningCount++; next.resolve(); }
    }
  }
}