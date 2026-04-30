import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createPromptToolHandlers } from '@/lib/modules/mcp-server/tools/prompt-handlers';
import { promptMcpTools } from '@/lib/modules/mcp-server/tools/prompt-tools';
import {
  promptTemplates,
  getScenarioIds,
  getPromptTemplate,
  getScenarioDescriptions,
} from '@/lib/modules/mcp-server/tools/prompt-templates';
import type { ILogger } from '@/lib/core/types';

function createMockLogger(): ILogger {
  return {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    child: vi.fn(() => createMockLogger()),
  };
}

// ============================================================
// Template Data Tests
// ============================================================

describe('Prompt Template Data', () => {
  const expectedScenarios = [
    'project_overview',
    'task_analysis',
    'requirement_analysis',
    'risk_assessment',
    'release_checklist',
    'daily_standup',
    'sprint_planning',
  ];

  it('should define all 7 scenarios', () => {
    const ids = getScenarioIds();
    expect(ids).toHaveLength(7);
    for (const scenario of expectedScenarios) {
      expect(ids).toContain(scenario);
    }
  });

  it('each template should have required fields', () => {
    for (const [id, template] of Object.entries(promptTemplates)) {
      expect(template.id).toBe(id);
      expect(template.name).toBeTruthy();
      expect(template.description).toBeTruthy();
      expect(template.objective).toBeTruthy();
      expect(Array.isArray(template.steps)).toBe(true);
      expect(template.steps.length).toBeGreaterThan(0);
      expect(Array.isArray(template.tips)).toBe(true);
      expect(template.tips.length).toBeGreaterThan(0);
      expect(template.outputFormat).toBeTruthy();
    }
  });

  it('each step should have tool, params, and analysis', () => {
    for (const [id, template] of Object.entries(promptTemplates)) {
      for (let i = 0; i < template.steps.length; i++) {
        const step = template.steps[i];
        expect(step.tool, `Template ${id} step ${i} missing tool`).toBeTruthy();
        expect(step.params, `Template ${id} step ${i} missing params`).toBeDefined();
        expect(step.analysis, `Template ${id} step ${i} missing analysis`).toBeTruthy();
      }
    }
  });

  it('getPromptTemplate should return correct template', () => {
    const template = getPromptTemplate('project_overview');
    expect(template).toBeDefined();
    expect(template!.id).toBe('project_overview');
    expect(template!.name).toBe('项目概览分析');
  });

  it('getPromptTemplate should return undefined for unknown scenario', () => {
    const template = getPromptTemplate('nonexistent');
    expect(template).toBeUndefined();
  });

  it('getScenarioDescriptions should return correct structure', () => {
    const descriptions = getScenarioDescriptions();
    expect(descriptions).toHaveLength(7);
    for (const desc of descriptions) {
      expect(desc).toHaveProperty('id');
      expect(desc).toHaveProperty('name');
      expect(desc).toHaveProperty('description');
      expect(desc.id).toBeTruthy();
      expect(desc.name).toBeTruthy();
      expect(desc.description).toBeTruthy();
    }
  });
});

// ============================================================
// Tool Definition Tests
// ============================================================

describe('Prompt Tool Definitions', () => {
  it('should export 2 prompt tools', () => {
    expect(promptMcpTools).toHaveLength(2);
  });

  it('get_agent_prompt should have correct schema', () => {
    const tool = promptMcpTools.find(t => t.name === 'get_agent_prompt')!;
    expect(tool).toBeDefined();
    expect(tool.description).toContain('工作指引模板');

    const schema = tool.inputSchema as any;
    expect(schema.required).toContain('scenario');
    expect(schema.properties.scenario).toBeDefined();
    expect(schema.properties.scenario.enum).toBeDefined();
    expect(schema.properties.projectId).toBeDefined();
  });

  it('get_agent_prompt scenario enum should include all scenarios plus list_scenarios', () => {
    const tool = promptMcpTools.find(t => t.name === 'get_agent_prompt')!;
    const schema = tool.inputSchema as any;
    const enumValues = schema.properties.scenario.enum;
    expect(enumValues).toContain('project_overview');
    expect(enumValues).toContain('task_analysis');
    expect(enumValues).toContain('requirement_analysis');
    expect(enumValues).toContain('risk_assessment');
    expect(enumValues).toContain('release_checklist');
    expect(enumValues).toContain('daily_standup');
    expect(enumValues).toContain('sprint_planning');
    expect(enumValues).toContain('list_scenarios');
  });

  it('list_available_scenarios should have empty schema', () => {
    const tool = promptMcpTools.find(t => t.name === 'list_available_scenarios')!;
    expect(tool).toBeDefined();
    expect(tool.description).toContain('工作场景模板');

    const schema = tool.inputSchema as any;
    expect(schema.properties).toBeDefined();
  });
});

