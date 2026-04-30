import { describe, it, expect } from 'vitest';
import {
  extractFromProjectCompletion,
  suggestRelatedKnowledge,
} from '@/lib/modules/knowledge/ai-extractor';

// ================================================================
// extractFromProjectCompletion
// ================================================================

describe('extractFromProjectCompletion', () => {
  it('should always generate a project completion summary', () => {
    const project = {
      id: 'proj-1',
      name: 'Test Project',
      description: 'A test project',
      phase: 'completed',
      techStack: '["Next.js", "Prisma"]',
      startedAt: new Date('2024-01-01'),
      completedAt: new Date('2024-01-15'),
      _count: { tasks: 5, phaseTransitions: 3 },
    };

    const entries = extractFromProjectCompletion(project);

    expect(entries.length).toBeGreaterThanOrEqual(1);
    const summary = entries.find(e => e.title === '项目完成总结');
    expect(summary).toBeDefined();
    expect(summary!.type).toBe('lesson_learned');
    expect(summary!.projectId).toBe('proj-1');
    expect(summary!.aiGenerated).toBe(true);
    expect(summary!.sourceEvent).toBe('project.completed');
    expect(summary!.content).toContain('Test Project');
    expect(summary!.content).toContain('14'); // 15 days duration
  });

  it('should generate large-scale management entry when task count >= 10', () => {
    const project = {
      id: 'proj-2',
      name: 'Big Project',
      description: null,
      phase: 'completed',
      techStack: null,
      startedAt: null,
      completedAt: null,
      _count: { tasks: 25, phaseTransitions: 4 },
    };

    const entries = extractFromProjectCompletion(project);

    const largeScale = entries.find(e => e.title === '大规模项目管理经验');
    expect(largeScale).toBeDefined();
    expect(largeScale!.type).toBe('pattern');
    expect(largeScale!.content).toContain('25');
  });

  it('should generate super-large scale entry when task count >= 50', () => {
    const project = {
      id: 'proj-3',
      name: 'Huge Project',
      description: null,
      phase: 'completed',
      techStack: null,
      startedAt: null,
      completedAt: null,
      _count: { tasks: 60, phaseTransitions: 6 },
    };

    const entries = extractFromProjectCompletion(project);

    const largeScale = entries.find(e => e.title === '大规模项目管理经验');
    expect(largeScale).toBeDefined();
    expect(largeScale!.content).toContain('非常大');
    expect(largeScale!.tags).toContain('超大规模');
  });

  it('should NOT generate large-scale entry when task count < 10', () => {
    const project = {
      id: 'proj-4',
      name: 'Small Project',
      description: null,
      phase: 'completed',
      techStack: null,
      startedAt: null,
      completedAt: null,
      _count: { tasks: 3, phaseTransitions: 1 },
    };

    const entries = extractFromProjectCompletion(project);

    const largeScale = entries.find(e => e.title === '大规模项目管理经验');
    expect(largeScale).toBeUndefined();
  });

  it('should generate phase management entry when transitions >= 2', () => {
    const project = {
      id: 'proj-5',
      name: 'Phase Project',
      description: null,
      phase: 'completed',
      techStack: null,
      startedAt: null,
      completedAt: null,
      _count: { tasks: 5, phaseTransitions: 4 },
    };

    const entries = extractFromProjectCompletion(project);

    const phaseEntry = entries.find(e => e.title === '阶段管理经验');
    expect(phaseEntry).toBeDefined();
    expect(phaseEntry!.type).toBe('lesson_learned');
    expect(phaseEntry!.content).toContain('4');
  });

  it('should generate frequent phase transition warning when transitions >= 5', () => {
    const project = {
      id: 'proj-6',
      name: 'Frequent Phase Project',
      description: null,
      phase: 'completed',
      techStack: null,
      startedAt: null,
      completedAt: null,
      _count: { tasks: 20, phaseTransitions: 7 },
    };

    const entries = extractFromProjectCompletion(project);

    const phaseEntry = entries.find(e => e.title === '阶段管理经验');
    expect(phaseEntry).toBeDefined();
    expect(phaseEntry!.content).toContain('频繁');
  });

  it('should NOT generate phase management entry when transitions < 2', () => {
    const project = {
      id: 'proj-7',
      name: 'Simple Project',
      description: null,
      phase: 'completed',
      techStack: null,
      startedAt: null,
      completedAt: null,
      _count: { tasks: 5, phaseTransitions: 1 },
    };

    const entries = extractFromProjectCompletion(project);

    const phaseEntry = entries.find(e => e.title === '阶段管理经验');
    expect(phaseEntry).toBeUndefined();
  });

  it('should generate all three entries for a complex project', () => {
    const project = {
      id: 'proj-8',
      name: 'Complex Project',
      description: 'A complex project with many tasks and phases',
      phase: 'completed',
      techStack: '["React", "Node.js", "PostgreSQL"]',
      startedAt: new Date('2024-01-01'),
      completedAt: new Date('2024-03-15'),
      _count: { tasks: 30, phaseTransitions: 6 },
    };

    const entries = extractFromProjectCompletion(project);

    expect(entries).toHaveLength(3);
    expect(entries.map(e => e.title)).toContain('项目完成总结');
    expect(entries.map(e => e.title)).toContain('大规模项目管理经验');
    expect(entries.map(e => e.title)).toContain('阶段管理经验');
  });

  it('should handle missing _count gracefully', () => {
    const project = {
      id: 'proj-9',
      name: 'Minimal Project',
      description: null,
      phase: 'completed',
    };

    const entries = extractFromProjectCompletion(project as any);

    expect(entries.length).toBeGreaterThanOrEqual(1);
    const summary = entries[0];
    expect(summary.content).toContain('任务总数: 0');
    expect(summary.content).toContain('阶段转换次数: 0');
  });

  it('should include project name in tags', () => {
    const project = {
      id: 'proj-10',
      name: 'My Special Project',
      description: null,
      phase: 'completed',
      _count: { tasks: 3, phaseTransitions: 1 },
    };

    const entries = extractFromProjectCompletion(project as any);
    const summary = entries[0];

    expect(summary.tags).toContain('项目总结');
    expect(summary.tags).toContain('My Special Project');
  });
});

