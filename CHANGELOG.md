# Changelog

## [1.8.0] - 2026-04-29

### Phase C: Intelligence - Strategy-as-Code + Observability + Feedback Loop

#### Strategy-as-Code (C-1)
- **WORKFLOW.md Parser** - Parse Markdown workflow definitions into CreateWorkflowDTO
- **Workflow Validator** - Validate DTO: step types, retry policy, concurrency, circular reference detection

#### Workspace Isolation (C-2)
- **IsolationLevel** - Three levels: none / context / full
- **WorkspaceManager** - Create/get/destroy isolated workspaces
- **IsolatedContextWrapper** - Context-level read/write isolation

#### Observability Layer (C-3)
- **In-memory metrics** - stepMetrics / soloCallHistory / executionHistory (cap 10000)
- **Query methods** - getStepMetrics / getSOLOCallHistory / getExecutionMetrics
- **Statistics** - getWorkflowStats / getGlobalStats

#### Concurrency Controller (C-4)
- **Per-workflow limits** - Independent counter per workflow
- **Priority queue** - 0-5 priority levels
- **Acquisition timeout** - Optional timeoutMs with auto-cleanup

#### Feedback-Driven Improvement Loop (C-5)
- **ImprovementLoop** - SOLO-powered feedback analysis and optimization
- **analyzeFeedbackPatterns** - Analyze approval/rejection/failure rates
- **generateRecommendations** - 6 recommendation types via SOLO
- **applyRecommendation** - Auto-create FeedbackRule
- **runImprovementCycle** - Full analyze-recommend-apply pipeline

#### Standard Module Registration (C-7)
- **WorkflowEngineModule** - Implements Module interface, locked=true
- 12 services registered to DI container

#### Observability Frontend (C-6)
- **/observability page** - 4 stat cards + 3 tab views
- Recent executions / step performance / SOLO call history tables
- Sidebar updated with observability entry

---

## [1.7.0] - 2026-04-29

### Phase B: Trigger System + Advanced Steps + Notification Integration

#### Trigger System (B-1~B-4)
- **TriggerDispatcher** - Unified trigger management, 5 trigger types
  - schedule, event, webhook, manual, github-issue
- **WorkflowTriggerLog** - Trigger execution logging

#### Advanced Steps (B-5~B-8)
- **invoke-agent** - Full SOLO task execution step
- **foreach** - Array iteration with sub-steps
- **approval** - Human approval node with blocking wait
- **Retry mechanism** - exponential/linear/fixed backoff

#### Feedback Rule Engine (B-9)
- **Post-execute rule evaluation** - duration/token_cost/error triggers
- **SOLO deep self-reflection** - Risk assessment via SOLO Bridge

#### Notification Integration (B-10)
- **WorkflowNotificationIntegration** - EventBus to SSE bridge, 7 event types
- **Feedback checkpoint SSE broadcast** - Real-time checkpoint events

---

## [1.6.0] - 2026-04-29

### Phase A: SOLO Unified AI Layer + Feedback Module

#### Backend
- **SOLO Bridge** - Unified AI call layer (MCP/REST/Pull modes)
- **Feedback Module** - Checkpoint system, 4 intervention modes, SOLO self-reflection
- **Execution Layer** - Executor + Orchestrator + Context + Concurrency + Observability
- **12 Step Types** - Full step handler registry
- **Database** - FeedbackCheckpoint/FeedbackRule/StepFeedback models

#### Frontend
- **Feedback Center** - Pending queue, approve/reject, stats
- **Workflow Management** - 5-tab navigation, 12 step types
- **Sidebar** - Updated navigation

#### tRPC Routes
- **feedback-router** - listCheckpoints, handleApproval, listRules, createRule, getStats
- **workflows-router** - Extended with 12 step types

---

## [1.5.0] - 2026-04-29

### Breaking Change
- **Single admin mode** - No login required, auto-create admin account

## [1.4.0] - 2026-04-29

### New Features
- **About page** - Project info display
- **HF Spaces persistence** - Database path migrated to /data

## [1.3.0] - 2026-04-28

### New Features
- **Agent Workflow Engine** - Full workflow orchestration
- **Web Push Notifications** - Basic push framework

## [1.2.0] - 2026-04-28

### New Features
- **Integration adapter data write** - GitHub/Feishu/Notion tasks to local DB

## [1.1.0] - 2026-04-28

### Security
- **tRPC API permissions** - 48 procedures secured
- **REST API authentication** - JWT on SSE/backup/export/webhook

## [1.0.0] - 2026-04-28

### Initial Release

AI-driven task management platform with MCP protocol and REST API support.
