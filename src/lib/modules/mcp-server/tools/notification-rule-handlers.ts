import type { ILogger } from '@/lib/core/types';
import type { NotificationRuleEngine } from '@/lib/modules/notifications/rule-engine';

export function createNotificationRuleToolHandlers(engine: NotificationRuleEngine, logger: ILogger) {
  return {
    create_notification_rule: async (args: Record<string, unknown>) => {
      const { name, eventPattern, action, level, titleTemplate, messageTemplate, channels, priority } = args as any;
      try {
        const rule = await engine.createRule({
          name,
          eventPattern,
          action,
          level,
          titleTemplate,
          messageTemplate,
          channels,
          priority,
        });
        return { success: true, rule };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    list_notification_rules: async (args: Record<string, unknown>) => {
      const { isActive } = args as any;
      try {
        const rules = await engine.listRules(
          isActive !== undefined ? { isActive } : undefined,
        );
        return { success: true, rules, count: rules.length };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    update_notification_rule: async (args: Record<string, unknown>) => {
      const { id, name, eventPattern, action, level, titleTemplate, messageTemplate, channels, isActive, priority } = args as any;
      try {
        const rule = await engine.updateRule(id, {
          name, eventPattern, action, level, titleTemplate, messageTemplate, channels, isActive, priority,
        });
        if (!rule) {
          return { success: false, error: 'Rule not found' };
        }
        return { success: true, rule };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    delete_notification_rule: async (args: Record<string, unknown>) => {
      const { id } = args as any;
      const deleted = await engine.deleteRule(id);
      if (!deleted) {
        return { success: false, error: 'Rule not found' };
      }
      return { success: true, message: 'Rule deleted' };
    },

    reload_notification_rules: async () => {
      try {
        const count = await engine.loadRulesFromDb();
        return { success: true, loadedRules: count };
      } catch (error: any) {
        return { success: false, error: error.message };
      }
    },

    get_notification_channels: async () => {
      const channels = engine.getChannels();
      return {
        success: true,
        channels: channels.map(c => ({ id: c.id, name: c.name })),
        count: channels.length,
      };
    },
  };
}
