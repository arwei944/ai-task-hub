// ============================================================
// Doc Service - 项目文档管理服务
// ============================================================

import type { ILogger, IEventBus } from '@/lib/core/types';

/**
 * 创建文档的数据
 */
export interface CreateDocDTO {
  projectId: string;
  title: string;
  content: string;
  docType?: string;
  parentDocId?: string;
  tags?: string[];
  linkedTaskIds?: string[];
  createdBy?: string;
}

/**
 * 更新文档的数据
 */
export interface UpdateDocDTO {
  title?: string;
  content?: string;
  docType?: string;
  status?: string;
  tags?: string[];
  linkedTaskIds?: string[];
  updatedBy?: string;
  changeLog?: string;
}

/**
 * 文档列表查询参数
 */
export interface DocListQuery {
  projectId: string;
  docType?: string;
  status?: string;
  parentDocId?: string | null;
}

/**
 * 文档搜索查询参数
 */
export interface DocSearchQuery {
  projectId?: string;
  queryText: string;
  docType?: string;
  tags?: string[];
  page?: number;
  pageSize?: number;
}

/**
 * 移动文档的数据
 */
export interface MoveDocDTO {
  parentDocId?: string | null;
  sortOrder?: number;
}

/**
 * 项目文档管理服务
 * 提供文档的增删改查、版本管理、搜索和移动功能
 */
export class DocService {
  constructor(
    private prisma: any,
    private eventBus: IEventBus,
    private logger: ILogger,
  ) {}

