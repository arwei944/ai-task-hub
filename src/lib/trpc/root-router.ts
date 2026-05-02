import { createTRPCRouter } from './server';
import { authRouter } from './auth-router';
import { tasksRouter } from './tasks-router';
import { aiRouter } from './ai-router';
import { agentsRouter } from './agents-router';
import { integrationsRouter } from './integrations-router';
import { notificationsRouter } from './notifications-router';
import { updaterRouter } from './updater-router';
import { statsRouter } from './stats-router';
import { pluginsRouter } from './plugins-router';
import { workspacesRouter } from './workspaces-router';
import { workflowsRouter } from './workflows-router';
import { feedbackRouter } from './feedback-router';
import { deploymentsRouter } from './deployments-router';
import { notificationRulesRouter } from './notification-rules-router';
import { notificationHistoryRouter } from './notification-history-router';
import { selfHealingRouter } from './self-healing-router';

export const appRouter = createTRPCRouter({
  auth: authRouter,
  tasks: tasksRouter,
  ai: aiRouter,
  agents: agentsRouter,
  integrations: integrationsRouter,
  notifications: notificationsRouter,
  updater: updaterRouter,
  stats: statsRouter,
  plugins: pluginsRouter,
  workspaces: workspacesRouter,
  workflows: workflowsRouter,
  feedback: feedbackRouter,
  deployments: deploymentsRouter,
  notificationRules: notificationRulesRouter,
  notificationHistory: notificationHistoryRouter,
  selfHealing: selfHealingRouter,
});

export type AppRouter = typeof appRouter;
