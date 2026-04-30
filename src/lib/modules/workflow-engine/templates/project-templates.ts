import type { WorkflowStep } from '../types';

/** 项目阶段类型 */
export type ProjectPhase = 'requirements' | 'planning' | 'architecture' | 'implementation' | 'testing' | 'deployment';

/** 工作流模板定义 */
export interface WorkflowTemplate {
  name: string;
  description: string;
  phase: ProjectPhase;
  steps: WorkflowStep[];
}

/**
 * 项目工作流模板
 * 为每个项目阶段提供预定义的工作流模板
 */
export const projectWorkflowTemplates: Record<ProjectPhase, WorkflowTemplate> = {
  requirements: {
    name: '需求分析工作流',
    description: '收集和分析项目需求，生成需求文档和任务清单',
    phase: 'requirements',
    steps: [
      {
        id: 'req-gather',
        name: '收集需求信息',
        type: 'ai-analyze',
        config: {
          prompt: '分析用户提供的需求描述，提取关键功能点和约束条件',
          outputKey: 'requirementsAnalysis',
        },
      },
      {
        id: 'req-categorize',
        name: '需求分类整理',
        type: 'transform',
        config: {
          operation: 'map',
          source: '{{requirementsAnalysis}}',
          fields: {
            feature: 'name',
            priority: 'priority',
            description: 'description',
          },
        },
      },
      {
        id: 'req-create-tasks',
        name: '创建需求任务',
        type: 'create-task',
        config: {
          task: {
            title: '需求分析 - {{requirementsAnalysis.summary}}',
            description: '{{requirementsAnalysis.details}}',
            priority: 'high',
            type: 'requirement',
          },
        },
      },
      {
        id: 'req-notify',
        name: '通知相关人员',
        type: 'send-notification',
        config: {
          channel: 'in-app',
          message: '需求分析工作流已完成，请查看生成的需求任务',
        },
      },
    ],
  },

  planning: {
    name: '项目规划工作流',
    description: '制定项目计划，分解任务并分配资源',
    phase: 'planning',
    steps: [
      {
        id: 'plan-analyze',
        name: '分析需求生成计划',
        type: 'ai-analyze',
        config: {
          prompt: '基于需求分析结果，制定项目实施计划，包括里程碑和任务分解',
          outputKey: 'projectPlan',
        },
      },
      {
        id: 'plan-create-milestones',
        name: '创建里程碑任务',
        type: 'create-task',
        config: {
          task: {
            title: '里程碑 - {{projectPlan.milestone}}',
            description: '{{projectPlan.milestoneDescription}}',
            priority: 'high',
            type: 'milestone',
          },
        },
      },
      {
        id: 'plan-estimate',
        name: '工时估算',
        type: 'transform',
        config: {
          operation: 'reduce',
          source: '{{projectPlan.tasks}}',
          reduceOp: 'sum',
          reduceField: 'estimatedHours',
        },
      },
      {
        id: 'plan-notify',
        name: '通知团队',
        type: 'send-notification',
        config: {
          channel: 'in-app',
          message: '项目规划已完成，总预估工时: {{result}} 小时',
        },
      },
    ],
  },

  architecture: {
    name: '架构设计工作流',
    description: '进行架构评审，生成技术方案',
    phase: 'architecture',
    steps: [
      {
        id: 'arch-review',
        name: '架构评审分析',
        type: 'ai-analyze',
        config: {
          prompt: '分析项目需求和技术约束，提供架构设计建议',
          outputKey: 'architectureReview',
        },
      },
      {
        id: 'arch-create-doc',
        name: '创建架构文档任务',
        type: 'create-task',
        config: {
          task: {
            title: '架构设计文档 - {{architectureReview.title}}',
            description: '{{architectureReview.recommendation}}',
            priority: 'high',
            type: 'documentation',
          },
        },
      },
      {
        id: 'arch-approval',
        name: '架构方案审批',
        type: 'approval',
        config: {
          message: '请审批架构设计方案',
          approvers: ['tech-lead'],
        },
      },
      {
        id: 'arch-notify',
        name: '通知审批结果',
        type: 'send-notification',
        config: {
          channel: 'in-app',
          message: '架构设计方案已提交审批',
        },
      },
    ],
  },

  implementation: {
    name: '编码实现工作流',
    description: '管理开发流程，跟踪编码进度',
    phase: 'implementation',
    steps: [
      {
        id: 'impl-assign',
        name: '分配开发任务',
        type: 'ai-analyze',
        config: {
          prompt: '根据项目计划和团队成员技能，分配开发任务',
          outputKey: 'taskAssignment',
        },
      },
      {
        id: 'impl-create-tasks',
        name: '创建开发任务',
        type: 'foreach',
        config: {
          items: '{{taskAssignment.tasks}}',
          stepTemplate: {
            type: 'create-task',
            config: {
              task: {
                title: '{{item.title}}',
                description: '{{item.description}}',
                priority: '{{item.priority}}',
                type: 'development',
                assignee: '{{item.assignee}}',
              },
            },
          },
        },
      },
      {
        id: 'impl-track',
        name: '跟踪开发进度',
        type: 'http-request',
        config: {
          url: '/api/tasks/status',
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
          },
        },
      },
      {
        id: 'impl-notify',
        name: '进度报告',
        type: 'send-notification',
        config: {
          channel: 'in-app',
          message: '编码实现工作流已启动，任务已分配',
        },
      },
    ],
  },

  testing: {
    name: '测试验证工作流',
    description: '执行测试流程，跟踪缺陷修复',
    phase: 'testing',
    steps: [
      {
        id: 'test-plan',
        name: '生成测试计划',
        type: 'ai-analyze',
        config: {
          prompt: '基于开发任务和需求，生成测试计划和测试用例',
          outputKey: 'testPlan',
        },
      },
      {
        id: 'test-create-tasks',
        name: '创建测试任务',
        type: 'create-task',
        config: {
          task: {
            title: '测试验证 - {{testPlan.title}}',
            description: '{{testPlan.testCases}}',
            priority: 'high',
            type: 'testing',
          },
        },
      },
      {
        id: 'test-run',
        name: '执行测试',
        type: 'http-request',
        config: {
          url: '/api/tests/run',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: '{"suite": "{{testPlan.suiteId}}"}',
        },
      },
      {
        id: 'test-report',
        name: '生成测试报告',
        type: 'transform',
        config: {
          operation: 'template',
          template: '测试完成: 共 {{testPlan.totalCases}} 个用例，通过率 {{testPlan.passRate}}%',
        },
      },
    ],
  },

  deployment: {
    name: '部署发布工作流',
    description: '管理部署流程，确保发布质量',
    phase: 'deployment',
    steps: [
      {
        id: 'deploy-check',
        name: '部署前检查',
        type: 'condition',
        config: {
          expression: '{{allTestsPassed}} == true',
          thenSteps: [
            {
              id: 'deploy-proceed',
              name: '准备部署',
              type: 'ai-analyze',
              config: {
                prompt: '检查部署前置条件，生成部署清单',
                outputKey: 'deployChecklist',
              },
            },
          ],
          elseSteps: [
            {
              id: 'deploy-block',
              name: '阻止部署',
              type: 'send-notification',
              config: {
                channel: 'in-app',
                message: '部署被阻止：测试未全部通过',
              },
            },
          ],
        },
      },
      {
        id: 'deploy-execute',
        name: '执行部署',
        type: 'http-request',
        config: {
          url: '/api/deploy',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: '{"environment": "{{deployEnvironment}}", "version": "{{deployVersion}}"}',
          timeout: 120000,
        },
      },
      {
        id: 'deploy-verify',
        name: '部署验证',
        type: 'http-request',
        config: {
          url: '/api/health',
          method: 'GET',
          timeout: 10000,
        },
      },
      {
        id: 'deploy-notify',
        name: '通知部署结果',
        type: 'send-notification',
        config: {
          channel: 'in-app',
          message: '部署已完成，环境: {{deployEnvironment}}',
        },
      },
    ],
  },
};

/**
 * 根据项目阶段获取工作流模板
 */
export function getTemplateForPhase(phase: string): WorkflowTemplate | undefined {
  return projectWorkflowTemplates[phase as ProjectPhase];
}

/**
 * 获取所有工作流模板
 */
export function getAllTemplates(): WorkflowTemplate[] {
  return Object.values(projectWorkflowTemplates);
}

/**
 * 获取所有支持的项目阶段
 */
export function getSupportedPhases(): ProjectPhase[] {
  return Object.keys(projectWorkflowTemplates) as ProjectPhase[];
}
