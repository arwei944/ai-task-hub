interface QueueEntry { resolve: () => void; reject: (reason: Error) => void; priority: number; workflowId?: string; timer?: ReturnType<typeof setTimeout>; }

export class ConcurrencyController {
  private runningCount = 0;
  private readonly queue: QueueEntry[] = [];
  private readonly workflowRunningCounts = new Map<string, number>();
  private readonly workflowLimits = new Map<string, number>();
  private readonly workflowQueues = new Map<string, QueueEntry[]>();

  constructor(private maxConcurrency: number = 5) {}

  async acquire(workflowId?: string, priority: number = 3, timeoutMs?: number): Promise<void> {
    const globalOk = this.runningCount < this.maxConcurrency;
    const workflowOk = workflowId ? (this.workflowRunningCounts.get(workflowId) ?? 0) < this.getWorkflowLimit(workflowId) : true;
    if (globalOk && workflowOk) {
      this.runningCount++;
      if (workflowId) this.workflowRunningCounts.set(workflowId, (this.workflowRunningCounts.get(workflowId) ?? 0) + 1);
      return;
    }
    return new Promise<void>((resolve, reject) => {
      const entry: QueueEntry = { resolve, reject, priority: Math.max(0, Math.min(5, priority)), workflowId };
      this.insertByPriority(this.queue, entry);
      if (workflowId) { if (!this.workflowQueues.has(workflowId)) this.workflowQueues.set(workflowId, []); this.insertByPriority(this.workflowQueues.get(workflowId)!, entry); }
      if (timeoutMs && timeoutMs > 0) {
        entry.timer = setTimeout(() => { this.removeFromQueue(this.queue, entry); if (workflowId) { const wq = this.workflowQueues.get(workflowId); if (wq) this.removeFromQueue(wq, entry); } reject(new Error(`Concurrency acquisition timed out after ${timeoutMs}ms`)); }, timeoutMs);
      }
    });
  }

  release(workflowId?: string): void {
    this.runningCount = Math.max(0, this.runningCount - 1);
    if (workflowId) { const current = this.workflowRunningCounts.get(workflowId) ?? 0; this.workflowRunningCounts.set(workflowId, Math.max(0, current - 1)); }
    this.tryDequeue();
  }

  getRunningCount(): number { return this.runningCount; }
  getQueueLength(): number { return this.queue.length; }
  getWorkflowRunningCount(workflowId: string): number { return this.workflowRunningCounts.get(workflowId) ?? 0; }
  getWorkflowQueueLength(workflowId: string): number { return this.workflowQueues.get(workflowId)?.length ?? 0; }
  setWorkflowLimit(workflowId: string, limit: number): void { this.workflowLimits.set(workflowId, Math.max(1, limit)); this.tryDequeue(); }
  getWorkflowLimit(workflowId: string): number { return this.workflowLimits.get(workflowId) ?? this.maxConcurrency; }
  setMaxConcurrency(max: number): void { this.maxConcurrency = Math.max(1, max); this.tryDequeue(); }

  private tryDequeue(): void {
    while (this.runningCount < this.maxConcurrency && this.queue.length > 0) {
      const entry = this.queue[0]; if (!entry) break;
      if (entry.workflowId) { const wLimit = this.getWorkflowLimit(entry.workflowId); const wRunning = this.workflowRunningCounts.get(entry.workflowId) ?? 0; if (wRunning >= wLimit) break; }
      this.queue.shift(); this.removeFromWorkflowQueue(entry);
      if (entry.timer) clearTimeout(entry.timer);
      this.runningCount++;
      if (entry.workflowId) this.workflowRunningCounts.set(entry.workflowId, (this.workflowRunningCounts.get(entry.workflowId) ?? 0) + 1);
      entry.resolve();
    }
  }

  private removeFromWorkflowQueue(entry: QueueEntry): void { if (!entry.workflowId) return; const wq = this.workflowQueues.get(entry.workflowId); if (wq) this.removeFromQueue(wq, entry); }
  private removeFromQueue(arr: QueueEntry[], entry: QueueEntry): void { const idx = arr.indexOf(entry); if (idx !== -1) arr.splice(idx, 1); }
  private insertByPriority(arr: QueueEntry[], entry: QueueEntry): void { let insertIdx = arr.length; for (let i = 0; i < arr.length; i++) { if (arr[i].priority > entry.priority) { insertIdx = i; break; } } arr.splice(insertIdx, 0, entry); }
}