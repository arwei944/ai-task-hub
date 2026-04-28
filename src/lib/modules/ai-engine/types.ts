export interface ExtractedTask {
  title: string;
  description?: string;
  priority?: 'urgent' | 'high' | 'medium' | 'low';
  type?: string;
  dueDate?: string;
  tags?: string[];
  confidence: number; // 0-1
}

export interface DecomposedTask {
  title: string;
  description: string;
  priority?: 'urgent' | 'high' | 'medium' | 'low';
  order: number;
  dependencies?: number[]; // indices of dependent subtasks
  estimatedEffort?: 'small' | 'medium' | 'large';
}

export interface DecompositionResult {
  subTasks: DecomposedTask[];
  reasoning: string;
}

export interface StatusInference {
  suggestedStatus: string;
  confidence: number;
  reasoning: string;
}

export interface AnalysisReport {
  summary: string;
  totalTasks: number;
  completedTasks: number;
  inProgressTasks: number;
  overdueTasks: number;
  completionRate: number;
  suggestions: string[];
  risks: string[];
}

export interface AICallLog {
  id: string;
  processor: string;
  input: string;
  output: string;
  model: string;
  tokensUsed: number;
  duration: number;
  success: boolean;
  error?: string;
  createdAt: Date;
}
