// ============================================================
// AI Task Hub - Deployment Management Types
// ============================================================

/** 部署环境类型 */
export const DEPLOYMENT_ENVIRONMENTS = ['development', 'staging', 'production'] as const;
export type DeploymentEnvironment = (typeof DEPLOYMENT_ENVIRONMENTS)[number];

/** 部署状态 */
export const DEPLOYMENT_STATUSES = [
  'pending',       // 等待部署
  'queued',        // 排队中
  'building',      // 构建中
  'deploying',     // 部署中
  'verifying',     // 验证中
  'running',       // 运行中
  'failed',        // 失败
  'rolled_back',   // 已回滚
  'cancelled',     // 已取消
] as const;
export type DeploymentStatus = (typeof DEPLOYMENT_STATUSES)[number];

/** 部署策略 */
export const DEPLOYMENT_STRATEGIES = [
  'rolling',       // 滚动更新
  'blue_green',    // 蓝绿部署
  'canary',        // 金丝雀发布
  'recreate',      // 重建部署
] as const;
export type DeploymentStrategy = (typeof DEPLOYMENT_STRATEGIES)[number];

/** 健康检查状态 */
export const HEALTH_STATUSES = ['healthy', 'degraded', 'unhealthy', 'unknown'] as const;
export type HealthStatus = (typeof HEALTH_STATUSES)[number];

/** 健康检查类型 */
export const HEALTH_CHECK_TYPES = ['http', 'tcp', 'process', 'custom'] as const;
export type HealthCheckType = (typeof HEALTH_CHECK_TYPES)[number];

// ---- 输入类型 ----

export interface CreateEnvironmentInput {
  name: string;                    // 环境名称 (dev/staging/prod)
  displayName: string;             // 显示名称
  description?: string;
  baseUrl: string;                 // 环境基础 URL
  config: Record<string, unknown>; // 环境配置 (env vars, etc.)
  order: number;                   // 排序顺序
}

export interface UpdateEnvironmentInput {
  id: string;
  displayName?: string;
  description?: string;
  baseUrl?: string;
  config?: Record<string, unknown>;
  isActive?: boolean;
}

export interface CreateDeploymentInput {
  environmentId: string;
  projectId?: string;
  version: string;                 // 部署版本号
  strategy: DeploymentStrategy;
  description?: string;
  triggeredBy?: string;            // agentId or userId
  config?: Record<string, unknown>; // 部署配置覆盖
}

export interface UpdateDeploymentStatusInput {
  deploymentId: string;
  status: DeploymentStatus;
  message?: string;
  metadata?: Record<string, unknown>;
}

export interface RollbackDeploymentInput {
  deploymentId: string;
  reason?: string;
  triggeredBy?: string;
}

export interface CreateHealthCheckInput {
  environmentId: string;
  name: string;
  type: HealthCheckType;
  config: Record<string, unknown>; // 检查配置 (url, timeout, interval, etc.)
  isActive?: boolean;
}

// ---- 输出/结果类型 ----

export interface EnvironmentResult {
  id: string;
  name: string;
  displayName: string;
  description: string | null;
  baseUrl: string;
  config: Record<string, unknown>;
  isActive: boolean;
  lastDeploymentAt: Date | null;
  healthStatus: HealthStatus;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface DeploymentResult {
  id: string;
  environmentId: string;
  environmentName: string;
  projectId: string | null;
  version: string;
  strategy: DeploymentStrategy;
  status: DeploymentStatus;
  description: string | null;
  triggeredBy: string | null;
  startedAt: Date | null;
  completedAt: Date | null;
  duration: number | null;         // ms
  rollbackFromId: string | null;
  logs: DeploymentLogResult[];
  createdAt: Date;
}

export interface DeploymentLogResult {
  id: string;
  deploymentId: string;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  metadata: Record<string, unknown> | null;
  timestamp: Date;
}

export interface HealthCheckResult {
  id: string;
  environmentId: string;
  name: string;
  type: HealthCheckType;
  config: Record<string, unknown>;
  isActive: boolean;
  lastCheckAt: Date | null;
  lastStatus: HealthStatus;
  consecutiveFailures: number;
  createdAt: Date;
}

export interface DeploymentSummary {
  total: number;
  byStatus: Record<string, number>;
  byEnvironment: Record<string, number>;
  recentDeployments: DeploymentResult[];
}

export interface EnvironmentHealthSummary {
  environmentId: string;
  environmentName: string;
  healthStatus: HealthStatus;
  checks: {
    name: string;
    status: HealthStatus;
    lastCheckAt: Date | null;
  }[];
  lastDeploymentAt: Date | null;
  uptime: number | null; // seconds since last successful deploy
}

// ---- 验证类型 ----

export interface DeploymentValidation {
  canDeploy: boolean;
  checks: {
    name: string;
    passed: boolean;
    message: string;
  }[];
}

export interface RollbackValidation {
  canRollback: boolean;
  reason: string;
  previousDeployment: DeploymentResult | null;
}
