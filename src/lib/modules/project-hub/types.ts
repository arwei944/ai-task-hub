// ============================================================
// Project Hub 类型定义
// ============================================================

/**
 * 仪表盘概览数据
 */
export interface DashboardOverview {
  /** 项目总数 */
  totalProjects: number;
  /** 活跃项目数 */
  activeProjects: number;
  /** 已完成项目数 */
  completedProjects: number;
  /** 暂停项目数 */
  pausedProjects: number;
  /** 整体健康评分 (0-100) */
  overallHealthScore: number;
  /** 按状态分组的项目数 */
  projectsByStatus: Record<string, number>;
  /** 按优先级分组的项目数 */
  projectsByPriority: Record<string, number>;
  /** 按阶段分组的项目数 */
  projectsByPhase: Record<string, number>;
  /** 逾期里程碑数 */
  overdueMilestones: number;
  /** 即将到期的截止日期 */
  upcomingDeadlines: Array<{
    projectId: string;
    projectName: string;
    milestoneTitle: string;
    dueDate: string;
    daysLeft: number;
  }>;
  /** 最近活动记录 */
  recentActivity: Array<{
    id: string;
    projectId: string;
    projectName: string;
    action: string;
    title: string;
    createdAt: string;
  }>;
  /** 重点项目概览 */
  topProjects: Array<{
    id: string;
    name: string;
    progress: number;
    healthScore: number;
    taskStats: { total: number; done: number; inProgress: number };
  }>;
}

/**
 * 健康矩阵数据
 */
export interface HealthMatrix {
  /** 项目健康度列表 */
  projects: Array<{
    id: string;
    name: string;
    status: string;
    /** 综合健康评分 (0-100) */
    healthScore: number;
    /** 进度评分 (0-100) */
    progressScore: number;
    /** 时间线评分 (0-100) */
    timelineScore: number;
    /** 工作负载评分 (0-100) */
    workloadScore: number;
    /** 风险等级 */
    riskLevel: 'low' | 'medium' | 'high' | 'critical';
    /** 风险项列表 */
    risks: string[];
  }>;
}

/**
 * 项目列表查询参数
 */
export interface ProjectListQuery {
  /** 按状态筛选 */
  status?: string;
  /** 按阶段筛选 */
  phase?: string;
  /** 按优先级筛选 */
  priority?: string;
  /** 排序字段 */
  sortBy?: string;
  /** 排序方向 */
  sortOrder?: 'asc' | 'desc';
  /** 页码 */
  page?: number;
  /** 每页数量 */
  pageSize?: number;
  /** 搜索关键词 */
  search?: string;
}

/**
 * 里程碑列表查询参数
 */
export interface MilestoneListQuery {
  /** 项目 ID */
  projectId: string;
  /** 按状态筛选 */
  status?: string;
}

/**
 * 项目依赖关系图
 */
export interface DependencyGraph {
  /** 图节点 */
  nodes: Array<{
    id: string;
    name: string;
    status: string;
    healthScore: number;
  }>;
  /** 图边 */
  edges: Array<{
    source: string;
    target: string;
    type: string;
    description?: string;
  }>;
}
