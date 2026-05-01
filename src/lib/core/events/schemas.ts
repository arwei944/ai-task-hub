// ============================================================
// AI Task Hub - Event Schemas
// Zod schemas for validating event payloads
// ============================================================

import { z } from 'zod';

// --- Project Event Schemas ---

export const projectCreatedSchema = z.object({
  projectId: z.string(),
  name: z.string(),
  description: z.string().optional(),
  creatorId: z.string().optional(),
  creatorType: z.string().optional(),
});

export const projectPhaseChangedSchema = z.object({
  projectId: z.string(),
  phase: z.string(),
  previousPhase: z.string().optional(),
});

export const projectArchivedSchema = z.object({
  projectId: z.string(),
  archivedBy: z.string().optional(),
});

export const projectDeletedSchema = z.object({
  projectId: z.string(),
  deletedBy: z.string().optional(),
});

export const projectHealthUpdatedSchema = z.object({
  projectId: z.string(),
  health: z.string(),
  score: z.number().optional(),
});

// --- Task Event Schemas ---

export const taskCreatedSchema = z.object({
  taskId: z.string(),
  projectId: z.string().optional(),
  title: z.string(),
  priority: z.string().optional(),
  source: z.string().optional(),
  creator: z.string().optional(),
});

export const taskStatusChangedSchema = z.object({
  taskId: z.string(),
  projectId: z.string().optional(),
  status: z.string(),
  previousStatus: z.string().optional(),
  changedBy: z.string().optional(),
});

export const taskAssignedSchema = z.object({
  taskId: z.string(),
  projectId: z.string().optional(),
  assignee: z.string(),
  assignedBy: z.string().optional(),
});

export const taskPriorityChangedSchema = z.object({
  taskId: z.string(),
  projectId: z.string().optional(),
  priority: z.string(),
  previousPriority: z.string().optional(),
  changedBy: z.string().optional(),
});

export const taskCompletedSchema = z.object({
  taskId: z.string(),
  projectId: z.string().optional(),
  completedBy: z.string().optional(),
  duration: z.number().optional(),
});

export const taskBlockedSchema = z.object({
  taskId: z.string(),
  projectId: z.string().optional(),
  reason: z.string().optional(),
  blockedBy: z.string().optional(),
});

export const taskDependencyAddedSchema = z.object({
  taskId: z.string(),
  dependsOnId: z.string(),
  addedBy: z.string().optional(),
});

export const taskCommentAddedSchema = z.object({
  taskId: z.string(),
  projectId: z.string().optional(),
  comment: z.string(),
  author: z.string().optional(),
});

// --- Workflow Event Schemas ---

export const workflowTriggeredSchema = z.object({
  workflowId: z.string(),
  triggerType: z.string().optional(),
  triggeredBy: z.string().optional(),
  context: z.record(z.string(), z.unknown()).optional(),
});

export const workflowStepCompletedSchema = z.object({
  workflowId: z.string(),
  executionId: z.string().optional(),
  stepId: z.string(),
  stepName: z.string().optional(),
  output: z.unknown().optional(),
  durationMs: z.number().optional(),
});

export const workflowStepFailedSchema = z.object({
  workflowId: z.string(),
  executionId: z.string().optional(),
  stepId: z.string(),
  stepName: z.string().optional(),
  error: z.string().optional(),
  retryCount: z.number().optional(),
});

export const workflowCompletedSchema = z.object({
  workflowId: z.string(),
  executionId: z.string().optional(),
  status: z.string().optional(),
  durationMs: z.number().optional(),
});

export const workflowFailedSchema = z.object({
  workflowId: z.string(),
  executionId: z.string().optional(),
  error: z.string().optional(),
});

export const workflowApprovalRequestedSchema = z.object({
  workflowId: z.string(),
  executionId: z.string().optional(),
  stepId: z.string(),
  stepName: z.string().optional(),
  requestedBy: z.string().optional(),
  context: z.unknown().optional(),
});

export const workflowApprovalDecidedSchema = z.object({
  workflowId: z.string(),
  executionId: z.string().optional(),
  stepId: z.string(),
  decision: z.string(),
  decidedBy: z.string().optional(),
  comment: z.string().optional(),
});

// --- Release Event Schemas ---

export const releaseCreatedSchema = z.object({
  releaseId: z.string(),
  projectId: z.string(),
  version: z.string(),
  title: z.string().optional(),
  channel: z.string().optional(),
  type: z.string().optional(),
  createdBy: z.string().optional(),
});

export const releaseStatusChangedSchema = z.object({
  releaseId: z.string(),
  projectId: z.string(),
  status: z.string(),
  previousStatus: z.string().optional(),
  changedBy: z.string().optional(),
});

export const releasePublishedSchema = z.object({
  releaseId: z.string(),
  projectId: z.string(),
  version: z.string().optional(),
  publishedBy: z.string().optional(),
});