// ============================================================
// Handler Tests
// ============================================================

describe('get_agent_prompt handler', () => {
  let logger: ILogger;

  beforeEach(() => {
    logger = createMockLogger();
  });

  it('should return correct structure for project_overview', async () => {
    const handlers = createPromptToolHandlers(logger);
    const result = await handlers.get_agent_prompt({ scenario: 'project_overview' }) as any;

    expect(result.scenario).toBe('project_overview');
    expect(result.name).toBe('项目概览分析');
    expect(result.objective).toBeTruthy();
    expect(Array.isArray(result.steps)).toBe(true);
    expect(result.steps.length).toBeGreaterThan(0);
    expect(Array.isArray(result.tips)).toBe(true);
    expect(result.tips.length).toBeGreaterThan(0);
    expect(result.outputFormat).toBeTruthy();
    expect(result.outputFormat).toContain('项目状态报告');
  });

  it('should return correct structure for task_analysis', async () => {
    const handlers = createPromptToolHandlers(logger);
    const result = await handlers.get_agent_prompt({ scenario: 'task_analysis' }) as any;

    expect(result.scenario).toBe('task_analysis');
    expect(result.name).toBe('任务深度分析');
    expect(result.steps[0].tool).toBe('get_task_context');
  });

  it('should return correct structure for requirement_analysis', async () => {
    const handlers = createPromptToolHandlers(logger);
    const result = await handlers.get_agent_prompt({ scenario: 'requirement_analysis' }) as any;

    expect(result.scenario).toBe('requirement_analysis');
    expect(result.name).toBe('需求分析');
    expect(result.steps[0].tool).toBe('list_requirements');
  });

  it('should return correct structure for risk_assessment', async () => {
    const handlers = createPromptToolHandlers(logger);
    const result = await handlers.get_agent_prompt({ scenario: 'risk_assessment' }) as any;

    expect(result.scenario).toBe('risk_assessment');
    expect(result.name).toBe('风险评估');
    expect(result.steps[0].tool).toBe('get_project_context');
  });

  it('should return correct structure for release_checklist', async () => {
    const handlers = createPromptToolHandlers(logger);
    const result = await handlers.get_agent_prompt({ scenario: 'release_checklist' }) as any;

    expect(result.scenario).toBe('release_checklist');
    expect(result.name).toBe('发布检查清单');
    expect(result.outputFormat).toContain('发布检查清单');
  });

  it('should return correct structure for daily_standup', async () => {
    const handlers = createPromptToolHandlers(logger);
    const result = await handlers.get_agent_prompt({ scenario: 'daily_standup' }) as any;

    expect(result.scenario).toBe('daily_standup');
    expect(result.name).toBe('每日站会报告');
    expect(result.outputFormat).toContain('每日站会报告');
  });

  it('should return correct structure for sprint_planning', async () => {
    const handlers = createPromptToolHandlers(logger);
    const result = await handlers.get_agent_prompt({ scenario: 'sprint_planning' }) as any;

    expect(result.scenario).toBe('sprint_planning');
    expect(result.name).toBe('迭代规划');
    expect(result.outputFormat).toContain('迭代规划报告');
  });

  it('should handle list_scenarios scenario', async () => {
    const handlers = createPromptToolHandlers(logger);
    const result = await handlers.get_agent_prompt({ scenario: 'list_scenarios' }) as any;

    expect(result.scenarios).toBeDefined();
    expect(result.scenarios).toHaveLength(7);
    expect(result.message).toContain('7');
    for (const scenario of result.scenarios) {
      expect(scenario).toHaveProperty('id');
      expect(scenario).toHaveProperty('name');
      expect(scenario).toHaveProperty('description');
    }
  });

  it('should return error for unknown scenario', async () => {
    const handlers = createPromptToolHandlers(logger);
    const result = await handlers.get_agent_prompt({ scenario: 'unknown_scenario' }) as any;

    expect(result.error).toContain('未知场景');
    expect(result.availableScenarios).toBeDefined();
    expect(result.availableScenarios).toHaveLength(7);
    expect(result.message).toContain('可用场景');
  });

  it('should replace <projectId> placeholder when projectId is provided', async () => {
    const handlers = createPromptToolHandlers(logger);
    const result = await handlers.get_agent_prompt({
      scenario: 'project_overview',
      projectId: 'proj-123',
    }) as any;

    // Check that steps have the projectId replaced
    for (const step of result.steps) {
      for (const [, value] of Object.entries(step.params)) {
        expect(value).not.toBe('<projectId>');
      }
    }

    // At least one step should have the actual projectId
    const hasProjectId = result.steps.some((step: any) =>
      Object.values(step.params).includes('proj-123'),
    );
    expect(hasProjectId).toBe(true);
  });

  it('should not replace non-placeholder values', async () => {
    const handlers = createPromptToolHandlers(logger);
    const result = await handlers.get_agent_prompt({
      scenario: 'project_overview',
      projectId: 'proj-123',
    }) as any;

    // Steps that don't have <projectId> should keep their original values
    const stepWithStatus = result.steps.find((s: any) => s.params.status !== undefined);
    if (stepWithStatus) {
      expect(stepWithStatus.params.status).toBe('draft');
    }
  });

  it('should enrich with project context when getProjectContext is provided', async () => {
    const mockContext = {
      basicInfo: { name: 'Test Project', phase: 'implementation' },
      overallProgress: 50,
    };
    const handlers = createPromptToolHandlers(logger, async () => mockContext);
    const result = await handlers.get_agent_prompt({
      scenario: 'project_overview',
      projectId: 'proj-123',
    }) as any;

    expect(result.projectContext).toBeDefined();
    expect(result.projectContext.projectId).toBe('proj-123');
    expect(result.projectContext.basicInfo).toBeDefined();
    expect(result.projectContext.message).toContain('项目当前状态');
  });

  it('should handle getProjectContext error gracefully', async () => {
    const handlers = createPromptToolHandlers(logger, async () => {
      throw new Error('DB connection failed');
    });
    const result = await handlers.get_agent_prompt({
      scenario: 'project_overview',
      projectId: 'proj-123',
    }) as any;

    expect(result.projectContext).toBeDefined();
    expect(result.projectContext.projectId).toBe('proj-123');
    expect(result.projectContext.error).toContain('无法获取项目上下文');
  });

  it('should handle getProjectContext returning null', async () => {
    const handlers = createPromptToolHandlers(logger, async () => null);
    const result = await handlers.get_agent_prompt({
      scenario: 'project_overview',
      projectId: 'proj-123',
    }) as any;

    // projectContext should not be set when context is null
    expect(result.projectContext).toBeUndefined();
  });

  it('should not include projectContext when projectId is not provided', async () => {
    const handlers = createPromptToolHandlers(logger, async () => ({ name: 'Test' }));
    const result = await handlers.get_agent_prompt({
      scenario: 'project_overview',
    }) as any;

    expect(result.projectContext).toBeUndefined();
  });
});

