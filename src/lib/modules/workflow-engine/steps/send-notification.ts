import type { StepHandler, StepHandlerDeps } from '../types';
import { getSSEService } from '@/lib/modules/realtime/sse.service';

export class SendNotificationStep implements StepHandler {
  constructor(private deps: StepHandlerDeps) {}

  async execute(config: Record<string, unknown>, context: Record<string, unknown>) {
    const title = String(config.title ?? 'Workflow Notification');
    let message = String(config.message ?? '');
    const channel = String(config.channel ?? 'system');
    const level = String(config.level ?? 'info');

    // 解析模板变量
    message = message.replace(/\{\{(\w+)\}\}/g, (_, varName) => {
      return context[varName] !== undefined ? String(context[varName]) : '';
    });

    const notification = { channel, title, message, level, sentAt: new Date().toISOString() };

    // 通过 SSE 广播通知，使工作流通知实时可见
    try {
      const sseService = getSSEService();
      sseService.broadcast('notifications', {
        type: 'notification.new',
        data: notification,
      });
    } catch {
      // SSE service unavailable, silently continue
    }

    return {
      lastNotification: notification,
    };
  }
}