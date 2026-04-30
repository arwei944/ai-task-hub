// ============================================================
// Full Lifecycle Integration Test - v2.0.0 Release
// Tests the complete project lifecycle flow end-to-end
// using mocked Prisma (in-memory store) and real EventBus.
// ============================================================

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventBus } from '@/lib/core/event-bus';
import { Logger } from '@/lib/core/logger';
import { LifecycleService } from '@/lib/modules/lifecycle/lifecycle.service';
import { RequirementsService } from '@/lib/modules/requirements/requirements.service';
import { TestManagementService } from '@/lib/modules/test-management/test-management.service';
import { KnowledgeService } from '@/lib/modules/knowledge/knowledge.service';
import type { DomainEvent } from '@/lib/core/types';

// Mock @/lib/db for VersionMgmtService (it calls getPrisma() directly)
vi.mock('@/lib/db', () => ({
  getPrisma: vi.fn(),
}));

// ============================================================
// In-Memory Prisma Mock
// ============================================================

function createId(): string {
  return Math.random().toString(36).slice(2, 15) + Date.now().toString(36).slice(-8);
}

interface StoreRecord {
  [key: string]: any;
}

class InMemoryStore {
  private data: Map<string, StoreRecord[]> = new Map();

  private getTable(table: string): StoreRecord[] {
    if (!this.data.has(table)) {
      this.data.set(table, []);
    }
    return this.data.get(table)!;
  }

  create(table: string, record: StoreRecord): StoreRecord {
    const records = this.getTable(table);
    if (!record.id) record.id = createId();
    if (!record.createdAt) record.createdAt = new Date();
    if (!record.updatedAt) record.updatedAt = new Date();
    records.push({ ...record });
    return { ...record };
  }

  findUnique(table: string, where: Record<string, any>): StoreRecord | null {
    const records = this.getTable(table);
    for (const r of records) {
      if (this.matchesWhere(r, where)) {
        return { ...r };
      }
    }
    return null;
  }

  findFirst(table: string, where: Record<string, any>, orderBy?: Record<string, string>): StoreRecord | null {
    const records = this.getTable(table);
    let filtered = records.filter((r) => this.matchesWhere(r, where));
    if (orderBy) {
      const [key, dir] = Object.entries(orderBy)[0];
      filtered.sort((a, b) => {
        if (dir === 'desc') return (b[key] > a[key] ? 1 : -1);
        return (a[key] > b[key] ? 1 : -1);
      });
    }
    return filtered[0] ? { ...filtered[0] } : null;
  }

  findMany(table: string, where?: Record<string, any>, orderBy?: Record<string, string>, take?: number, skip?: number): StoreRecord[] {
    let records = this.getTable(table);
    if (where) {
      records = records.filter((r) => this.matchesWhere(r, where));
    }
    if (orderBy) {
      const [key, dir] = Object.entries(orderBy)[0];
      records = [...records].sort((a, b) => {
        if (dir === 'desc') return (b[key] > a[key] ? 1 : -1);
        return (a[key] > b[key] ? 1 : -1);
      });
    }
    if (skip) records = records.slice(skip);
    if (take) records = records.slice(0, take);
    return records.map((r) => ({ ...r }));
  }

  update(table: string, where: Record<string, any>, data: Record<string, any>): StoreRecord | null {
    const records = this.getTable(table);
    for (let i = 0; i < records.length; i++) {
      if (this.matchesWhere(records[i], where)) {
        records[i] = { ...records[i], ...data, updatedAt: new Date() };
        return { ...records[i] };
      }
    }
    return null;
  }

  updateMany(table: string, where: Record<string, any>, data: Record<string, any>): { count: number } {
    const records = this.getTable(table);
    let count = 0;
    for (let i = 0; i < records.length; i++) {
      if (this.matchesWhere(records[i], where)) {
        records[i] = { ...records[i], ...data, updatedAt: new Date() };
        count++;
      }
    }
    return { count };
  }

  delete(table: string, where: Record<string, any>): boolean {
    const records = this.getTable(table);
    const idx = records.findIndex((r) => this.matchesWhere(r, where));
    if (idx >= 0) {
      records.splice(idx, 1);
      return true;
    }
    return false;
  }

  count(table: string, where?: Record<string, any>): number {
    if (!where) return this.getTable(table).length;
    return this.findMany(table, where).length;
  }

