// ============================================================
// Agent Capability Registry
// ============================================================

import type { AgentRoleKey } from './roles';

interface AgentCapabilities {
  agentId: string;
  role: AgentRoleKey;
  capabilities: string[];
  declaredAt: Date;
}

/**
 * AgentCapabilityRegistry
 *
 * Manages agent capabilities at runtime. Agents declare their role and
 * capabilities, and the registry enables capability-based lookups.
 */
export class AgentCapabilityRegistry {
  private agents: Map<string, AgentCapabilities> = new Map();

  /**
   * Declare capabilities for an agent.
   * If the agent already exists, its capabilities are updated.
   */
  declareCapabilities(
    agentId: string,
    role: AgentRoleKey,
    capabilities: string[],
  ): void {
    this.agents.set(agentId, {
      agentId,
      role,
      capabilities: [...capabilities],
      declaredAt: new Date(),
    });
  }

  /**
   * Find all agents that have a specific capability.
   */
  findAgentsByCapability(capability: string): AgentCapabilities[] {
    const result: AgentCapabilities[] = [];
    for (const entry of this.agents.values()) {
      if (entry.capabilities.includes(capability)) {
        result.push(entry);
      }
    }
    return result;
  }

  /**
   * Get capabilities for a specific agent.
   */
  getAgentCapabilities(agentId: string): AgentCapabilities | undefined {
    return this.agents.get(agentId);
  }

  /**
   * Get the role of a specific agent.
   */
  getAgentRole(agentId: string): AgentRoleKey | undefined {
    return this.agents.get(agentId)?.role;
  }

  /**
   * Check if an agent has a specific capability.
   */
  agentHasCapability(agentId: string, capability: string): boolean {
    const entry = this.agents.get(agentId);
    if (!entry) return false;
    return entry.capabilities.includes(capability);
  }

  /**
   * Remove an agent from the registry.
   */
  removeAgent(agentId: string): boolean {
    return this.agents.delete(agentId);
  }

  /**
   * Get all registered agents.
   */
  getAllAgents(): AgentCapabilities[] {
    return Array.from(this.agents.values());
  }

  /**
   * Get agents grouped by role.
   */
  getAgentsByRole(): Map<AgentRoleKey, AgentCapabilities[]> {
    const grouped = new Map<AgentRoleKey, AgentCapabilities[]>();
    for (const entry of this.agents.values()) {
      const existing = grouped.get(entry.role) ?? [];
      existing.push(entry);
      grouped.set(entry.role, existing);
    }
    return grouped;
  }

  /**
   * Clear all registrations.
   */
  clear(): void {
    this.agents.clear();
  }

  /**
   * Get the number of registered agents.
   */
  get size(): number {
    return this.agents.size;
  }
}
