import type { StepHandler } from '../types';
export class WaitStep implements StepHandler {
  async execute(config: Record<string, unknown>) {
    const delayMs = Number(config.delayMs ?? (config.seconds ? Number(config.seconds) * 1000 : 1000));
    await new Promise((resolve) => setTimeout(resolve, delayMs));
    return { waitedMs: delayMs };
  }
}