// Mock handler factory for registry tests
export const createHandlers = (_ctx: any) => ({
  tool_a: async (args: any) => ({ result: 'a', x: args?.x }),
  tool_b: async () => ({ result: 'b' }),
});
