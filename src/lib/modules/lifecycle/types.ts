// ============================================================
// Project Lifecycle - TypeScript Types
// ============================================================

export interface PhaseTransitionRule {
  from: string;
  to: string;
  conditions: string[];
  autoActions: string[];
  requireApproval: boolean;
}

export interface PhaseTransitionInput {
  projectId: string;
  targetPhase: string;
  reason?: string;
  triggeredBy?: string;
}

export interface PhaseTransitionResult {
  success: boolean;
  transitionId?: string;
  previousPhase: string;
  newPhase: string;
  requiresApproval: boolean;
  message: string;
  autoActions?: string[];
}

export interface PhaseValidation {
  canTransition: boolean;
  conditions: string[];
  metConditions: string[];
  unmetConditions: string[];
}

export const PHASES = ['requirements', 'planning', 'architecture', 'implementation', 'testing', 'deployment', 'completed'] as const;
export type Phase = (typeof PHASES)[number];
