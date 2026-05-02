// Mock tool definitions for registry tests
export const tools = [
  { name: 'tool_a', description: 'Tool A', inputSchema: { type: 'object', properties: { x: { type: 'string' } }, required: ['x'] } },
  { name: 'tool_b', description: 'Tool B', inputSchema: { type: 'object', properties: {} } },
];
