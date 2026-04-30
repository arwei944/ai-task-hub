// ============================================================
// Knowledge Module - Type Definitions
// ============================================================

export type KnowledgeType = 'lesson_learned' | 'decision' | 'pattern' | 'solution' | 'template';

export interface CreateKnowledgeInput {
  projectId?: string;
  type: KnowledgeType;
  title: string;
  content: string;
  tags?: string[];
  sourceEvent?: string;
  aiGenerated?: boolean;
  createdBy?: string;
}

export interface UpdateKnowledgeInput {
  title?: string;
  content?: string;
  tags?: string[];
  type?: string;
}

export interface KnowledgeFilter {
  projectId?: string;
  type?: string;
  tags?: string[];
  search?: string;
  aiGenerated?: boolean;
  limit?: number;
  offset?: number;
}

export const KNOWLEDGE_TYPES = ['lesson_learned', 'decision', 'pattern', 'solution', 'template'] as const;
