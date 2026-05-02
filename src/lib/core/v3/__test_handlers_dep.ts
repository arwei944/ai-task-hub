// Mock handler factory for registry tests
export const createHandlers = (_ctx: any) => ({
  dep_tool: async () => ({ result: 'dep' }),
});
