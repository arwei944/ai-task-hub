// ============================================================
// Agent Roles Definitions
// ============================================================

export const AGENT_ROLES = {
  pm: {
    name: '项目经理',
    capabilities: ['requirement_management', 'planning', 'priority_setting'],
  },
  developer: {
    name: '开发者',
    capabilities: ['task_execution', 'code_review', 'bug_fixing'],
  },
  tester: {
    name: '测试工程师',
    capabilities: ['test_creation', 'test_execution', 'quality_assurance'],
  },
  devops: {
    name: '运维工程师',
    capabilities: ['deployment', 'monitoring', 'incident_response'],
  },
  architect: {
    name: '架构师',
    capabilities: ['architecture_design', 'tech_review', 'performance_optimization'],
  },
} as const;

export type AgentRoleKey = keyof typeof AGENT_ROLES;

export const ALL_CAPABILITIES = [
  ...AGENT_ROLES.pm.capabilities,
  ...AGENT_ROLES.developer.capabilities,
  ...AGENT_ROLES.tester.capabilities,
  ...AGENT_ROLES.devops.capabilities,
  ...AGENT_ROLES.architect.capabilities,
] as const;

export type AgentCapability = (typeof ALL_CAPABILITIES)[number];

/**
 * Get role by key
 */
export function getRole(key: AgentRoleKey) {
  return AGENT_ROLES[key];
}

/**
 * Get all role keys
 */
export function getRoleKeys(): AgentRoleKey[] {
  return Object.keys(AGENT_ROLES) as AgentRoleKey[];
}

/**
 * Check if a role has a specific capability
 */
export function roleHasCapability(roleKey: AgentRoleKey, capability: string): boolean {
  return (AGENT_ROLES[roleKey].capabilities as readonly string[]).includes(capability);
}

/**
 * Find roles that have a specific capability
 */
export function findRolesByCapability(capability: string): AgentRoleKey[] {
  return (Object.keys(AGENT_ROLES) as AgentRoleKey[]).filter((key) =>
    (AGENT_ROLES[key].capabilities as readonly string[]).includes(capability),
  );
}
