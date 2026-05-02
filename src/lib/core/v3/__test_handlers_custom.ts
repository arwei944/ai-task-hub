// Mock handler factory for registry tests
let _receivedArgs: any[] = [];
export const createHandlers = (...args: any[]) => {
  _receivedArgs = args;
  return { custom_tool: async () => ({ result: 'custom', args: _receivedArgs }) };
};
export function getReceivedArgs() { return _receivedArgs; }