export const releaseRolledBackSchema = z.object({
  releaseId: z.string(),
  projectId: z.string(),
  reason: z.string().optional(),
  rolledBackBy: z.string().optional(),
});

// --- Requirement Event Schemas ---

export const requirementCreatedSchema = z.object({
  requirementId: z.string(),
  projectId: z.string(),
  title: z.string(),
  description: z.string().optional(),
  priority: z.string().optional(),
  createdBy: z.string().optional(),
});

export const requirementStatusChangedSchema = z.object({
  requirementId: z.string(),
  projectId: z.string().optional(),
  status: z.string(),
  previousStatus: z.string().optional(),
  changedBy: z.string().optional(),
});

export const requirementMappedToTaskSchema = z.object({
  requirementId: z.string(),
  taskId: z.string(),
  projectId: z.string().optional(),
  mappedBy: z.string().optional(),
});

// --- Agent Event Schemas ---

export const agentRegisteredSchema = z.object({
  agentId: z.string(),
  name: z.string(),
  clientType: z.string().optional(),
  capabilities: z.array(z.string()).optional(),
});

export const agentTaskClaimedSchema = z.object({
  agentId: z.string(),
  taskId: z.string(),
  projectId: z.string().optional(),
});

export const agentTaskCompletedSchema = z.object({
  agentId: z.string(),
  taskId: z.string(),
  projectId: z.string().optional(),
  duration: z.number().optional(),
});

// --- Integration Event Schemas ---

export const integrationGithubPushSchema = z.object({
  repo: z.string(),
  branch: z.string().optional(),
  commit: z.string().optional(),
  pushedBy: z.string().optional(),
});

export const integrationGithubPrOpenedSchema = z.object({
  repo: z.string(),
  prNumber: z.number().optional(),
  title: z.string().optional(),
  author: z.string().optional(),
});

export const integrationGithubPrMergedSchema = z.object({
  repo: z.string(),
  prNumber: z.number().optional(),
  mergedBy: z.string().optional(),
});

export const integrationGithubIssueCreatedSchema = z.object({
  repo: z.string(),
  issueNumber: z.number().optional(),
  title: z.string().optional(),
  author: z.string().optional(),
});

// --- System Event Schemas ---

export const systemModuleLoadedSchema = z.object({
  moduleId: z.string(),
  version: z.string().optional(),
});

export const systemModuleUnloadedSchema = z.object({
  moduleId: z.string(),
  reason: z.string().optional(),
});

export const systemConfigChangedSchema = z.object({
  moduleId: z.string().optional(),
  key: z.string(),
  previousValue: z.unknown().optional(),
  newValue: z.unknown().optional(),
  changedBy: z.string().optional(),
});

// --- Master Schema Map ---

export const eventSchemas: Record<string, z.ZodType> = {
  // Project events
  'project.created': projectCreatedSchema,
  'project.phase.changed': projectPhaseChangedSchema,
  'project.archived': projectArchivedSchema,
  'project.deleted': projectDeletedSchema,
  'project.health.updated': projectHealthUpdatedSchema,

  // Task events
  'task.created': taskCreatedSchema,
  'task.status.changed': taskStatusChangedSchema,
  'task.assigned': taskAssignedSchema,
  'task.priority.changed': taskPriorityChangedSchema,
  'task.completed': taskCompletedSchema,
  'task.blocked': taskBlockedSchema,
  'task.dependency.added': taskDependencyAddedSchema,
  'task.comment.added': taskCommentAddedSchema,

  // Workflow events
  'workflow.triggered': workflowTriggeredSchema,
  'workflow.step.completed': workflowStepCompletedSchema,
  'workflow.step.failed': workflowStepFailedSchema,
  'workflow.completed': workflowCompletedSchema,
  'workflow.failed': workflowFailedSchema,
  'workflow.approval.requested': workflowApprovalRequestedSchema,
  'workflow.approval.decided': workflowApprovalDecidedSchema,

  // Release events
  'release.created': releaseCreatedSchema,
  'release.status.changed': releaseStatusChangedSchema,
  'release.published': releasePublishedSchema,
  'release.rolled.back': releaseRolledBackSchema,

  // Requirement events
  'requirement.created': requirementCreatedSchema,
  'requirement.status.changed': requirementStatusChangedSchema,
  'requirement.mapped.to.task': requirementMappedToTaskSchema,

  // Agent events
  'agent.registered': agentRegisteredSchema,
  'agent.task.claimed': agentTaskClaimedSchema,
  'agent.task.completed': agentTaskCompletedSchema,

  // Integration events
  'integration.github.push': integrationGithubPushSchema,
  'integration.github.pr.opened': integrationGithubPrOpenedSchema,
  'integration.github.pr.merged': integrationGithubPrMergedSchema,
  'integration.github.issue.created': integrationGithubIssueCreatedSchema,

  // System events
  'system.module.loaded': systemModuleLoadedSchema,
  'system.module.unloaded': systemModuleUnloadedSchema,
  'system.config.changed': systemConfigChangedSchema,
};