// ================================================================
// suggestRelatedKnowledge
// ================================================================

describe('suggestRelatedKnowledge', () => {
  const allEntries = [
    { id: '1', type: 'lesson_learned', tags: JSON.stringify(['database', 'performance']), title: 'Database Optimization Tips' },
    { id: '2', type: 'lesson_learned', tags: JSON.stringify(['database', 'indexing']), title: 'Indexing Strategies' },
    { id: '3', type: 'decision', tags: JSON.stringify(['frontend', 'react']), title: 'React State Management Decision' },
    { id: '4', type: 'pattern', tags: JSON.stringify(['database', 'migration']), title: 'Database Migration Pattern' },
    { id: '5', type: 'lesson_learned', tags: JSON.stringify(['testing', 'unit-test']), title: 'Unit Testing Best Practices' },
  ];

  it('should find related entries by matching tags', () => {
    const current = { id: '1', type: 'lesson_learned', tags: JSON.stringify(['database', 'performance']), title: 'Database Optimization Tips' };

    const results = suggestRelatedKnowledge(current, allEntries);

    expect(results.length).toBeGreaterThan(0);
    // Entry 2 shares 'database' tag
    expect(results.some(r => r.entry.id === '2')).toBe(true);
    // Entry 4 shares 'database' tag
    expect(results.some(r => r.entry.id === '4')).toBe(true);
  });

  it('should not include the current entry', () => {
    const current = { id: '1', type: 'lesson_learned', tags: JSON.stringify(['database']), title: 'Database Tips' };

    const results = suggestRelatedKnowledge(current, allEntries);

    expect(results.every(r => r.entry.id !== '1')).toBe(true);
  });

  it('should give bonus score for same type', () => {
    const current = { id: '1', type: 'lesson_learned', tags: JSON.stringify(['unique-tag']), title: 'Unique Title' };

    const results = suggestRelatedKnowledge(current, allEntries);

    // Entry 2 is same type (lesson_learned) - should have higher score than entry 3 (decision)
    const entry2 = results.find(r => r.entry.id === '2');
    const entry3 = results.find(r => r.entry.id === '3');

    if (entry2 && entry3) {
      expect(entry2.score).toBeGreaterThan(entry3.score);
    }
  });

  it('should give bonus score for shared words in title', () => {
    const current = { id: '1', type: 'lesson_learned', tags: JSON.stringify([]), title: 'Database Query Performance' };

    const results = suggestRelatedKnowledge(current, allEntries);

    // Entry with 'Database' in title should get a title similarity bonus
    const entryWithDb = results.find(r => r.entry.id === '2');
    if (entryWithDb) {
      expect(entryWithDb.score).toBeGreaterThan(0);
    }
  });

  it('should return empty array when no related entries found', () => {
    const current = { id: '99', type: 'template', tags: JSON.stringify(['completely-unique']), title: 'Completely Unique Title' };

    const results = suggestRelatedKnowledge(current, allEntries);

    expect(results).toHaveLength(0);
  });

  it('should return at most 5 results', () => {
    // Create many entries with overlapping tags
    const manyEntries = Array.from({ length: 10 }, (_, i) => ({
      id: String(i + 1),
      type: 'lesson_learned',
      tags: JSON.stringify(['shared-tag']),
      title: `Shared Title ${i}`,
    }));

    const current = { id: '0', type: 'lesson_learned', tags: JSON.stringify(['shared-tag']), title: 'Shared Title 0' };

    const results = suggestRelatedKnowledge(current, manyEntries);

    expect(results.length).toBeLessThanOrEqual(5);
  });

  it('should sort results by score descending', () => {
    const current = { id: '0', type: 'lesson_learned', tags: JSON.stringify(['database', 'performance']), title: 'Database Performance' };

    const results = suggestRelatedKnowledge(current, allEntries);

    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  it('should handle invalid JSON tags gracefully', () => {
    const entriesWithInvalid = [
      { id: '1', type: 'lesson_learned', tags: 'invalid-json', title: 'Entry 1' },
      { id: '2', type: 'lesson_learned', tags: JSON.stringify(['valid-tag']), title: 'Entry 2' },
    ];

    const current = { id: '0', type: 'lesson_learned', tags: JSON.stringify(['valid-tag']), title: 'Current' };

    const results = suggestRelatedKnowledge(current, entriesWithInvalid);

    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results.some(r => r.entry.id === '2')).toBe(true);
  });
});
