// ============================================================
// Knowledge Management MCP Tools
// ============================================================

export interface KnowledgeMcpTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
}

export const knowledgeMcpTools: KnowledgeMcpTool[] = [
  {
    name: 'create_knowledge_entry',
    description: '创建知识条目。支持经验教训、决策记录、模式识别、解决方案、模板等类型。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '关联项目 ID（可选）' },
        type: {
          type: 'string',
          enum: ['lesson_learned', 'decision', 'pattern', 'solution', 'template'],
          description: '知识类型',
        },
        title: { type: 'string', description: '知识条目标题' },
        content: { type: 'string', description: '知识条目内容' },
        tags: { type: 'array', items: { type: 'string' }, description: '标签列表' },
        sourceEvent: { type: 'string', description: '来源事件（如 project.completed）' },
        aiGenerated: { type: 'boolean', description: '是否由 AI 自动生成' },
        agentId: { type: 'string', description: '创建者 Agent ID' },
      },
      required: ['title', 'content'],
    },
  },
  {
    name: 'get_knowledge_entry',
    description: '获取知识条目详情。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '知识条目 ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'update_knowledge_entry',
    description: '更新知识条目（标题、内容、标签、类型）。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '知识条目 ID' },
        title: { type: 'string', description: '新标题' },
        content: { type: 'string', description: '新内容' },
        tags: { type: 'array', items: { type: 'string' }, description: '新标签列表' },
        type: { type: 'string', description: '新类型' },
      },
      required: ['id'],
    },
  },
  {
    name: 'delete_knowledge_entry',
    description: '删除知识条目。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '知识条目 ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'list_knowledge_entries',
    description: '列出知识条目，支持按项目、类型、标签、AI 生成状态筛选。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '按项目 ID 筛选' },
        type: {
          type: 'string',
          enum: ['lesson_learned', 'decision', 'pattern', 'solution', 'template'],
          description: '按类型筛选',
        },
        tags: { type: 'array', items: { type: 'string' }, description: '按标签筛选' },
        aiGenerated: { type: 'boolean', description: '按 AI 生成状态筛选' },
        search: { type: 'string', description: '搜索关键词（标题和内容）' },
        limit: { type: 'number', description: '返回数量限制' },
      },
    },
  },
  {
    name: 'search_knowledge',
    description: '全文搜索知识条目（搜索标题和内容）。',
    inputSchema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '搜索关键词' },
      },
      required: ['query'],
    },
  },
  {
    name: 'increment_usefulness',
    description: '增加知识条目的有用度计数。',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: '知识条目 ID' },
      },
      required: ['id'],
    },
  },
  {
    name: 'get_knowledge_stats',
    description: '获取知识库统计数据（按类型、AI 生成状态、标签等维度）。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '按项目 ID 统计（可选）' },
      },
    },
  },
  {
    name: 'extract_knowledge',
    description: '从已完成项目中自动提取知识条目（基于规则，不调用 AI API）。',
    inputSchema: {
      type: 'object',
      properties: {
        projectId: { type: 'string', description: '项目 ID' },
      },
      required: ['projectId'],
    },
  },
];
