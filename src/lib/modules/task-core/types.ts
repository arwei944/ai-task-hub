export type TaskStatus = 'todo' | 'in_progress' | 'done' | 'closed' | 'deleted';
export type TaskPriority = 'urgent' | 'high' | 'medium' | 'low';

export const VALID_TRANSITIONS: Record<TaskStatus, TaskStatus[]> = {
  todo: ['in_progress', 'closed'],
  in_progress: ['done', 'closed'],
  done: ['todo'], // reopen
  closed: [],
  deleted: [],
};

export interface CreateTaskDTO {
  title: string;
  description?: string;
  priority?: TaskPriority;
  type?: string;
  source?: string;
  sourceRef?: string;
  assignee?: string;
  creator?: string;
  parentTaskId?: string;
  dueDate?: Date;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface UpdateTaskDTO {
  title?: string;
  description?: string;
  status?: TaskStatus;
  priority?: TaskPriority;
  progress?: number;
  type?: string;
  assignee?: string;
  dueDate?: Date;
  tags?: string[];
  metadata?: Record<string, unknown>;
}

export interface TaskQuery {
  status?: TaskStatus[];
  priority?: TaskPriority[];
  type?: string;
  creator?: string;
  assignee?: string;
  tags?: string[];
  parentTaskId?: string | null;
  search?: string;
  dueBefore?: Date;
  dueAfter?: Date;
  sortBy?: 'createdAt' | 'updatedAt' | 'priority' | 'dueDate' | 'progress';
  sortOrder?: 'asc' | 'desc';
  page?: number;
  pageSize?: number;
}

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface TaskWithRelations {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  progress: number;
  type: string;
  source: string;
  sourceRef: string | null;
  assignee: string | null;
  creator: string | null;
  parentTaskId: string | null;
  projectId: string | null;
  dueDate: Date | null;
  startedAt: Date | null;
  completedAt: Date | null;
  metadata: string | null;
  createdAt: Date;
  updatedAt: Date;
  subTasks?: TaskWithRelations[];
  tags?: { tag: { id: string; name: string; color: string } }[];
  dependencies?: { dependsOn: { id: string; title: string; status: string } }[];
  dependents?: { task: { id: string; title: string; status: string } }[];
  _count?: {
    subTasks: number;
    dependencies: number;
    dependents: number;
    history: number;
  };
}
