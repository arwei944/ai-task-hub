// ============================================================
// Template Service - 项目模板系统服务
// ============================================================

import type { ILogger, IEventBus } from '@/lib/core/types';

/**
 * 从模板创建项目的数据
 */
export interface CreateFromTemplateDTO {
  templateId: string;
  name: string;
  description?: string;
  creatorId?: string;
}

/**
 * 保存为模板的数据
 */
export interface SaveAsTemplateDTO {
  name: string;
  description?: string;
  category?: string;
  icon?: string;
  projectId: string;
  createdBy?: string;
}

/**
 * 更新模板的数据
 */
export interface UpdateTemplateDTO {
  name?: string;
  description?: string;
  category?: string;
  icon?: string;
  config?: any;
  tags?: string[];
}

/**
 * 模板列表查询参数
 */
export interface TemplateListQuery {
  category?: string;
  isBuiltIn?: boolean;
  isPublic?: boolean;
}

/**
 * 项目模板系统服务
 * 提供模板的增删改查、从模板创建项目、保存项目为模板等功能
 */
export class TemplateService {
  constructor(
    private prisma: any,
    private eventBus: IEventBus,
    private logger: ILogger,
  ) {}

  /**
   * 获取模板列表
   * @param query - 可选的筛选参数
   * @returns 模板列表
   */
  async list(query?: TemplateListQuery) {
    this.logger.info('[TemplateService] Listing templates', { query });

    const where: any = {};
    if (query?.category) where.category = query.category;
    if (query?.isBuiltIn !== undefined) where.isBuiltIn = query.isBuiltIn;
    if (query?.isPublic !== undefined) where.isPublic = query.isPublic;

    return this.prisma.projectTemplate.findMany({
      where,
      orderBy: [{ isBuiltIn: 'desc' }, { usageCount: 'desc' }],
    });
  }

  /**
   * 获取模板详情
   * @param id - 模板 ID
   * @returns 模板详情
   */
  async get(id: string) {
    this.logger.info('[TemplateService] Getting template', { id });

    return this.prisma.projectTemplate.findUnique({ where: { id } });
  }

  /**
   * 从模板创建项目
   * @param data - 创建数据，包含模板 ID 和项目名称
   * @returns 新创建的项目和模板名称
   */
  async createFromTemplate(data: CreateFromTemplateDTO) {
    this.logger.info('[TemplateService] Creating project from template', {
      templateId: data.templateId,
    });

    const template = await this.prisma.projectTemplate.findUnique({ where: { id: data.templateId } });
    if (!template) {
      throw new Error(`Template not found: ${data.templateId}`);
    }

    const config = JSON.parse(template.config);
    const project = await this.prisma.project.create({
      data: {
        name: data.name,
        description: data.description || config.project?.description || '',
        priority: 'medium',
        phase: config.project?.defaultPhase || 'requirements',
        techStack: config.project?.techStack ? JSON.stringify(config.project?.techStack) : null,
        creatorId: data.creatorId,
        creatorType: data.creatorId ? 'agent' : 'system',
        startedAt: new Date(),
      },
    });

    // 从模板创建里程碑
    if (config.milestones && Array.isArray(config.milestones)) {
      for (let i = 0; i < config.milestones.length; i++) {
        const m = config.milestones[i];
        const dueDate = m.daysOffset ? new Date(Date.now() + m.daysOffset * 86400000) : null;
        await this.prisma.projectMilestone.create({
          data: {
            projectId: project.id,
            title: m.title,
            description: m.description,
            dueDate,
            sortOrder: i,
          },
        });
      }
    }

    // 从模板创建文档
    if (config.documents && Array.isArray(config.documents)) {
      for (let i = 0; i < config.documents.length; i++) {
        const d = config.documents[i];
        const doc = await this.prisma.projectDoc.create({
          data: {
            projectId: project.id,
            title: d.title,
            content: d.content,
            docType: d.docType || 'general',
            sortOrder: i,
          },
        });
        await this.prisma.projectDocVersion.create({
          data: {
            docId: doc.id,
            title: doc.title,
            content: doc.content,
            version: 1,
            changeLog: '从模板创建',
          },
        });
      }
    }

    // 增加使用次数
    await this.prisma.projectTemplate.update({
      where: { id: data.templateId },
      data: { usageCount: { increment: 1 } },
    });

    this.eventBus.emit({
      type: 'project.template.used',
      payload: {
        templateId: data.templateId,
        projectId: project.id,
        templateName: template.name,
      },
      timestamp: new Date(),
      source: 'project-hub',
    });

    this.logger.info('[TemplateService] Project created from template', {
      projectId: project.id,
      templateId: data.templateId,
    });

    return { project, templateName: template.name };
  }

