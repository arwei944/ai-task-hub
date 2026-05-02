// Mock handler factory for registry tests (intentionally missing no_handler)
export const createHandlers = (_ctx: any) => ({
  has_handler: async () => ({ result: 'ok' }),
});
