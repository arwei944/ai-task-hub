// ============================================================
// Agent Prompt Templates
// ============================================================
//
// Structured prompt templates for AI agents using MCP tools.
// Each template provides guidance on how to handle a specific
// work scenario, including recommended tool calls, analysis
// points, best practices, and output format suggestions.
//
// These are NOT LLM API calls — they are pre-written guidance
// that the AI agent can use to structure its own behavior.
//

/**
 * A single step in a prompt template workflow
 */
export interface PromptTemplateStep {
  /** MCP tool name to call */
  tool: string;
  /** Parameters to pass (use <projectId> as placeholder) */
  params: Record<string, unknown>;
  /** What to analyze/look for in the result */
  analysis: string;
}

/**
 * A complete prompt template for a work scenario
 */
export interface PromptTemplate {
  /** Unique scenario identifier */
  id: string;
  /** Display name */
  name: string;
  /** Brief description */
  description: string;
  /** What the agent should achieve */
  objective: string;
  /** Ordered list of MCP tool calls and what to do with results */
  steps: PromptTemplateStep[];
  /** Best practices and common pitfalls */
  tips: string[];
  /** Suggested output format (Markdown) */
  outputFormat: string;
}

/**
 * All available prompt templates, keyed by scenario ID
 */
export const promptTemplates: Record<string, PromptTemplate> = {
  project_overview: {
    id: 'project_overview',
    name: '项目概览分析',
    description: '全面了解项目当前状态，识别风险和瓶颈',
    objective: '全面了解项目当前状态，识别风险和瓶颈，生成结构化的项目状态报告',
    steps: [
      {
        tool: 'get_project_context',
        params: { projectId: '<projectId>', includeRecentActivity: true },
        analysis: '分析返回的项目统计，关注任务完成率、各阶段进度、整体进度百分比',
      },
      {
        tool: 'list_requirements',
        params: { projectId: '<projectId>', status: 'draft' },
        analysis: '检查是否有未处理的需求，关注需求审核状态分布',
      },
      {
        tool: 'get_release_stats',
        params: { projectId: '<projectId>' },
        analysis: '了解发布进度和版本管理状态',
      },
      {
        tool: 'get_activity_log',
        params: { projectId: '<projectId>', limit: 20 },
        analysis: '回顾最近活动，识别活跃的 Agent 和关键变更',
      },
    ],
    tips: [
      '先获取项目上下文，再深入分析具体问题',
      '关注阻塞任务和过期需求',
      '结合阶段转换规则评估项目健康度',
      '如果测试通过率低于 80%，需要特别标注',
      '注意区分「进行中」和「已完成」的任务比例',
      '对于紧急优先级的待办任务，应在报告中突出显示',
    ],
    outputFormat: `## 项目状态报告

### 基本信息
- 项目名称：<name>
- 当前阶段：<phase>
- 整体进度：<progress>%
- 优先级：<priority>

### 任务进度
| 状态 | 数量 | 占比 |
|------|------|------|
| 待办 | X | X% |
| 进行中 | X | X% |
| 已完成 | X | X% |

### 需求状态
- 草稿：X 个
- 审核中：X 个
- 已批准：X 个
- 已实现：X 个

### 测试概况
- 总用例数：X
- 通过率：X%
- 失败用例：X 个

### 风险提示
- <risk1>
- <risk2>

### 最近活动
- <activity1>
- <activity2>

### 建议与下一步
1. <recommendation1>
2. <recommendation2>`,
  },

  task_analysis: {
    id: 'task_analysis',
    name: '任务深度分析',
    description: '深入分析单个任务的详情、依赖关系和风险',
    objective: '深入分析特定任务的完整状态，包括依赖关系、阻塞因素、历史变更，评估任务健康度',
    steps: [
      {
        tool: 'get_task_context',
        params: { taskId: '<taskId>' },
        analysis: '获取任务完整上下文，包括基本信息、子任务、依赖关系、历史记录',
      },
      {
        tool: 'get_task',
        params: { id: '<taskId>' },
        analysis: '获取任务最新状态和详细字段',
      },
      {
        tool: 'get_sub_tasks',
        params: { parentTaskId: '<taskId>' },
        analysis: '检查子任务完成情况，识别阻塞的子任务',
      },
      {
        tool: 'get_task_history',
        params: { taskId: '<taskId>' },
        analysis: '分析任务变更历史，识别反复变更或停滞的迹象',
      },
    ],
    tips: [
      '优先检查前置依赖是否已完成，未完成的依赖是常见阻塞原因',
      '关注任务的创建时间和当前进度，长时间低进度可能意味着遇到困难',
      '子任务的完成情况直接影响父任务，需逐一评估',
      '如果任务有过期风险，应在分析中明确标注',
      '注意任务关联的需求状态，需求变更可能影响任务方向',
    ],
    outputFormat: `## 任务分析报告

### 基本信息
- 任务标题：<title>
- 状态：<status>
- 优先级：<priority>
- 阶段：<phase>
- 进度：<progress>%
- 创建时间：<createdAt>
- 截止日期：<dueDate>

### 依赖关系
- 前置任务：<depends_on>（状态）
- 后续任务：<depended_by>（状态）

### 子任务进度
| 子任务 | 状态 | 进度 |
|--------|------|------|
| <sub1> | <status> | <progress>% |

### 变更历史
- <date>: <field> 从 <old> 变为 <new>

### 风险评估
- <risk1>
- <risk2>

### 建议
1. <recommendation1>
2. <recommendation2>`,
  },

  requirement_analysis: {
    id: 'requirement_analysis',
    name: '需求分析',
    description: '分析项目需求的完整状态和优先级',
    objective: '全面分析项目需求的状态分布、优先级排列和实现进度，识别需求管理中的问题',
    steps: [
      {
        tool: 'list_requirements',
        params: { projectId: '<projectId>' },
        analysis: '获取所有需求列表，分析状态分布和类型分布',
      },
      {
        tool: 'get_project_context',
        params: { projectId: '<projectId>', includeRequirements: true },
        analysis: '结合项目上下文理解需求的优先级和复杂度',
      },
      {
        tool: 'project_list_tasks',
        params: { projectId: '<projectId>', phase: 'requirements' },
        analysis: '检查需求阶段的任务，了解需求分析工作的进展',
      },
    ],
    tips: [
      '关注草稿状态的需求，这些可能需要审核推进',
      '被拒绝的需求需要了解原因，可能需要重新评估',
      '高复杂度的需求应优先拆解为子需求',
      '需求与任务的映射关系是关键，未映射的需求可能被遗漏',
      '注意需求的类型分布（功能/缺陷/改进），保持合理比例',
    ],
    outputFormat: `## 需求分析报告

### 需求概览
- 总需求数：X
- 按状态分布：<status_distribution>
- 按类型分布：<type_distribution>

### 待处理需求
| 需求 | 类型 | 优先级 | 复杂度 | 状态 |
|------|------|--------|--------|------|
| <req1> | <type> | <priority> | <complexity> | <status> |

### 需求覆盖分析
- 已实现：X 个（X%）
- 审核中：X 个
- 待审核：X 个

### 风险与建议
- <risk_or_suggestion>
- <risk_or_suggestion>`,
  },

  risk_assessment: {
    id: 'risk_assessment',
    name: '风险评估',
    description: '评估项目整体风险，识别潜在问题',
    objective: '系统评估项目各方面的风险因素，包括进度风险、质量风险、资源风险，提供风险缓解建议',
    steps: [
      {
        tool: 'get_project_context',
        params: { projectId: '<projectId>', includeTasks: true, includeRecentActivity: true },
        analysis: '获取完整项目上下文，重点关注风险提示字段',
      },
      {
        tool: 'project_list_tasks',
        params: { projectId: '<projectId>', status: ['in_progress'] },
        analysis: '检查所有进行中的任务，识别过期或停滞的任务',
      },
      {
        tool: 'list_requirements',
        params: { projectId: '<projectId>', status: 'reviewing' },
        analysis: '检查等待审核的需求，审核延迟可能导致进度风险',
      },
      {
        tool: 'get_activity_log',
        params: { projectId: '<projectId>', limit: 30 },
        analysis: '分析活动频率和模式，活动减少可能意味着项目停滞',
      },
    ],
    tips: [
      '过期任务是最高优先级风险，需要立即处理',
      '测试失败率是质量风险的重要指标',
      '需求审核积压会影响后续阶段的推进',
      '多个紧急任务同时存在说明资源可能不足',
      '活动日志的频率可以反映项目的活跃程度',
      '关注阶段停留时间，过长的阶段停留可能意味着遇到困难',
    ],
    outputFormat: `## 风险评估报告

### 风险概览
- 风险等级：<high/medium/low>
- 主要风险数量：X

### 进度风险
| 风险项 | 严重程度 | 影响范围 | 建议 |
|--------|----------|----------|------|
| <risk> | <severity> | <scope> | <action> |

### 质量风险
- <quality_risk1>
- <quality_risk2>

### 资源风险
- <resource_risk1>

### 风险趋势
- <trend_analysis>

### 缓解措施
1. <measure1>
2. <measure2>`,
  },

  release_checklist: {
    id: 'release_checklist',
    name: '发布检查清单',
    description: '准备发布前的完整检查流程',
    objective: '系统检查发布前的各项准备工作，确保代码质量、需求覆盖和文档完备',
    steps: [
      {
        tool: 'get_project_context',
        params: { projectId: '<projectId>', includeTasks: true },
        analysis: '检查项目整体状态，确认所有任务是否已完成',
      },
      {
        tool: 'project_list_tasks',
        params: { projectId: '<projectId>', status: ['in_progress', 'todo'] },
        analysis: '确认没有未完成的任务，所有计划功能已实现',
      },
      {
        tool: 'list_requirements',
        params: { projectId: '<projectId>' },
        analysis: '确认所有需求已实现并通过验证',
      },
      {
        tool: 'get_release_stats',
        params: { projectId: '<projectId>' },
        analysis: '检查发布统计信息，确认版本号和变更日志',
      },
    ],
    tips: [
      '发布前必须确认所有「进行中」和「待办」任务已处理',
      '测试通过率应达到 100% 才能发布',
      '检查是否有未关闭的严重缺陷',
      '确认版本号已正确更新',
      '发布后应立即记录活动日志',
      '建议在发布前创建一个发布任务来跟踪整个发布流程',
    ],
    outputFormat: `## 发布检查清单

### 发布信息
- 版本号：<version>
- 发布日期：<date>
- 项目阶段：<phase>

### 任务完成检查
- [ ] 所有计划任务已完成
- [ ] 没有进行中的任务
- [ ] 没有待办任务

### 质量检查
- [ ] 测试通过率 >= 100%
- [ ] 没有严重/高优先级缺陷
- [ ] 代码审查已完成

### 需求覆盖检查
- [ ] 所有需求已实现
- [ ] 所有需求已验证
- [ ] 需求与任务映射完整

### 文档检查
- [ ] 变更日志已更新
- [ ] 发布说明已准备

### 发布结果
- 状态：<ready/not_ready>
- 阻塞项：<blockers>`,
  },

  daily_standup: {
    id: 'daily_standup',
    name: '每日站会报告',
    description: '生成每日项目状态报告',
    objective: '快速汇总项目当日状态，包括进展、阻塞项和计划，便于团队同步',
    steps: [
      {
        tool: 'get_project_context',
        params: { projectId: '<projectId>', includeRecentActivity: true },
        analysis: '获取项目整体状态和最近活动',
      },
      {
        tool: 'project_list_tasks',
        params: { projectId: '<projectId>', status: ['in_progress'] },
        analysis: '列出当前正在进行的任务，了解今日工作重点',
      },
      {
        tool: 'get_activity_log',
        params: { projectId: '<projectId>', limit: 15 },
        analysis: '回顾最近活动，总结昨日完成的工作',
      },
      {
        tool: 'project_list_tasks',
        params: { projectId: '<projectId>', status: ['todo'], priority: ['urgent', 'high'] },
        analysis: '识别高优先级的待办任务，作为今日计划',
      },
    ],
    tips: [
      '站会报告应简洁明了，重点突出',
      '「昨日完成」部分只列关键成果，不要事无巨细',
      '阻塞项需要明确说明阻塞原因和需要的帮助',
      '今日计划应聚焦于可完成的任务，避免过度承诺',
      '如果有新的风险或问题，应在站会中提出',
    ],
    outputFormat: `## 每日站会报告

**日期**：<date>
**项目**：<project_name>

### 昨日完成
- <accomplishment1>
- <accomplishment2>

### 今日计划
- <plan1>
- <plan2>

### 进行中
| 任务 | 进度 | 优先级 |
|------|------|--------|
| <task> | <progress>% | <priority> |

### 阻塞项
- <blocker1>（原因：<reason>）

### 风险与关注
- <concern>`,
  },

  sprint_planning: {
    id: 'sprint_planning',
    name: '迭代规划',
    description: '规划下一个迭代/冲刺的工作内容',
    objective: '基于当前项目状态和待办需求，规划下一个迭代的工作范围、优先级和资源分配',
    steps: [
      {
        tool: 'get_project_context',
        params: { projectId: '<projectId>', includeTasks: true, includeRequirements: true },
        analysis: '全面了解项目当前状态，包括已完成和待完成的工作',
      },
      {
        tool: 'list_requirements',
        params: { projectId: '<projectId>', status: 'approved' },
        analysis: '获取已批准但未实现的需求，作为迭代候选',
      },
      {
        tool: 'project_list_tasks',
        params: { projectId: '<projectId>', status: ['todo'] },
        analysis: '列出所有待办任务，按优先级排序',
      },
      {
        tool: 'get_activity_log',
        params: { projectId: '<projectId>', limit: 30 },
        analysis: '分析历史活动，评估团队速率和产能',
      },
    ],
    tips: [
      '迭代范围应基于团队能力，不要过度承诺',
      '优先选择已批准的需求进入迭代',
      '高优先级和紧急任务应优先安排',
      '考虑任务之间的依赖关系，合理安排顺序',
      '为未知问题预留 20% 的缓冲时间',
      '每个任务应有明确的验收标准',
      '迭代结束后应有可演示的成果',
    ],
    outputFormat: `## 迭代规划报告

### 迭代信息
- 迭代名称：<sprint_name>
- 计划周期：<start_date> ~ <end_date>
- 项目阶段：<phase>

### 迭代目标
- <goal1>
- <goal2>

### 计划任务
| 任务 | 优先级 | 预估工时 | 依赖 |
|------|--------|----------|------|
| <task> | <priority> | <estimate> | <dependency> |

### 关联需求
| 需求 | 类型 | 优先级 | 复杂度 |
|------|------|--------|--------|
| <req> | <type> | <priority> | <complexity> |

### 产能评估
- 可用工时：<available_hours>
- 已分配工时：<allocated_hours>
- 缓冲比例：<buffer>%

### 风险与假设
- <risk_or_assumption>

### 验收标准
- [ ] <acceptance_criteria1>
- [ ] <acceptance_criteria2>`,
  },
};

/**
 * Get all scenario IDs
 */
export function getScenarioIds(): string[] {
  return Object.keys(promptTemplates);
}

/**
 * Get a specific prompt template by scenario ID
 */
export function getPromptTemplate(scenarioId: string): PromptTemplate | undefined {
  return promptTemplates[scenarioId];
}

/**
 * Get scenario descriptions for listing
 */
export function getScenarioDescriptions(): Array<{ id: string; name: string; description: string }> {
  return Object.values(promptTemplates).map(t => ({
    id: t.id,
    name: t.name,
    description: t.description,
  }));
}
