// ============================================================
// AI Knowledge Extractor - Rule-based knowledge extraction
// (NO AI API calls - uses deterministic rules only)
// ============================================================

import type { CreateKnowledgeInput } from './types';

/**
 * Extract knowledge entries from a completed project using rule-based logic.
 */
export function extractFromProjectCompletion(project: {
  id: string;
  name: string;
  description?: string | null;
  phase?: string;
  techStack?: string | null;
  startedAt?: Date | null;
  completedAt?: Date | null;
  _count?: {
    tasks?: number;
    phaseTransitions?: number;
  };
}): CreateKnowledgeInput[] {
  const entries: CreateKnowledgeInput[] = [];
  const taskCount = project._count?.tasks ?? 0;
  const transitionCount = project._count?.phaseTransitions ?? 0;

  // Always generate: project completion summary
  const durationDays = project.startedAt && project.completedAt
    ? Math.round((project.completedAt.getTime() - project.startedAt.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  entries.push({
    projectId: project.id,
    type: 'lesson_learned',
    title: '项目完成总结',
    content: [
      `项目「${project.name}」已完成。`,
      project.description ? `描述: ${project.description}` : null,
      project.techStack ? `技术栈: ${project.techStack}` : null,
      durationDays !== null ? `持续时长: ${durationDays} 天` : null,
      `任务总数: ${taskCount}`,
      `阶段转换次数: ${transitionCount}`,
    ].filter(Boolean).join('\n'),
    tags: ['项目总结', project.name],
    sourceEvent: 'project.completed',
    aiGenerated: true,
  });

  // If project had many tasks: large-scale project management experience
  if (taskCount >= 10) {
    entries.push({
      projectId: project.id,
      type: 'pattern',
      title: '大规模项目管理经验',
      content: [
        `项目「${project.name}」包含 ${taskCount} 个任务，属于大规模项目。`,
        taskCount >= 50
          ? '该项目任务量非常大，建议在类似项目中采用分批交付策略，并加强任务分解粒度管理。'
          : '该项目任务量较大，建议在类似项目中关注任务优先级排序和里程碑设置。',
        `阶段转换次数: ${transitionCount}，平均每阶段约 ${transitionCount > 0 ? Math.round(taskCount / transitionCount) : taskCount} 个任务。`,
      ].join('\n'),
      tags: ['项目管理', '大规模', taskCount >= 50 ? '超大规模' : ''],
      sourceEvent: 'project.completed',
      aiGenerated: true,
    });
  }

  // If project had phase transitions: phase management experience
  if (transitionCount >= 2) {
    entries.push({
      projectId: project.id,
      type: 'lesson_learned',
      title: '阶段管理经验',
      content: [
        `项目「${project.name}」经历了 ${transitionCount} 次阶段转换。`,
        transitionCount >= 5
          ? '阶段转换频繁，建议在类似项目中提前规划阶段间衔接工作，减少转换开销。'
          : '阶段转换次数适中，项目阶段划分较为合理。',
        `最终阶段: ${project.phase || 'completed'}。`,
      ].join('\n'),
      tags: ['阶段管理', '流程优化'],
      sourceEvent: 'project.completed',
      aiGenerated: true,
    });
  }

  return entries;
}

/**
 * Suggest related knowledge entries based on tags and type.
 * Returns entries sorted by relevance score (higher = more related).
 */
export function suggestRelatedKnowledge(
  knowledgeEntry: {
    id: string;
    type: string;
    tags: string;
    title: string;
  },
  allEntries: Array<{
    id: string;
    type: string;
    tags: string;
    title: string;
  }>,
): Array<{ entry: typeof allEntries[number]; score: number }> {
  let entryTags: string[];
  try {
    entryTags = JSON.parse(knowledgeEntry.tags);
  } catch {
    entryTags = [];
  }

  const results: Array<{ entry: typeof allEntries[number]; score: number }> = [];

  for (const candidate of allEntries) {
    if (candidate.id === knowledgeEntry.id) continue;

    let candidateTags: string[];
    try {
      candidateTags = JSON.parse(candidate.tags);
    } catch {
      candidateTags = [];
    }

    let score = 0;

    // Tag overlap scoring (each matching tag = 2 points)
    const matchingTags = entryTags.filter(tag => candidateTags.includes(tag));
    score += matchingTags.length * 2;

    // Same type bonus (3 points)
    if (candidate.type === knowledgeEntry.type) {
      score += 3;
    }

    // Title similarity bonus (1 point if they share a word)
    const entryWords = knowledgeEntry.title.toLowerCase().split(/\s+/);
    const candidateWords = candidate.title.toLowerCase().split(/\s+/);
    const sharedWords = entryWords.filter(w => w.length > 1 && candidateWords.includes(w));
    score += Math.min(sharedWords.length, 3); // cap at 3

    if (score > 0) {
      results.push({ entry: candidate, score });
    }
  }

  // Sort by score descending
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, 5); // Return top 5
}