  /**
   * 将项目保存为模板
   * @param data - 保存数据，包含项目 ID 和模板名称
   * @returns 新创建的模板
   */
  async saveAsTemplate(data: SaveAsTemplateDTO) {
    this.logger.info('[TemplateService] Saving project as template', {
      projectId: data.projectId,
    });

    const project = await this.prisma.project.findUnique({ where: { id: data.projectId } });
    if (!project) {
      throw new Error(`Project not found: ${data.projectId}`);
    }

    // 收集项目数据用于模板配置
    const milestones = await this.prisma.projectMilestone.findMany({
      where: { projectId: data.projectId },
      orderBy: { sortOrder: 'asc' },
    });
    const docs = await this.prisma.projectDoc.findMany({
      where: { projectId: data.projectId, parentDocId: null },
      orderBy: { sortOrder: 'asc' },
      take: 10,
    });

    const config = {
      project: {
        nameTemplate: `${data.name} - {{date}}`,
        defaultPhase: project.phase,
        techStack: project.techStack ? JSON.parse(project.techStack) : undefined,
      },
      milestones: milestones.map((m: any) => ({
        title: m.title,
        description: m.description,
        daysOffset: m.dueDate
          ? Math.round((new Date(m.dueDate).getTime() - Date.now()) / 86400000)
          : undefined,
      })),
      documents: docs.map((d: any) => ({
        title: d.title,
        docType: d.docType,
        content: d.content,
      })),
    };

    const template = await this.prisma.projectTemplate.create({
      data: {
        name: data.name,
        description: data.description || project.description,
        category: data.category || 'custom',
        icon: data.icon,
        createdBy: data.createdBy,
        config: JSON.stringify(config),
      },
    });

    this.logger.info('[TemplateService] Template saved', {
      templateId: template.id,
      projectId: data.projectId,
    });

    return template;
  }

  /**
   * 更新模板
   * @param id - 模板 ID
   * @param data - 更新数据
   * @returns 更新后的模板
   */
  async update(id: string, data: UpdateTemplateDTO) {
    this.logger.info('[TemplateService] Updating template', { id, data });

    const updateData: any = { ...data };
    if (data.config) updateData.config = JSON.stringify(data.config);
    if (data.tags) updateData.tags = JSON.stringify(data.tags);

    return this.prisma.projectTemplate.update({ where: { id }, data: updateData });
  }

  /**
   * 删除模板
   * @param id - 模板 ID
   */
  async delete(id: string) {
    this.logger.info('[TemplateService] Deleting template', { id });

    return this.prisma.projectTemplate.delete({ where: { id } });
  }

  /**
   * 评价模板
   * @param id - 模板 ID
   * @param rating - 评分 (1-5)
   * @returns 更新后的模板
   */
  async rate(id: string, rating: number) {
    this.logger.info('[TemplateService] Rating template', { id, rating });

    if (rating < 1 || rating > 5) {
      throw new Error('Rating must be between 1 and 5');
    }

    return this.prisma.projectTemplate.update({ where: { id }, data: { rating } });
  }

  /**
   * 发布模板（设为公开）
   * @param id - 模板 ID
   * @returns 更新后的模板
   */
  async publish(id: string) {
    this.logger.info('[TemplateService] Publishing template', { id });

    return this.prisma.projectTemplate.update({ where: { id }, data: { isPublic: true } });
  }

  /**
   * 获取内置模板列表
   * @returns 内置模板列表
   */
  async getBuiltIn() {
    this.logger.info('[TemplateService] Getting built-in templates');

    return this.prisma.projectTemplate.findMany({
      where: { isBuiltIn: true },
      orderBy: { usageCount: 'desc' },
    });
  }