  /**
   * 获取文档列表
   * @param query - 查询参数
   * @returns 文档列表
   */
  async list(query: DocListQuery) {
    this.logger.info('[DocService] Listing documents', { query });

    const where: any = { projectId: query.projectId };
    if (query.docType) where.docType = query.docType;
    if (query.status) where.status = query.status;
    if (query.parentDocId !== undefined) where.parentDocId = query.parentDocId;
    else where.parentDocId = null; // 默认只返回根文档

    return this.prisma.projectDoc.findMany({
      where,
      include: {
        childDocs: true,
        versions: { orderBy: { version: 'desc' }, take: 1 },
      },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  /**
   * 获取文档详情
   * @param id - 文档 ID
   * @returns 文档详情（含版本历史和子文档）
   */
  async get(id: string) {
    this.logger.info('[DocService] Getting document', { id });

    return this.prisma.projectDoc.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { version: 'desc' } },
        parentDoc: true,
        childDocs: { orderBy: { sortOrder: 'asc' } },
      },
    });
  }

  /**
   * 创建文档
   * @param data - 创建数据
   * @returns 新创建的文档
   */
  async create(data: CreateDocDTO) {
    this.logger.info('[DocService] Creating document', {
      title: data.title,
      projectId: data.projectId,
    });

    // 获取同级文档的最大 sortOrder
    const where: any = { projectId: data.projectId, parentDocId: data.parentDocId || null };
    const maxSort = await this.prisma.projectDoc.findFirst({
      where,
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    });
    const sortOrder = (maxSort?.sortOrder ?? -1) + 1;

    const doc = await this.prisma.projectDoc.create({
      data: {
        ...data,
        sortOrder,
        tags: data.tags ? JSON.stringify(data.tags) : null,
        linkedTaskIds: data.linkedTaskIds ? JSON.stringify(data.linkedTaskIds) : null,
      },
    });

    // 创建初始版本
    await this.prisma.projectDocVersion.create({
      data: {
        docId: doc.id,
        title: doc.title,
        content: doc.content,
        version: 1,
        changeLog: '初始版本',
        createdBy: data.createdBy,
      },
    });

    this.eventBus.emit({
      type: 'project.doc.created',
      payload: {
        projectId: data.projectId,
        docId: doc.id,
        title: doc.title,
        docType: data.docType || 'general',
      },
      timestamp: new Date(),
      source: 'project-hub',
    });

    this.logger.info('[DocService] Document created', {
      id: doc.id,
      projectId: data.projectId,
    });

    return doc;
  }

  /**
   * 更新文档
   * @param id - 文档 ID
   * @param data - 更新数据
   * @returns 更新后的文档
   */
  async update(id: string, data: UpdateDocDTO) {
    this.logger.info('[DocService] Updating document', { id });

    const existing = await this.prisma.projectDoc.findUnique({ where: { id } });
    if (!existing) {
      throw new Error(`Document not found: ${id}`);
    }

    const updateData: any = { ...data };
    if (data.tags) updateData.tags = JSON.stringify(data.tags);
    if (data.linkedTaskIds) updateData.linkedTaskIds = JSON.stringify(data.linkedTaskIds);

    // 内容变更时创建新版本
    if (data.content !== undefined && data.content !== existing.content) {
      const maxVersion = await this.prisma.projectDocVersion.findFirst({
        where: { docId: id },
        orderBy: { version: 'desc' },
        select: { version: true },
      });
      const newVersion = (maxVersion?.version ?? 0) + 1;
      await this.prisma.projectDocVersion.create({
        data: {
          docId: id,
          title: data.title || existing.title,
          content: data.content,
          version: newVersion,
          changeLog: data.changeLog || `更新至 v${newVersion}`,
          createdBy: data.updatedBy,
        },
      });
    }

    const doc = await this.prisma.projectDoc.update({ where: { id }, data: updateData });

    this.eventBus.emit({
      type: 'project.doc.updated',
      payload: {
        projectId: existing.projectId,
        docId: id,
        title: doc.title,
      },
      timestamp: new Date(),
      source: 'project-hub',
    });

    return doc;
  }

  /**
   * 删除文档
   * @param id - 文档 ID
   */
  async delete(id: string) {
    this.logger.info('[DocService] Deleting document', { id });

    const doc = await this.prisma.projectDoc.findUnique({ where: { id } });
    if (!doc) {
      throw new Error(`Document not found: ${id}`);
    }

    // 删除所有版本和子文档（级联）
    await this.prisma.projectDoc.delete({ where: { id } });

    this.logger.info('[DocService] Document deleted', { id, projectId: doc.projectId });
  }

  /**
   * 移动文档（更改父文档或排序）
   * @param id - 文档 ID
   * @param data - 移动数据
   * @returns 更新后的文档
   */
  async move(id: string, data: MoveDocDTO) {
    this.logger.info('[DocService] Moving document', { id, data });

    return this.prisma.projectDoc.update({ where: { id }, data });
  }

  /**
   * 搜索文档
   * @param query - 搜索查询参数
   * @returns 分页的搜索结果
   */
  async search(query: DocSearchQuery) {
    this.logger.info('[DocService] Searching documents', { query });

    const { projectId, queryText, docType, tags, page = 1, pageSize = 20 } = query;
    const where: any = {};
    if (projectId) where.projectId = projectId;
    if (docType) where.docType = docType;
    if (queryText) {
      where.OR = [
        { title: { contains: queryText } },
        { content: { contains: queryText } },
      ];
    }
    if (tags && tags.length > 0) {
      // 简单标签匹配 - 检查 tags JSON 是否包含任一提供的标签
      for (const tag of tags) {
        where.tags = { ...where.tags, contains: tag };
      }
    }

    const [items, total] = await Promise.all([
      this.prisma.projectDoc.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      this.prisma.projectDoc.count({ where }),
    ]);

    return { items, total, page, pageSize, totalPages: Math.ceil(total / pageSize) };
  }

  /**
   * 获取文档版本历史
   * @param docId - 文档 ID
   * @returns 版本列表
   */
  async versions(docId: string) {
    this.logger.info('[DocService] Getting document versions', { docId });

    return this.prisma.projectDocVersion.findMany({
      where: { docId },
      orderBy: { version: 'desc' },
    });
  }

  /**
   * 恢复到指定版本
   * @param versionId - 版本 ID
   * @returns 更新后的文档
   */
  async restoreVersion(versionId: string) {
    this.logger.info('[DocService] Restoring document version', { versionId });

    const version = await this.prisma.projectDocVersion.findUnique({ where: { id: versionId } });
    if (!version) {
      throw new Error(`Version not found: ${versionId}`);
    }

    // 使用版本内容更新文档
    const doc = await this.prisma.projectDoc.update({
      where: { id: version.docId },
      data: { title: version.title, content: version.content },
    });

    // 创建新的版本记录标记恢复操作
    const maxVersion = await this.prisma.projectDocVersion.findFirst({
      where: { docId: version.docId },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const newVersion = (maxVersion?.version ?? 0) + 1;
    await this.prisma.projectDocVersion.create({
      data: {
        docId: version.docId,
        title: version.title,
        content: version.content,
        version: newVersion,
        changeLog: `从 v${version.version} 恢复`,
      },
    });

    this.logger.info('[DocService] Document version restored', {
      docId: version.docId,
      fromVersion: version.version,
      toVersion: newVersion,
    });

    return doc;
  }
}
