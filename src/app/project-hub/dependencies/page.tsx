// ============================================================
// Dependencies Page - /project-hub/dependencies
// ============================================================
//
// Visualizes project dependencies as a directed graph.
// Uses a card-based layout showing dependency relationships
// between projects with colored badges and arrows.
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { trpc } from '@/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Network,
  ArrowRight,
  ArrowLeftRight,
  RefreshCw,
  CircleDot,
  AlertTriangle,
  CheckCircle2,
  PauseCircle,
  Clock,
  ExternalLink,
} from 'lucide-react';

// ---- Types ----

interface GraphNode {
  id: string;
  name: string;
  status: string;
  phase: string;
  healthScore?: number;
}

interface GraphEdge {
  id: string;
  sourceProjectId: string;
  sourceProjectName: string;
  targetProjectId: string;
  targetProjectName: string;
  dependencyType: string;
  description?: string;
}

interface DependencyGraph {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

// ---- Status helpers ----

function ProjectStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; className: string }> = {
    active: {
      label: '进行中',
      className: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300',
    },
    paused: {
      label: '已暂停',
      className: 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300',
    },
    completed: {
      label: '已完成',
      className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    },
    archived: {
      label: '已归档',
      className: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
    },
  };
  const c = config[status] || { label: status, className: '' };
  return <Badge variant="outline" className={c.className}>{c.label}</Badge>;
}

function HealthScoreIndicator({ score }: { score?: number }) {
  if (score === undefined || score === null) return null;
  const color =
    score >= 75
      ? 'text-emerald-600 dark:text-emerald-400'
      : score >= 50
        ? 'text-amber-600 dark:text-amber-400'
        : 'text-red-600 dark:text-red-400';
  return (
    <span className={`text-xs font-medium ${color}`}>
      {score}%
    </span>
  );
}

function DependencyTypeBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; className: string }> = {
    blocks: {
      label: '阻塞',
      className: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
    },
    depends_on: {
      label: '依赖',
      className: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
    },
    shares: {
      label: '共享',
      className: 'bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300',
    },
    related: {
      label: '关联',
      className: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    },
  };
  const c = config[type] || { label: type, className: '' };
  return <Badge variant="outline" className={`text-[10px] ${c.className}`}>{c.label}</Badge>;
}

// ---- Main Component ----

