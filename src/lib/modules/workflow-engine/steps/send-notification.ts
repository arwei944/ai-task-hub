import type { StepHandler, StepHandlerDeps } from '../types';
export class SendNotificationStep implements StepHandler {
  constructor(private deps: StepHandlerDeps) {}
  async execute(config: Record<string, unknown>, context: Record<string, unknown>) {
    const title = String(config.title ?? 'Workflow Notification');
    let message = String(config.message ?? '');
    const channel = String(config.channel ?? 'system');
    const level = String(config.level ?? 'info');
    message = message.replace(/\{\{(\w+)\}\}/g, (_, varName) => context[varName] !== undefined ? String(context[varName]) : '');
    return { lastNotification: { channel, title, message, level, sentAt: new Date().toISOString() } };
  }
}