// Mock handler factory for registry tests
export const createHandlers = (_ctx: any) => ({
  main_tool: async () => ({ result: 'main' }),
});