  groupBy(table: string, by: string, where?: Record<string, any>): { [key: string]: number }[] {
    const records = this.findMany(table, where);
    const groups: Record<string, number> = {};
    for (const r of records) {
      const val = r[by] as string;
      groups[val] = (groups[val] || 0) + 1;
    }
    return Object.entries(groups).map(([key, count]) => ({ [by]: key, _count: { id: count } }));
  }

  private matchesWhere(record: StoreRecord, where: Record<string, any>): boolean {
    return Object.entries(where).every(([key, value]) => {
      if (value === undefined || value === null) return true;
      if (typeof value === 'object' && !Array.isArray(value)) {
        if ('in' in value) {
          return (value.in as any[]).includes(record[key]);
        }
        if ('contains' in value) {
          return typeof record[key] === 'string' && record[key].includes(value.contains);
        }
        if (key.includes('_')) {
          return true;
        }
        return this.matchesWhere(record[key] || {}, value);
      }
      return record[key] === value;
    });
  }

  reset(): void {
    this.data.clear();
  }
}

// ============================================================
// Mock Prisma Client Factory
// ============================================================

function createMockPrisma(store: InMemoryStore) {
  const disconnect = vi.fn().mockResolvedValue(undefined);
  return {
    project: {
      create: (args: any) => store.create('project', args.data),
      findUnique: (args: any) => store.findUnique('project', args.where),
      findFirst: (args: any) => store.findFirst('project', args.where, args.orderBy),
      findMany: (args: any) => store.findMany('project', args.where, args.orderBy, args.take, args.skip),
      update: (args: any) => store.update('project', args.where, args.data),
      updateMany: (args: any) => store.updateMany('project', args.where, args.data),
      delete: (args: any) => store.delete('project', args.where),
      count: (args: any) => store.count('project', args.where),
    },
    task: {
      create: (args: any) => store.create('task', args.data),
      findUnique: (args: any) => store.findUnique('task', args.where),
      findFirst: (args: any) => store.findFirst('task', args.where, args.orderBy),
      findMany: (args: any) => store.findMany('task', args.where, args.orderBy, args.take, args.skip),
      update: (args: any) => store.update('task', args.where, args.data),
      updateMany: (args: any) => store.updateMany('task', args.where, args.data),
      delete: (args: any) => store.delete('task', args.where),
      count: (args: any) => store.count('task', args.where),
    },
    requirement: {
      create: (args: any) => store.create('requirement', args.data),
      findUnique: (args: any) => store.findUnique('requirement', args.where),
      findFirst: (args: any) => store.findFirst('requirement', args.where, args.orderBy),
      findMany: (args: any) => store.findMany('requirement', args.where, args.orderBy, args.take, args.skip),
      update: (args: any) => store.update('requirement', args.where, args.data),
      delete: (args: any) => store.delete('requirement', args.where),
      count: (args: any) => store.count('requirement', args.where),
    },
    requirementTag: {
      create: (args: any) => store.create('requirementTag', args.data),
      findUnique: (args: any) => store.findUnique('requirementTag', args.where),
      delete: (args: any) => store.delete('requirementTag', args.where),
    },
    phaseTransition: {
      create: (args: any) => store.create('phaseTransition', args.data),
      findUnique: (args: any) => store.findUnique('phaseTransition', args.where),
      findFirst: (args: any) => store.findFirst('phaseTransition', args.where, args.orderBy),
      findMany: (args: any) => store.findMany('phaseTransition', args.where, args.orderBy, args.take, args.skip),
      update: (args: any) => store.update('phaseTransition', args.where, args.data),
    },
    release: {
      create: (args: any) => store.create('release', args.data),
      findUnique: (args: any) => store.findUnique('release', args.where),
      findFirst: (args: any) => store.findFirst('release', args.where, args.orderBy),
      findMany: (args: any) => store.findMany('release', args.where, args.orderBy, args.take, args.skip),
      update: (args: any) => store.update('release', args.where, args.data),
      delete: (args: any) => store.delete('release', args.where),
      count: (args: any) => store.count('release', args.where),
    },
    releaseChangelog: {
      create: (args: any) => store.create('releaseChangelog', args.data),
      findFirst: (args: any) => store.findFirst('releaseChangelog', args.where, args.orderBy),
      findMany: (args: any) => store.findMany('releaseChangelog', args.where, args.orderBy),
    },
    releaseTag: {
      create: (args: any) => store.create('releaseTag', args.data),
    },
    releaseApproval: {
      create: (args: any) => store.create('releaseApproval', args.data),
      count: (args: any) => store.count('releaseApproval', args.where),
    },
    releaseMilestone: {
      create: (args: any) => store.create('releaseMilestone', args.data),
    },
    testCase: {
      create: (args: any) => store.create('testCase', args.data),
      findUnique: (args: any) => store.findUnique('testCase', args.where),
      findMany: (args: any) => store.findMany('testCase', args.where, args.orderBy, args.take, args.skip),
      update: (args: any) => store.update('testCase', args.where, args.data),
      delete: (args: any) => store.delete('testCase', args.where),
      count: (args: any) => store.count('testCase', args.where),
    },
    testExecution: {
      create: (args: any) => store.create('testExecution', args.data),
      findUnique: (args: any) => store.findUnique('testExecution', args.where),
      findMany: (args: any) => store.findMany('testExecution', args.where, args.orderBy, args.take, args.skip),
      count: (args: any) => store.count('testExecution', args.where),
    },
    testSuite: {
      create: (args: any) => store.create('testSuite', args.data),
      findUnique: (args: any) => store.findUnique('testSuite', args.where),
      findMany: (args: any) => store.findMany('testSuite', args.where, args.orderBy),
      update: (args: any) => store.update('testSuite', args.where, args.data),
    },
    knowledgeEntry: {
      create: (args: any) => store.create('knowledgeEntry', args.data),
      findUnique: (args: any) => store.findUnique('knowledgeEntry', args.where),
      findMany: (args: any) => store.findMany('knowledgeEntry', args.where, args.orderBy, args.take, args.skip),
      update: (args: any) => store.update('knowledgeEntry', args.where, args.data),
      count: (args: any) => store.count('knowledgeEntry', args.where),
    },
    activityLog: {
      create: (args: any) => store.create('activityLog', args.data),
      findMany: (args: any) => store.findMany('activityLog', args.where, args.orderBy, args.take, args.skip),
      count: (args: any) => store.count('activityLog', args.where),
    },
    eventStore: {
      create: (args: any) => store.create('eventStore', args.data),
      findMany: (args: any) => store.findMany('eventStore', args.where, args.orderBy, args.take, args.skip),
      count: (args: any) => store.count('eventStore', args.where),
    },
    $queryRaw: vi.fn().mockResolvedValue([1]),
    $disconnect: disconnect,
  };
}

