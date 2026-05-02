// ============================================================
// AI Task Hub - Events Index
// Re-exports everything from the events directory
// ============================================================

export { EVENT_CATALOG, VALID_EVENT_TYPES } from './event-catalog';
export type { EventType } from './event-catalog';

export { eventSchemas } from './schemas';
export {
  projectCreatedSchema,
  projectPhaseChangedSchema,
  projectArchivedSchema,
  projectDeletedSchema,
  projectHealthUpdatedSchema,
  taskCreatedSchema,
  taskStatusChangedSchema,
  taskAssignedSchema,
  taskPriorityChangedSchema,
  taskCompletedSchema,
  taskBlockedSchema,
  taskDependencyAddedSchema,
  taskCommentAddedSchema,
  workflowTriggeredSchema,
  workflowStepCompletedSchema,
  workflowStepFailedSchema,
  workflowCompletedSchema,
  workflowFailedSchema,
  workflowApprovalRequestedSchema,
  workflowApprovalDecidedSchema,
  releaseCreatedSchema,
  releaseStatusChangedSchema,
  releasePublishedSchema,
  releaseRolledBackSchema,
  requirementCreatedSchema,
  requirementStatusChangedSchema,
  requirementMappedToTaskSchema,
  agentRegisteredSchema,
  agentTaskClaimedSchema,
  agentTaskCompletedSchema,
  integrationGithubPushSchema,
  integrationGithubPrOpenedSchema,
  integrationGithubPrMergedSchema,
  integrationGithubIssueCreatedSchema,
  systemModuleLoadedSchema,
  systemModuleUnloadedSchema,
  systemConfigChangedSchema,
} from './schemas';

export type { TypedDomainEvent, EventFilter, EventStoreEntry } from './types';

export { EventStore } from './event-store';
