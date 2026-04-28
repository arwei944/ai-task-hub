import { PrismaClient } from '@/generated/prisma/client';

export class TaskDependencyRepository {
  constructor(private prisma: PrismaClient) {}

  async addDependency(taskId: string, dependsOnId: string) {
    // Prevent self-dependency
    if (taskId === dependsOnId) {
      throw new Error('Task cannot depend on itself');
    }
    // Prevent duplicate
    const existing = await this.prisma.taskDependency.findUnique({
      where: { taskId_dependsOnId: { taskId, dependsOnId } },
    });
    if (existing) return existing;

    return this.prisma.taskDependency.create({
      data: { taskId, dependsOnId },
    });
  }

  async removeDependency(taskId: string, dependsOnId: string) {
    return this.prisma.taskDependency.delete({
      where: { taskId_dependsOnId: { taskId, dependsOnId } },
    });
  }

  async getDependencies(taskId: string) {
    return this.prisma.taskDependency.findMany({
      where: { taskId },
      include: { dependsOn: { select: { id: true, title: true, status: true } } },
    });
  }

  async getDependents(taskId: string) {
    return this.prisma.taskDependency.findMany({
      where: { dependsOnId: taskId },
      include: { task: { select: { id: true, title: true, status: true } } },
    });
  }

  /**
   * Check for circular dependency before adding.
   * Returns true if adding taskId -> dependsOnId would create a cycle.
   */
  async wouldCreateCycle(taskId: string, dependsOnId: string): Promise<boolean> {
    // BFS from dependsOnId to see if we can reach taskId
    const visited = new Set<string>();
    const queue = [dependsOnId];

    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === taskId) return true;
      if (visited.has(current)) continue;
      visited.add(current);

      const deps = await this.prisma.taskDependency.findMany({
        where: { taskId: current },
        select: { dependsOnId: true },
      });
      for (const dep of deps) {
        queue.push(dep.dependsOnId);
      }
    }
    return false;
  }

  async removeAllForTask(taskId: string) {
    await this.prisma.taskDependency.deleteMany({
      where: { OR: [{ taskId }, { dependsOnId: taskId }] },
    });
  }
}
