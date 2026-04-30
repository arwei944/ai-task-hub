import type { McpToolConfig } from '@/lib/core/types';

export const workflowV3McpTools: McpToolConfig[] = [
  {
    name: 'list_workflow_step_types',
    description: '列出所有可用的工作流步骤类型（含 v3 新增的 sub-workflow 和 dynamic-step）',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_workflow_execution_status',
    description: '获取工作流执行状态，包含每个步骤的执行结果和上下文快照',
    inputSchema: {
      type: 'object',
      properties: {
        executionId: { type: 'string', description: '执行 ID' },
      },
      required: ['executionId'],
    },
  },
  {
    name: 'pause_workflow_execution',
    description: '暂停正在运行的工作流执行，保存当前进度（断点恢复）',
    inputSchema: {
      type: 'object',
      properties: {
        executionId: { type: 'string', description: '执行 ID' },
      },
      required: ['executionId'],
    },
  },
  {
    name: 'resume_workflow_execution',
    description: '恢复已暂停的工作流执行，从断点继续',
    inputSchema: {
      type: 'object',
      properties: {
        executionId: { type: 'string', description: '执行 ID' },
      },
      required: ['executionId'],
    },
  },
  {
    name: 'list_paused_executions',
    description: '列出所有暂停的工作流执行，可查看断点位置和保存时间',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'invoke_sub_workflow',
    description: '在父工作流中调用子工作流，支持输入/输出映射和上下文继承',
    inputSchema: {
      type: 'object',
      properties: {
        parentExecutionId: { type: 'string', description: '父执行 ID' },
        workflowId: { type: 'string', description: '子工作流 ID' },
        workflowName: { type: 'string', description: '子工作流名称（与 ID 二选一）' },
        inputMapping: { type: 'object', description: '输入映射 {childKey: parentKey}' },
        outputMapping: { type: 'object', description: '输出映射 {parentKey: childKey}' },
        inheritContext: { type: 'boolean', description: '继承父上下文 (默认 false)' },
      },
      required: ['workflowId'],
    },
  },
  {
    name: 'get_workflow_templates',
    description: '获取所有可用的工作流模板（项目阶段模板）',
    inputSchema: { type: 'object', properties: {} },
  },
];
