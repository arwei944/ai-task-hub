import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { TagRepository } from '@/lib/modules/task-core/tag.repository';
import { createTestPrisma, cleanupTestPrisma, cleanDatabase } from './helpers';

describe('TagRepository', () => {
  let prisma: any;
  let repo: TagRepository;

  beforeAll(async () => {
    prisma = await createTestPrisma();
  });

  afterAll(async () => {
    await cleanupTestPrisma(prisma);
  });

  beforeEach(async () => {
    await cleanDatabase(prisma);
    repo = new TagRepository(prisma);
  });

  // --- CRUD ---
  describe('CRUD', () => {
    it('should create a tag with default color', async () => {
      const tag = await repo.create({ name: 'bug' });
      expect(tag.id).toBeTruthy();
      expect(tag.name).toBe('bug');
      expect(tag.color).toBe('#6B7280');
    });

    it('should create a tag with custom color', async () => {
      const tag = await repo.create({ name: 'feature', color: '#FF0000' });
      expect(tag.color).toBe('#FF0000');
    });

    it('should find a tag by id', async () => {
      const created = await repo.create({ name: 'urgent' });
      const found = await repo.findById(created.id);
      expect(found).not.toBeNull();
      expect(found!.name).toBe('urgent');
    });

    it('should return null for non-existent id', async () => {
      const found = await repo.findById('nonexistent');
      expect(found).toBeNull();
    });

    it('should find a tag by name', async () => {
      await repo.create({ name: 'enhancement' });
      const found = await repo.findByName('enhancement');
      expect(found).not.toBeNull();
      expect(found!.name).toBe('enhancement');
    });

    it('should return null for non-existent name', async () => {
      const found = await repo.findByName('nonexistent');
      expect(found).toBeNull();
    });

    it('should update a tag', async () => {
      const created = await repo.create({ name: 'old-name' });
      const updated = await repo.update(created.id, { name: 'new-name', color: '#00FF00' });
      expect(updated.name).toBe('new-name');
      expect(updated.color).toBe('#00FF00');
    });

    it('should update only name', async () => {
      const created = await repo.create({ name: 'tag1', color: '#ABCDEF' });
      const updated = await repo.update(created.id, { name: 'tag2' });
      expect(updated.name).toBe('tag2');
      expect(updated.color).toBe('#ABCDEF');
    });

    it('should delete a tag', async () => {
      const created = await repo.create({ name: 'to-delete' });
      await repo.delete(created.id);
      const found = await repo.findById(created.id);
      expect(found).toBeNull();
    });
  });

  // --- findAll ---
  describe('findAll', () => {
    it('should return all tags ordered by name', async () => {
      await repo.create({ name: 'zebra' });
      await repo.create({ name: 'alpha' });
      await repo.create({ name: 'middle' });

      const tags = await repo.findAll();
      expect(tags).toHaveLength(3);
      expect(tags[0].name).toBe('alpha');
      expect(tags[1].name).toBe('middle');
      expect(tags[2].name).toBe('zebra');
    });

    it('should return empty array when no tags exist', async () => {
      const tags = await repo.findAll();
      expect(tags).toEqual([]);
    });
  });

  // --- 多对多关联 ---
  describe('many-to-many with tasks', () => {
    it('should include task count in findAll', async () => {
      const tag = await repo.create({ name: 'bug' });
      const taskId = `task-${Date.now()}`;
      await prisma.task.create({ data: { id: taskId, title: 'Bug Task' } });
      await prisma.taskTag.create({ data: { taskId, tagId: tag.id } });

      const tags = await repo.findAll();
      const bugTag = tags.find((t: any) => t.name === 'bug');
      expect(bugTag).toBeDefined();
      expect((bugTag as any)._count.tasks).toBe(1);
    });

    it('should show zero task count for unused tags', async () => {
      await repo.create({ name: 'unused' });
      const tags = await repo.findAll();
      const unusedTag = tags.find((t: any) => t.name === 'unused');
      expect((unusedTag as any)._count.tasks).toBe(0);
    });
  });
});
