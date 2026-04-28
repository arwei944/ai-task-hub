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
});

export type AppRouter = typeof appRouter;
