// ============================================================
// Agent Roles Tests
// ============================================================

import { describe, it, expect } from 'vitest';
import {
  AGENT_ROLES,
  getRole,
  getRoleKeys,
  roleHasCapability,
  findRolesByCapability,
  ALL_CAPABILITIES,
} from '@/lib/modules/agent-collab/roles';

describe('AGENT_ROLES', () => {
  it('should define all expected roles', () => {
    expect(AGENT_ROLES).toHaveProperty('pm');
    expect(AGENT_ROLES).toHaveProperty('developer');
    expect(AGENT_ROLES).toHaveProperty('tester');
    expect(AGENT_ROLES).toHaveProperty('devops');
    expect(AGENT_ROLES).toHaveProperty('architect');
  });

  it('should have correct role names', () => {
    expect(AGENT_ROLES.pm.name).toBe('项目经理');
    expect(AGENT_ROLES.developer.name).toBe('开发者');
    expect(AGENT_ROLES.tester.name).toBe('测试工程师');
    expect(AGENT_ROLES.devops.name).toBe('运维工程师');
    expect(AGENT_ROLES.architect.name).toBe('架构师');
  });

  it('should have capabilities for each role', () => {
    for (const [key, role] of Object.entries(AGENT_ROLES)) {
      expect(role.capabilities.length).toBeGreaterThan(0);
      expect(role.capabilities).toBeInstanceOf(Array);
    }
  });

  it('should have correct capabilities for PM', () => {
    expect(AGENT_ROLES.pm.capabilities).toContain('requirement_management');
    expect(AGENT_ROLES.pm.capabilities).toContain('planning');
    expect(AGENT_ROLES.pm.capabilities).toContain('priority_setting');
  });

  it('should have correct capabilities for developer', () => {
    expect(AGENT_ROLES.developer.capabilities).toContain('task_execution');
    expect(AGENT_ROLES.developer.capabilities).toContain('code_review');
    expect(AGENT_ROLES.developer.capabilities).toContain('bug_fixing');
  });

  it('should have correct capabilities for tester', () => {
    expect(AGENT_ROLES.tester.capabilities).toContain('test_creation');
    expect(AGENT_ROLES.tester.capabilities).toContain('test_execution');
    expect(AGENT_ROLES.tester.capabilities).toContain('quality_assurance');
  });

  it('should have correct capabilities for devops', () => {
    expect(AGENT_ROLES.devops.capabilities).toContain('deployment');
    expect(AGENT_ROLES.devops.capabilities).toContain('monitoring');
    expect(AGENT_ROLES.devops.capabilities).toContain('incident_response');
  });

  it('should have correct capabilities for architect', () => {
    expect(AGENT_ROLES.architect.capabilities).toContain('architecture_design');
    expect(AGENT_ROLES.architect.capabilities).toContain('tech_review');
    expect(AGENT_ROLES.architect.capabilities).toContain('performance_optimization');
  });
});

describe('getRole', () => {
  it('should return the correct role', () => {
    const pm = getRole('pm');
    expect(pm.name).toBe('项目经理');
  });

  it('should return all roles', () => {
    const keys = getRoleKeys();
    expect(keys).toHaveLength(5);
    expect(keys).toContain('pm');
    expect(keys).toContain('developer');
    expect(keys).toContain('tester');
    expect(keys).toContain('devops');
    expect(keys).toContain('architect');
  });
});

describe('roleHasCapability', () => {
  it('should return true for existing capability', () => {
    expect(roleHasCapability('developer', 'task_execution')).toBe(true);
    expect(roleHasCapability('tester', 'test_creation')).toBe(true);
  });

  it('should return false for non-existing capability', () => {
    expect(roleHasCapability('developer', 'test_creation')).toBe(false);
    expect(roleHasCapability('pm', 'deployment')).toBe(false);
  });
});

describe('findRolesByCapability', () => {
  it('should find roles with specific capability', () => {
    // No two roles share the same capability in our definition
    const roles = findRolesByCapability('task_execution');
    expect(roles).toContain('developer');
    expect(roles).toHaveLength(1);
  });

  it('should return empty array for unknown capability', () => {
    const roles = findRolesByCapability('unknown_capability');
    expect(roles).toHaveLength(0);
  });
});

describe('ALL_CAPABILITIES', () => {
  it('should contain all capabilities from all roles', () => {
    expect(ALL_CAPABILITIES.length).toBe(15); // 3 per role * 5 roles
  });

  it('should be unique', () => {
    const unique = new Set(ALL_CAPABILITIES);
    expect(unique.size).toBe(ALL_CAPABILITIES.length);
  });
});
