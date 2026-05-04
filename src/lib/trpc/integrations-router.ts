import { z } from 'zod';
import { createTRPCRouter, protectedProcedure, adminProcedure } from './server';

export const integrationsRouter = createTRPCRouter({
  // List available adapter types
  adapterTypes: protectedProcedure.query(({ ctx }) => {
    return ctx.services.integrationService.getAdapterTypes();
  }),

  // Create integration
  create: adminProcedure
    .input(z.object({
      type: z.string(),
      name: z.string().min(1),
      description: z.string().optional(),
      config: z.record(z.string(), z.unknown()),
    }))
    .mutation(async ({ input, ctx }) => {
      return ctx.services.integrationService.createIntegration(input);
    }),

  // List integrations
  list: protectedProcedure
    .input(z.object({
      type: z.string().optional(),
      isActive: z.boolean().optional(),
    }).optional())
    .query(async ({ input, ctx }) => {
      return ctx.services.integrationService.listIntegrations(input);
    }),

  // Get integration
  get: protectedProcedure.input(z.object({ id: z.string() })).query(async ({ input, ctx }) => {
    const integration = await ctx.services.integrationService.getIntegration(input.id);
    if (!integration) throw new Error('Integration not found');
    return integration;
  }),

  // Update integration
  update: adminProcedure
    .input(z.object({
      id: z.string(),
      name: z.string().optional(),
      description: z.string().optional(),
      config: z.record(z.string(), z.unknown()).optional(),
      isActive: z.boolean().optional(),
    }))
    .mutation(async ({ input, ctx }) => {
      const { id, ...data } = input;
      return ctx.services.integrationService.updateIntegration(id, data);
    }),

  // Delete integration
  delete: adminProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
    await ctx.services.integrationService.deleteIntegration(input.id);
    return { success: true };
  }),

  // Test connection
  testConnection: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
    return ctx.services.integrationService.testConnection(input.id);
  }),

  // Trigger sync
  sync: protectedProcedure.input(z.object({ id: z.string() })).mutation(async ({ input, ctx }) => {
    return ctx.services.integrationService.syncIntegration(input.id);
  }),
});