export default function DependenciesPage() {
  const [graph, setGraph] = useState<DependencyGraph | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchGraph = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await trpc.projectHub.dependencies.graph.query();
      setGraph(data as unknown as DependencyGraph);
    } catch (err: any) {
      console.error('Failed to fetch dependency graph:', err);
      setError(err?.message ?? '加载失败');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGraph();
  }, [fetchGraph]);

  // Build lookup maps for dependency relationships
  const getDependenciesForProject = useCallback(
    (projectId: string) => {
      if (!graph) return { dependsOn: [], dependedBy: [] };
      const dependsOn = graph.edges.filter(
        (e) => e.sourceProjectId === projectId,
      );
      const dependedBy = graph.edges.filter(
        (e) => e.targetProjectId === projectId,
      );
      return { dependsOn, dependedBy };
    },
    [graph],
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            依赖关系
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            查看项目之间的依赖关系与影响分析
          </p>
        </div>
        <Button variant="outline" size="sm" onClick={fetchGraph} disabled={isLoading}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1.5 ${isLoading ? 'animate-spin' : ''}`} />
          刷新
        </Button>
      </div>

      {/* Summary stats */}
      {!isLoading && graph && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-950 flex items-center justify-center">
                <Network className="w-5 h-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {graph.nodes.length}
                </p>
                <p className="text-xs text-gray-500">项目节点</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-lg bg-violet-100 dark:bg-violet-950 flex items-center justify-center">
                <ArrowRight className="w-5 h-5 text-violet-600 dark:text-violet-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {graph.edges.length}
                </p>
                <p className="text-xs text-gray-500">依赖关系</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-950 flex items-center justify-center">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {graph.nodes.filter((n) => n.status === 'active').length}
                </p>
                <p className="text-xs text-gray-500">活跃项目</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-lg bg-red-100 dark:bg-red-950 flex items-center justify-center">
                <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-gray-900 dark:text-gray-100">
                  {graph.edges.filter((e) => e.dependencyType === 'blocks').length}
                </p>
                <p className="text-xs text-gray-500">阻塞关系</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-3 w-20 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-16 bg-gray-100 dark:bg-gray-800 rounded mt-3" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : error ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-red-500 mb-2">{error}</p>
            <Button variant="outline" size="sm" onClick={fetchGraph}>
              重试
            </Button>
          </CardContent>
        </Card>
      ) : !graph || graph.nodes.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Network className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
            <p className="text-gray-500 dark:text-gray-400 text-lg font-medium">
              暂无依赖关系数据
            </p>
            <p className="text-gray-400 dark:text-gray-500 text-sm mt-1">
              在项目详情中添加依赖关系后，这里将显示关系图
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Dependency edges list */}
          {graph.edges.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <ArrowLeftRight className="w-4 h-4 text-blue-500" />
                  依赖关系列表
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {graph.edges.map((edge) => (
                    <div
                      key={edge.id}
                      className="flex items-center gap-3 py-2.5 px-3 rounded-lg bg-gray-50 dark:bg-gray-800/50 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                    >
                      {/* Source project */}
                      <Link
                        href={`/project-hub/${edge.sourceProjectId}`}
                        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        {edge.sourceProjectName}
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                      </Link>

                      {/* Arrow + type */}
                      <div className="flex items-center gap-1.5 shrink-0">
                        <ArrowRight className="w-4 h-4 text-gray-400" />
                        <DependencyTypeBadge type={edge.dependencyType} />
                      </div>

                      {/* Target project */}
                      <Link
                        href={`/project-hub/${edge.targetProjectId}`}
                        className="text-sm font-medium text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1"
                      >
                        {edge.targetProjectName}
                        <ExternalLink className="w-3 h-3 opacity-0 group-hover:opacity-100" />
                      </Link>

                      {/* Description */}
                      {edge.description && (
                        <span className="text-xs text-gray-400 ml-auto truncate max-w-[200px]">
                          {edge.description}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Project cards with dependency info */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3 flex items-center gap-2">
              <CircleDot className="w-4 h-4 text-blue-500" />
              项目节点详情
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {graph.nodes.map((node) => {
                const { dependsOn, dependedBy } = getDependenciesForProject(node.id);
                return (
                  <Card key={node.id} className="hover:shadow-md transition-shadow">
                    <CardHeader className="pb-3">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <Link
                            href={`/project-hub/${node.id}`}
                            className="text-sm font-semibold text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {node.name}
                          </Link>
                          <div className="flex items-center gap-2 mt-1.5">
                            <ProjectStatusBadge status={node.status} />
                            <HealthScoreIndicator score={node.healthScore} />
                          </div>
                        </div>
                        <Network className="w-4 h-4 text-gray-300 dark:text-gray-600 shrink-0 mt-0.5" />
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {/* Depends on */}
                      {dependsOn.length > 0 && (
                        <div>
                          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                            依赖于
                          </p>
                          <div className="space-y-1">
                            {dependsOn.map((dep) => (
                              <div
                                key={dep.id}
                                className="flex items-center gap-1.5 text-xs"
                              >
                                <ArrowRight className="w-3 h-3 text-blue-400 shrink-0" />
                                <Link
                                  href={`/project-hub/${dep.targetProjectId}`}
                                  className="text-gray-700 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 truncate"
                                >
                                  {dep.targetProjectName}
                                </Link>
                                <DependencyTypeBadge type={dep.dependencyType} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Depended by */}
                      {dependedBy.length > 0 && (
                        <div>
                          <p className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
                            被依赖
                          </p>
                          <div className="space-y-1">
                            {dependedBy.map((dep) => (
                              <div
                                key={dep.id}
                                className="flex items-center gap-1.5 text-xs"
                              >
                                <ArrowRight className="w-3 h-3 text-amber-400 shrink-0 rotate-180" />
                                <Link
                                  href={`/project-hub/${dep.sourceProjectId}`}
                                  className="text-gray-700 dark:text-gray-300 hover:text-blue-500 dark:hover:text-blue-400 truncate"
                                >
                                  {dep.sourceProjectName}
                                </Link>
                                <DependencyTypeBadge type={dep.dependencyType} />
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* No dependencies */}
                      {dependsOn.length === 0 && dependedBy.length === 0 && (
                        <p className="text-xs text-gray-400 text-center py-2">
                          无依赖关系
                        </p>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