  /**
   * 初始化内置模板数据
   * 仅在不存在内置模板时执行
   */
  async seedBuiltInTemplates() {
    this.logger.info('[TemplateService] Checking built-in templates seed');

    const existing = await this.prisma.projectTemplate.count({ where: { isBuiltIn: true } });
    if (existing > 0) {
      this.logger.info('[TemplateService] Built-in templates already exist, skipping seed');
      return;
    }

    const templates = [
      {
        name: '软件开发项目',
        category: 'software_dev',
        icon: '🖥️',
        isBuiltIn: true,
        config: JSON.stringify({
          project: { nameTemplate: '新软件项目 - {{date}}', defaultPhase: 'requirements' },
          milestones: [
            { title: '需求评审', description: '完成需求文档评审', daysOffset: 14 },
            { title: '架构设计完成', description: '完成系统架构设计', daysOffset: 28 },
            { title: 'Alpha 版本', description: '首个可用版本', daysOffset: 56 },
            { title: 'Beta 版本', description: '公测版本', daysOffset: 77 },
            { title: '正式发布', description: '正式版本发布', daysOffset: 91 },
          ],
          documents: [
            { title: '需求文档', docType: 'requirement', content: '# 需求文档\n\n## 1. 项目背景\n\n## 2. 功能需求\n\n## 3. 非功能需求\n\n## 4. 验收标准' },
            { title: '架构设计文档', docType: 'design', content: '# 架构设计\n\n## 1. 系统架构\n\n## 2. 技术选型\n\n## 3. 数据模型\n\n## 4. API 设计' },
            { title: '会议纪要模板', docType: 'meeting_notes', content: '# 会议纪要\n\n**日期：** \n**参会智能体：** \n**议题：** \n\n## 讨论内容\n\n## 决议\n\n## 待办事项' },
          ],
        }),
      },
      {
        name: '移动应用开发',
        category: 'software_dev',
        icon: '📱',
        isBuiltIn: true,
        config: JSON.stringify({
          project: { nameTemplate: '移动应用 - {{date}}', defaultPhase: 'requirements' },
          milestones: [
            { title: '需求确认', daysOffset: 10 },
            { title: 'UI/UX 设计', daysOffset: 25 },
            { title: '核心功能开发', daysOffset: 50 },
            { title: '内测版本', daysOffset: 70 },
            { title: '应用商店上架', daysOffset: 84 },
          ],
          documents: [
            { title: '产品需求文档', docType: 'requirement', content: '# 产品需求文档\n\n## 1. 产品概述\n\n## 2. 用户画像\n\n## 3. 功能列表\n\n## 4. 交互流程' },
          ],
        }),
      },
      {
        name: '产品设计项目',
        category: 'product_design',
        icon: '🎨',
        isBuiltIn: true,
        config: JSON.stringify({
          project: { nameTemplate: '设计项目 - {{date}}', defaultPhase: 'requirements' },
          milestones: [
            { title: '设计调研', daysOffset: 7 },
            { title: '概念设计', daysOffset: 21 },
            { title: '设计评审', daysOffset: 35 },
            { title: '设计交付', daysOffset: 49 },
          ],
          documents: [
            { title: '设计需求文档', docType: 'requirement', content: '# 设计需求\n\n## 1. 设计目标\n\n## 2. 品牌规范\n\n## 3. 设计约束' },
          ],
        }),
      },
      {
        name: '市场营销活动',
        category: 'marketing',
        icon: '📈',
        isBuiltIn: true,
        config: JSON.stringify({
          project: { nameTemplate: '营销活动 - {{date}}', defaultPhase: 'planning' },
          milestones: [
            { title: '策略制定', daysOffset: 5 },
            { title: '内容制作', daysOffset: 15 },
            { title: '活动上线', daysOffset: 21 },
            { title: '效果评估', daysOffset: 35 },
          ],
          documents: [
            { title: '营销方案', docType: 'general', content: '# 营销方案\n\n## 1. 活动目标\n\n## 2. 目标受众\n\n## 3. 渠道策略\n\n## 4. 预算分配' },
          ],
        }),
      },
    ];

    for (const t of templates) {
      await this.prisma.projectTemplate.create({ data: t });
    }

    this.logger.info(`[TemplateService] Seeded ${templates.length} built-in templates`);
  }
}
