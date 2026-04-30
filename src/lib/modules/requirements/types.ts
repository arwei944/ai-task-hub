// ============================================================
// Requirements Module - Type Definitions
// ============================================================

export interface CreateRequirementInput {
  projectId: string;
  title: string;
  description: string;
  type?: 'feature' | 'bug' | 'improvement' | 'epic';
  priority?: number;
  complexity?: 'low' | 'medium' | 'high' | 'critical';
  acceptance?: string;
  source?: string;
  parentReqId?: string;
  createdBy?: string;
  tags?: string[];
}

export interface UpdateRequirementInput {
  title?: string;
  description?: string;
  type?: string;
  priority?: number;
  status?: string;
  complexity?: string;
  acceptance?: string;
  source?: string;
  parentReqId?: string | null;
}

export interface RequirementFilter {
  projectId?: string;
  status?: string;
  type?: string;
  priority?: number;
  complexity?: string;
  parentReqId?: string;
  search?: string;
  limit?: number;
  offset?: number;
}

export const REQUIREMENT_TYPES = ['feature', 'bug', 'improvement', 'epic'] as const;
export const REQUIREMENT_STATUSES = ['draft', 'reviewing', 'approved', 'implemented', 'verified', 'rejected'] as const;
export const COMPLEXITY_LEVELS = ['low', 'medium', 'high', 'critical'] as const;
