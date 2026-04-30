// ============================================================
// Agent Capability Registry Tests
// ============================================================

import { describe, it, expect, beforeEach } from 'vitest';
import { AgentCapabilityRegistry } from '@/lib/modules/agent-collab/capabilities';

describe('AgentCapabilityRegistry', () => {
  let registry: AgentCapabilityRegistry;

  beforeEach(() => {
    registry = new AgentCapabilityRegistry();
  });

  describe('declareCapabilities', () => {
    it('should register an agent with capabilities', () => {
      registry.declareCapabilities('agent-1', 'developer', ['task_execution', 'code_review']);

      const caps = registry.getAgentCapabilities('agent-1');
      expect(caps).toBeDefined();
      expect(caps!.agentId).toBe('agent-1');
      expect(caps!.role).toBe('developer');
      expect(caps!.capabilities).toEqual(['task_execution', 'code_review']);
    });

    it('should update capabilities for existing agent', () => {
      registry.declareCapabilities('agent-1', 'developer', ['task_execution']);
      registry.declareCapabilities('agent-1', 'developer', ['task_execution', 'bug_fixing']);

      const caps = registry.getAgentCapabilities('agent-1');
      expect(caps!.capabilities).toEqual(['task_execution', 'bug_fixing']);
    });

    it('should set declaredAt timestamp', () => {
      const before = new Date();
      registry.declareCapabilities('agent-1', 'pm', ['planning']);
      const after = new Date();

      const caps = registry.getAgentCapabilities('agent-1');
      expect(caps!.declaredAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
      expect(caps!.declaredAt.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe('findAgentsByCapability', () => {
    it('should find agents with a specific capability', () => {
      registry.declareCapabilities('agent-1', 'developer', ['task_execution', 'code_review']);
      registry.declareCapabilities('agent-2', 'developer', ['task_execution', 'bug_fixing']);
      registry.declareCapabilities('agent-3', 'tester', ['test_creation']);

      const found = registry.findAgentsByCapability('task_execution');
      expect(found).toHaveLength(2);
      expect(found.map((a) => a.agentId)).toContain('agent-1');
      expect(found.map((a) => a.agentId)).toContain('agent-2');
    });

    it('should return empty array when no agents have the capability', () => {
      registry.declareCapabilities('agent-1', 'developer', ['task_execution']);

      const found = registry.findAgentsByCapability('test_creation');
      expect(found).toHaveLength(0);
    });

    it('should return empty array when registry is empty', () => {
      const found = registry.findAgentsByCapability('task_execution');
      expect(found).toHaveLength(0);
    });
  });

  describe('getAgentCapabilities', () => {
    it('should return undefined for unknown agent', () => {
      const caps = registry.getAgentCapabilities('unknown');
      expect(caps).toBeUndefined();
    });
  });

  describe('getAgentRole', () => {
    it('should return the role of an agent', () => {
      registry.declareCapabilities('agent-1', 'architect', ['architecture_design']);

      expect(registry.getAgentRole('agent-1')).toBe('architect');
    });

    it('should return undefined for unknown agent', () => {
      expect(registry.getAgentRole('unknown')).toBeUndefined();
    });
  });

  describe('agentHasCapability', () => {
    it('should return true when agent has capability', () => {
      registry.declareCapabilities('agent-1', 'tester', ['test_creation', 'test_execution']);

      expect(registry.agentHasCapability('agent-1', 'test_creation')).toBe(true);
    });

    it('should return false when agent does not have capability', () => {
      registry.declareCapabilities('agent-1', 'tester', ['test_creation']);

      expect(registry.agentHasCapability('agent-1', 'deployment')).toBe(false);
    });

    it('should return false for unknown agent', () => {
      expect(registry.agentHasCapability('unknown', 'test_creation')).toBe(false);
    });
  });

  describe('removeAgent', () => {
    it('should remove an agent from the registry', () => {
      registry.declareCapabilities('agent-1', 'developer', ['task_execution']);
      expect(registry.size).toBe(1);

      const removed = registry.removeAgent('agent-1');
      expect(removed).toBe(true);
      expect(registry.size).toBe(0);
      expect(registry.getAgentCapabilities('agent-1')).toBeUndefined();
    });

    it('should return false when removing unknown agent', () => {
      expect(registry.removeAgent('unknown')).toBe(false);
    });
  });

  describe('getAllAgents', () => {
    it('should return all registered agents', () => {
      registry.declareCapabilities('agent-1', 'pm', ['planning']);
      registry.declareCapabilities('agent-2', 'devops', ['deployment']);

      const all = registry.getAllAgents();
      expect(all).toHaveLength(2);
    });

    it('should return empty array when no agents', () => {
      expect(registry.getAllAgents()).toHaveLength(0);
    });
  });

  describe('getAgentsByRole', () => {
    it('should group agents by role', () => {
      registry.declareCapabilities('agent-1', 'developer', ['task_execution']);
      registry.declareCapabilities('agent-2', 'developer', ['bug_fixing']);
      registry.declareCapabilities('agent-3', 'tester', ['test_creation']);

      const grouped = registry.getAgentsByRole();
      expect(grouped.get('developer')).toHaveLength(2);
      expect(grouped.get('tester')).toHaveLength(1);
      expect(grouped.get('pm')).toBeUndefined();
    });
  });

  describe('clear', () => {
    it('should clear all registrations', () => {
      registry.declareCapabilities('agent-1', 'developer', ['task_execution']);
      registry.declareCapabilities('agent-2', 'tester', ['test_creation']);
      expect(registry.size).toBe(2);

      registry.clear();
      expect(registry.size).toBe(0);
    });
  });

  describe('size', () => {
    it('should return correct count', () => {
      expect(registry.size).toBe(0);

      registry.declareCapabilities('agent-1', 'developer', ['task_execution']);
      expect(registry.size).toBe(1);

      registry.declareCapabilities('agent-2', 'tester', ['test_creation']);
      expect(registry.size).toBe(2);

      // Re-registering same agent should not increase count
      registry.declareCapabilities('agent-1', 'developer', ['code_review']);
      expect(registry.size).toBe(2);
    });
  });
});