// ============================================================
// Helper: advance phase with auto-approval
// ============================================================

async function advancePhase(
  lifecycleService: LifecycleService,
  projectId: string,
  targetPhase: string,
  triggeredBy: string = 'agent-001',
): Promise<void> {
  const result = await lifecycleService.requestTransition({
    projectId,
    targetPhase,
    triggeredBy,
  });

  // If approval is required, auto-approve
  if (result.success && result.requiresApproval && result.transitionId) {
    await lifecycleService.approveTransition(result.transitionId);
  }
}

// ============================================================
// Test Suite
// ============================================================

describe('Full Project Lifecycle Integration Test', () => {
  let store: InMemoryStore;
  let mockPrisma: ReturnType<typeof createMockPrisma>;
  let eventBus: EventBus;
  let logger: Logger;
  let emittedEvents: DomainEvent[];

  let lifecycleService: LifecycleService;
  let requirementsService: RequirementsService;
  let testManagementService: TestManagementService;
  let knowledgeService: KnowledgeService;

  beforeEach(() => {
    store = new InMemoryStore();
    mockPrisma = createMockPrisma(store);
    eventBus = new EventBus();
    logger = new Logger('test');
    emittedEvents = [];

    eventBus.on('*', (event) => {
      emittedEvents.push(event);
    });

    lifecycleService = new LifecycleService(
      logger,
      eventBus,
      () => mockPrisma as any,
    );

    requirementsService = new RequirementsService(
      logger,
      eventBus,
      () => mockPrisma as any,
    );

    testManagementService = new TestManagementService(
      logger,
      eventBus,
      () => mockPrisma as any,
    );

    knowledgeService = new KnowledgeService(
      logger,
      eventBus,
      () => mockPrisma as any,
    );
  });

  // ============================================================
  // Step 1: Create a Project
  // ============================================================

  it('Step 1: Create a project', () => {
    const project = store.create('project', {
      id: 'proj-001',
      name: 'AI Task Hub v2.0',
      description: 'Next generation AI task management platform',
      status: 'active',
      phase: 'requirements',
      priority: 'high',
      techStack: JSON.stringify(['Next.js', 'Prisma', 'tRPC']),
      creatorId: 'agent-001',
      creatorType: 'agent',
    });

    expect(project.id).toBe('proj-001');
    expect(project.name).toBe('AI Task Hub v2.0');
    expect(project.phase).toBe('requirements');
    expect(store.count('project')).toBe(1);
  });

  // ============================================================
  // Step 2: Create Requirements
  // ============================================================

  it('Step 2: Create requirements for the project', async () => {
    store.create('project', {
      id: 'proj-001',
      name: 'AI Task Hub v2.0',
      phase: 'requirements',
      status: 'active',
    });

    const req1 = await requirementsService.createRequirement({
      projectId: 'proj-001',
      title: 'User authentication system',
      description: 'Implement JWT-based auth with role management',
      type: 'feature',
      priority: 5,
      complexity: 'high',
      tags: ['security', 'backend'],
    });

    const req2 = await requirementsService.createRequirement({
      projectId: 'proj-001',
      title: 'Dashboard analytics',
      description: 'Real-time dashboard with task statistics',
      type: 'feature',
      priority: 3,
      complexity: 'medium',
      tags: ['frontend', 'analytics'],
    });

    const req3 = await requirementsService.createRequirement({
      projectId: 'proj-001',
      title: 'API rate limiting',
      description: 'Protect API endpoints from abuse',
      type: 'feature',
      priority: 4,
      tags: ['security'],
    });

    expect(req1).toBeDefined();
    expect(req2).toBeDefined();
    expect(req3).toBeDefined();
    expect(store.count('requirement')).toBe(3);

    const reqEvents = emittedEvents.filter((e) => e.type === 'requirement.created');
    expect(reqEvents.length).toBe(3);
  });

  // ============================================================
  // Step 3: Map Requirements to Tasks
  // ============================================================

  it('Step 3: Map requirements to tasks', async () => {
    store.create('project', {
      id: 'proj-001',
      name: 'AI Task Hub v2.0',
      phase: 'requirements',
      status: 'active',
    });

    store.create('requirement', {
      id: 'req-001',
      projectId: 'proj-001',
      title: 'User authentication system',
      description: 'Implement JWT-based auth',
      type: 'feature',
      priority: 5,
      status: 'draft',
    });

    store.create('requirement', {
      id: 'req-002',
      projectId: 'proj-001',
      title: 'Dashboard analytics',
      description: 'Real-time dashboard',
      type: 'feature',
      priority: 3,
      status: 'draft',
    });

    const task1 = await requirementsService.mapToTask('req-001', {
      title: 'Implement JWT auth middleware',
      priority: 'high',
      assignee: 'developer-1',
    });

    const task2 = await requirementsService.mapToTask('req-002', {
      title: 'Build dashboard charts',
      priority: 'medium',
    });

    expect(task1).toBeDefined();
    expect(task1.title).toBe('Implement JWT auth middleware');
    expect(task1.source).toBe('requirement');
    expect(task2).toBeDefined();
    expect(store.count('task')).toBe(2);

    const updatedReq1 = store.findUnique('requirement', { id: 'req-001' });
    expect(updatedReq1?.status).toBe('implemented');

    const mapEvents = emittedEvents.filter((e) => e.type === 'requirement.mapped.to.task');
    expect(mapEvents.length).toBe(2);
  });

  // ============================================================
  // Step 4: Advance Project Phase (requirements -> planning)
  // ============================================================

  it('Step 4: Advance project phase from requirements to planning (with approval)', async () => {
    store.create('project', {
      id: 'proj-001',
      name: 'AI Task Hub v2.0',
      phase: 'requirements',
      status: 'active',
    });

    // requirements -> planning requires approval
    const result = await lifecycleService.requestTransition({
      projectId: 'proj-001',
      targetPhase: 'planning',
      reason: 'Requirements gathering complete',
      triggeredBy: 'agent-001',
    });

    expect(result.success).toBe(true);
    expect(result.requiresApproval).toBe(true);
    expect(result.transitionId).toBeDefined();

    // Approve the transition
    const approveResult = await lifecycleService.approveTransition(result.transitionId!);
    expect(approveResult.success).toBe(true);
    expect(approveResult.newPhase).toBe('planning');

    // Verify project phase was updated
    const project = store.findUnique('project', { id: 'proj-001' });
    expect(project?.phase).toBe('planning');

    // Verify event was emitted after approval
    const phaseEvents = emittedEvents.filter((e) => e.type === 'project.phase.changed');
    expect(phaseEvents.length).toBe(1);
    expect((phaseEvents[0].payload as any).previousPhase).toBe('requirements');
    expect((phaseEvents[0].payload as any).newPhase).toBe('planning');
  });

  // ============================================================
  // Step 5: Create Test Cases from Requirements
  // ============================================================

  it('Step 5: Create test cases from requirements', async () => {
    store.create('project', {
      id: 'proj-001',
      name: 'AI Task Hub v2.0',
      phase: 'testing',
      status: 'active',
    });

    store.create('requirement', {
      id: 'req-001',
      projectId: 'proj-001',
      title: 'User authentication',
      status: 'approved',
    });

    store.create('task', {
      id: 'task-001',
      projectId: 'proj-001',
      title: 'Implement login API',
      status: 'done',
    });

    const tc1 = await testManagementService.createTestCase({
      projectId: 'proj-001',
      title: 'Login with valid credentials',
      description: 'Verify user can log in with correct email/password',
      type: 'functional',
      priority: 'high',
      requirementId: 'req-001',
      taskId: 'task-001',
      expectedResult: 'User receives JWT token',
      steps: [
        { step: 'Navigate to login page', expected: 'Login form is displayed' },
        { step: 'Enter valid email and password', expected: 'Fields accept input' },
        { step: 'Click login button', expected: 'JWT token returned' },
      ],
    });

    const tc2 = await testManagementService.createTestCase({
      projectId: 'proj-001',
      title: 'Login with invalid password',
      description: 'Verify error message for wrong password',
      type: 'functional',
      priority: 'high',
      requirementId: 'req-001',
      expectedResult: '401 Unauthorized error',
    });

    expect(tc1).toBeDefined();
    expect(tc2).toBeDefined();
    expect(store.count('testCase')).toBe(2);

    const tcEvents = emittedEvents.filter((e) => e.type === 'test_case.created');
    expect(tcEvents.length).toBe(2);
  });

  // ============================================================
  // Step 6: Advance Project Phase Through All Stages
  // ============================================================

  it('Step 6: Advance project phase through all stages (with approval)', async () => {
    store.create('project', {
      id: 'proj-001',
      name: 'AI Task Hub v2.0',
      phase: 'requirements',
      status: 'active',
    });

    const phases = [
      { from: 'requirements', to: 'planning' },
      { from: 'planning', to: 'architecture' },
      { from: 'architecture', to: 'implementation' },
      { from: 'implementation', to: 'testing' },
      { from: 'testing', to: 'deployment' },
      { from: 'deployment', to: 'completed' },
    ];

    for (const { from, to } of phases) {
      await advancePhase(lifecycleService, 'proj-001', to, 'agent-001');

      const project = store.findUnique('project', { id: 'proj-001' });
      expect(project?.phase).toBe(to);
    }

    // Verify all phase change events
    const phaseEvents = emittedEvents.filter((e) => e.type === 'project.phase.changed');
    expect(phaseEvents.length).toBe(6);

    // Verify correct order
    const eventPhases = phaseEvents.map((e) => (e.payload as any).newPhase);
    expect(eventPhases).toEqual([
      'planning',
      'architecture',
      'implementation',
      'testing',
      'deployment',
      'completed',
    ]);
  });

  // ============================================================
  // Step 7: Create a Release
  // ============================================================

  it('Step 7: Create a release via direct store operations', async () => {
    store.create('project', {
      id: 'proj-001',
      name: 'AI Task Hub v2.0',
      phase: 'deployment',
      status: 'active',
    });

    const release = store.create('release', {
      id: 'release-001',
      projectId: 'proj-001',
      version: '1.0.0',
      previousVersion: null,
      title: 'v1.0.0 - Initial Release',
      description: 'First stable release',
      status: 'draft',
      channel: 'stable',
      type: 'major',
      releaseNotes: '# Initial Release\n\nAll core features implemented.',
      createdBy: 'agent-001',
    });

    store.create('releaseChangelog', {
      releaseId: 'release-001',
      category: 'added',
      title: 'User authentication system',
      description: 'JWT-based auth with role management',
      impact: 'major',
      order: 0,
    });
    store.create('releaseChangelog', {
      releaseId: 'release-001',
      category: 'added',
      title: 'Task management CRUD',
      description: 'Full task lifecycle management',
      impact: 'major',
      order: 1,
    });
    store.create('releaseChangelog', {
      releaseId: 'release-001',
      category: 'fixed',
      title: 'Login redirect loop',
      description: 'Fixed infinite redirect on login',
      impact: 'patch',
      order: 2,
    });

    store.create('releaseTag', {
      releaseId: 'release-001',
      name: 'breaking',
      color: '#EF4444',
    });
    store.create('releaseTag', {
      releaseId: 'release-001',
      name: 'feature',
      color: '#3B82F6',
    });

    eventBus.emit({
      type: 'release.created',
      payload: {
        releaseId: 'release-001',
        projectId: 'proj-001',
        version: '1.0.0',
        title: 'v1.0.0 - Initial Release',
        channel: 'stable',
        type: 'major',
        createdBy: 'agent-001',
      },
      timestamp: new Date(),
      source: 'version-mgmt',
    });

    expect(release).toBeDefined();
    expect(release.version).toBe('1.0.0');
    expect(release.status).toBe('draft');
    expect(store.count('releaseChangelog')).toBe(3);
    expect(store.count('releaseTag')).toBe(2);

    const releaseEvents = emittedEvents.filter((e) => e.type === 'release.created');
    expect(releaseEvents.length).toBe(1);
    expect((releaseEvents[0].payload as any).version).toBe('1.0.0');
  });

  // ============================================================
  // Step 8: Verify All Events in Correct Order
  // ============================================================

  it('Step 8: Verify all events emitted in correct order during full lifecycle', async () => {
    store.create('project', {
      id: 'proj-001',
      name: 'AI Task Hub v2.0',
      phase: 'requirements',
      status: 'active',
    });

    // Create requirements
    await requirementsService.createRequirement({
      projectId: 'proj-001',
      title: 'Auth system',
      description: 'JWT auth',
      type: 'feature',
      priority: 5,
    });

    // Map to task
    const req = store.findFirst('requirement', { projectId: 'proj-001' })!;
    await requirementsService.mapToTask(req.id, {
      title: 'Implement auth',
      priority: 'high',
    });

    // Advance phases (with auto-approval)
    const phaseTransitions = [
      'planning', 'architecture', 'implementation', 'testing', 'deployment', 'completed',
    ];
    for (const phase of phaseTransitions) {
      await advancePhase(lifecycleService, 'proj-001', phase, 'agent-001');
    }

    // Create release via direct store + eventBus
    store.create('release', {
      id: 'release-001',
      projectId: 'proj-001',
      version: '1.0.0',
      status: 'draft',
      channel: 'stable',
      type: 'major',
    });

    eventBus.emit({
      type: 'release.created',
      payload: { releaseId: 'release-001', projectId: 'proj-001', version: '1.0.0' },
      timestamp: new Date(),
      source: 'version-mgmt',
    });

    // Verify event sequence
    const eventTypes = emittedEvents.map((e) => e.type);

    // 1. requirement.created should come before requirement.mapped.to.task
    const reqCreatedIdx = eventTypes.indexOf('requirement.created');
    const reqMappedIdx = eventTypes.indexOf('requirement.mapped.to.task');
    expect(reqCreatedIdx).toBeGreaterThanOrEqual(0);
    expect(reqMappedIdx).toBeGreaterThan(reqCreatedIdx);

    // 2. project.phase.changed events should be in order
    const phaseChangeEvents = emittedEvents
      .map((e, i) => ({ type: e.type, payload: e.payload, index: i }))
      .filter((e) => e.type === 'project.phase.changed');

    expect(phaseChangeEvents.length).toBe(6);
    for (let i = 1; i < phaseChangeEvents.length; i++) {
      expect(phaseChangeEvents[i].index).toBeGreaterThan(phaseChangeEvents[i - 1].index);
    }

    // 3. release.created should come after all phase changes
    const releaseCreatedIdx = eventTypes.indexOf('release.created');
    const lastPhaseIdx = phaseChangeEvents[phaseChangeEvents.length - 1].index;
    expect(releaseCreatedIdx).toBeGreaterThan(lastPhaseIdx);

    // 4. Total event count sanity check
    expect(emittedEvents.length).toBeGreaterThanOrEqual(9);
  });

  // ============================================================
  // Step 9: Knowledge Entries
  // ============================================================

  it('Step 9: Verify knowledge entries can be created', async () => {
    store.create('project', {
      id: 'proj-001',
      name: 'AI Task Hub v2.0',
      phase: 'completed',
      status: 'active',
    });

    const entry1 = await knowledgeService.createEntry({
      projectId: 'proj-001',
      type: 'lesson_learned',
      title: 'JWT secret rotation is critical',
      content: 'Always rotate JWT secrets after a security incident. Use environment variables.',
      tags: ['security', 'deployment'],
      sourceEvent: 'release.published',
      createdBy: 'agent-001',
    });

    const entry2 = await knowledgeService.createEntry({
      projectId: 'proj-001',
      type: 'best_practice',
      title: 'Event-driven architecture patterns',
      content: 'Use EventBus for cross-module communication. Keep handlers isolated.',
      tags: ['architecture', 'event-bus'],
      aiGenerated: false,
    });

    expect(entry1).toBeDefined();
    expect(entry2).toBeDefined();
    expect(store.count('knowledgeEntry')).toBe(2);

    const knowledgeEvents = emittedEvents.filter((e) => e.type === 'knowledge.created');
    expect(knowledgeEvents.length).toBe(2);
  });

  // ============================================================
  // Full End-to-End Lifecycle in Single Test
  // ============================================================

  it('Full E2E: Complete project lifecycle from creation to release', async () => {
    // 1. Create project
    store.create('project', {
      id: 'proj-e2e',
      name: 'E2E Test Project',
      description: 'Full lifecycle test',
      phase: 'requirements',
      status: 'active',
      priority: 'high',
    });

    // 2. Create requirements
    const req1 = await requirementsService.createRequirement({
      projectId: 'proj-e2e',
      title: 'Core API endpoints',
      description: 'REST API for task management',
      type: 'feature',
      priority: 5,
      tags: ['backend'],
    });

    const req2 = await requirementsService.createRequirement({
      projectId: 'proj-e2e',
      title: 'Unit test coverage',
      description: 'Minimum 80% coverage',
      type: 'requirement',
      priority: 4,
      tags: ['testing'],
    });

    // 3. Map requirements to tasks
    await requirementsService.mapToTask(req1.id, {
      title: 'Implement CRUD endpoints',
      priority: 'high',
    });

    // 4. Advance through all phases (with auto-approval)
    await advancePhase(lifecycleService, 'proj-e2e', 'planning', 'system');
    await advancePhase(lifecycleService, 'proj-e2e', 'architecture', 'system');
    await advancePhase(lifecycleService, 'proj-e2e', 'implementation', 'system');
    await advancePhase(lifecycleService, 'proj-e2e', 'testing', 'system');

    // 5. Create test cases during testing phase
    const tc = await testManagementService.createTestCase({
      projectId: 'proj-e2e',
      title: 'API returns 200 for valid request',
      type: 'integration',
      priority: 'high',
      requirementId: req1.id,
      expectedResult: 'Status 200 with JSON response',
    });

    // 6. Advance to deployment and completed
    await advancePhase(lifecycleService, 'proj-e2e', 'deployment', 'system');
    await advancePhase(lifecycleService, 'proj-e2e', 'completed', 'system');

    // 7. Create release via direct store + eventBus
    store.create('release', {
      id: 'release-e2e',
      projectId: 'proj-e2e',
      version: '1.0.0',
      status: 'draft',
      channel: 'stable',
      type: 'major',
    });
    store.create('releaseChangelog', { releaseId: 'release-e2e', category: 'added', title: 'Core API', impact: 'major', order: 0 });
    store.create('releaseChangelog', { releaseId: 'release-e2e', category: 'added', title: 'Test suite', impact: 'minor', order: 1 });

    eventBus.emit({
      type: 'release.created',
      payload: { releaseId: 'release-e2e', projectId: 'proj-e2e', version: '1.0.0' },
      timestamp: new Date(),
      source: 'version-mgmt',
    });

    // 8. Create knowledge entry
    await knowledgeService.createEntry({
      projectId: 'proj-e2e',
      type: 'lesson_learned',
      title: 'E2E testing is essential',
      content: 'Full lifecycle tests catch integration issues early.',
      tags: ['testing', 'best-practice'],
    });

    // === Assertions ===

    // Project is completed
    const finalProject = store.findUnique('project', { id: 'proj-e2e' });
    expect(finalProject?.phase).toBe('completed');

    // All data was created
    expect(store.count('project')).toBe(1);
    expect(store.count('requirement')).toBe(2);
    expect(store.count('task')).toBe(1);
    expect(store.count('testCase')).toBe(1);
    expect(store.count('release')).toBe(1);
    expect(store.count('releaseChangelog')).toBe(2);
    expect(store.count('knowledgeEntry')).toBe(1);

    // All expected events were emitted
    const eventTypes = emittedEvents.map((e) => e.type);

    expect(eventTypes.filter((t) => t === 'requirement.created').length).toBe(2);
    expect(eventTypes.filter((t) => t === 'requirement.mapped.to.task').length).toBe(1);
    expect(eventTypes.filter((t) => t === 'project.phase.changed').length).toBe(6);
    expect(eventTypes.filter((t) => t === 'test_case.created').length).toBe(1);
    expect(eventTypes.filter((t) => t === 'release.created').length).toBe(1);
    expect(eventTypes.filter((t) => t === 'knowledge.created').length).toBe(1);

    // Total events: 2 + 1 + 6 + 1 + 1 + 1 = 12
    expect(emittedEvents.length).toBe(12);

    // Verify event ordering
    const reqCreatedIdx = eventTypes.indexOf('requirement.created');
    const reqMappedIdx = eventTypes.indexOf('requirement.mapped.to.task');
    const firstPhaseIdx = eventTypes.indexOf('project.phase.changed');
    expect(reqCreatedIdx).toBeLessThan(reqMappedIdx);
    expect(reqMappedIdx).toBeLessThan(firstPhaseIdx);

    const releaseIdx = eventTypes.indexOf('release.created');
    const lastPhaseIdx = eventTypes.lastIndexOf('project.phase.changed');
    expect(releaseIdx).toBeGreaterThan(lastPhaseIdx);

    const knowledgeIdx = eventTypes.indexOf('knowledge.created');
    expect(knowledgeIdx).toBeGreaterThan(releaseIdx);
  });

  // ============================================================
  // EventBus Integration Verification
  // ============================================================

  it('EventBus: Wildcard listener captures all events', async () => {
    store.create('project', {
      id: 'proj-001',
      phase: 'requirements',
      status: 'active',
    });

    await requirementsService.createRequirement({
      projectId: 'proj-001',
      title: 'Test requirement',
      description: 'Test',
    });

    // Use advancePhase (with auto-approval) so event is emitted
    await advancePhase(lifecycleService, 'proj-001', 'planning');

    await testManagementService.createTestCase({
      projectId: 'proj-001',
      title: 'Test case',
    });

    await knowledgeService.createEntry({
      projectId: 'proj-001',
      title: 'Knowledge',
      content: 'Test content',
    });

    expect(emittedEvents.length).toBeGreaterThanOrEqual(4);

    for (const event of emittedEvents) {
      expect(event.type).toBeTruthy();
      expect(event.timestamp).toBeInstanceOf(Date);
      expect(event.payload).toBeDefined();
    }

    const sources = emittedEvents.map((e) => e.source);
    expect(sources).toContain('requirements');
    expect(sources).toContain('lifecycle');
    expect(sources).toContain('test-management');
    expect(sources).toContain('knowledge');
  });

  it('EventBus: Specific event type listeners work correctly', async () => {
    const phaseEvents: DomainEvent[] = [];
    const unsub = eventBus.on('project.phase.changed', (event) => {
      phaseEvents.push(event);
    });

    store.create('project', {
      id: 'proj-001',
      phase: 'requirements',
      status: 'active',
    });

    // requirements->planning requires approval, so use advancePhase
    await advancePhase(lifecycleService, 'proj-001', 'planning');
    // planning->architecture requires approval
    await advancePhase(lifecycleService, 'proj-001', 'architecture');

    expect(phaseEvents.length).toBe(2);
    expect(phaseEvents[0].type).toBe('project.phase.changed');
    expect(phaseEvents[1].type).toBe('project.phase.changed');

    // Unsubscribe and verify no more events
    unsub();
    await advancePhase(lifecycleService, 'proj-001', 'implementation');

    expect(phaseEvents.length).toBe(2); // No new events after unsubscribe
  });
});