// ============================================================
// list_available_scenarios Handler Tests
// ============================================================

describe('list_available_scenarios handler', () => {
  let logger: ILogger;

  beforeEach(() => {
    logger = createMockLogger();
  });

  it('should return all scenarios', async () => {
    const handlers = createPromptToolHandlers(logger);
    const result = await handlers.list_available_scenarios() as any;

    expect(result.scenarios).toBeDefined();
    expect(result.scenarios).toHaveLength(7);
    expect(result.total).toBe(7);
    expect(result.message).toContain('7');
  });

  it('each scenario should have id, name, and description', async () => {
    const handlers = createPromptToolHandlers(logger);
    const result = await handlers.list_available_scenarios() as any;

    for (const scenario of result.scenarios) {
      expect(scenario).toHaveProperty('id');
      expect(scenario).toHaveProperty('name');
      expect(scenario).toHaveProperty('description');
      expect(typeof scenario.id).toBe('string');
      expect(typeof scenario.name).toBe('string');
      expect(typeof scenario.description).toBe('string');
    }
  });

  it('should include all expected scenario IDs', async () => {
    const handlers = createPromptToolHandlers(logger);
    const result = await handlers.list_available_scenarios() as any;

    const ids = result.scenarios.map((s: any) => s.id);
    expect(ids).toContain('project_overview');
    expect(ids).toContain('task_analysis');
    expect(ids).toContain('requirement_analysis');
    expect(ids).toContain('risk_assessment');
    expect(ids).toContain('release_checklist');
    expect(ids).toContain('daily_standup');
    expect(ids).toContain('sprint_planning');
  });
});
