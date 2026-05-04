'use client';

import React, { useMemo } from 'react';
import {
  PieChart,
  Pie,
  Cell,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';

interface StatsDashboardProps {
  projects: any[];
}

export function StatsDashboard({ projects }: StatsDashboardProps) {
  const stats = useMemo(() => {
    // --- 项目状态统计 ---
    const active = projects.filter((p) => p.status === 'active').length;
    const completed = projects.filter((p) => p.status === 'completed').length;
    const paused = projects.filter((p) => p.status === 'paused').length;
    const total = projects.length;

    // --- 任务完成率 ---
    let doneCount = 0;
    let inProgressCount = 0;
    let todoCount = 0;
    for (const p of projects) {
      // 优先使用 taskStats（来自 overview API），其次用 _count
      const stats = p.taskStats ?? p._count?.tasks ? {
        total: p._count?.tasks ?? 0,
        done: Math.round(((p._count?.tasks ?? 0) * (p.progress ?? 0)) / 100),
        inProgress: 0, todo: 0
      } : null;
      if (stats) {
        doneCount += stats.done ?? 0;
        inProgressCount += stats.inProgress ?? 0;
        todoCount += stats.todo ?? 0;
      }
    }
    const totalTasks = doneCount + inProgressCount + todoCount;
    const completionRate = totalTasks > 0 ? Math.round((doneCount / totalTasks) * 100) : 0;

    // --- 优先级分布 ---
    const urgentCount = projects.filter((p) => p.priority === 'urgent').length;
    const highCount = projects.filter((p) => p.priority === 'high').length;
    const mediumCount = projects.filter((p) => p.priority === 'medium').length;
    const lowCount = projects.filter((p) => p.priority === 'low').length;

    // --- 阶段分布 ---
    const phaseMap: Record<string, number> = {
      requirements: 0,
      planning: 0,
      architecture: 0,
      implementation: 0,
      testing: 0,
      deployment: 0,
      completed: 0,
    };
    for (const p of projects) {
      if (p.phase && phaseMap[p.phase] !== undefined) {
        phaseMap[p.phase]++;
      }
    }

    return {
      active,
      completed,
      paused,
      total,
      doneCount,
      inProgressCount,
      todoCount,
      totalTasks,
      completionRate,
      urgentCount,
      highCount,
      mediumCount,
      lowCount,
      phaseMap,
    };
  }, [projects]);

  // --- 饼图数据 ---
  const pieData = [
    { name: '已完成', value: stats.doneCount, fill: '#22c55e' },
    { name: '进行中', value: stats.inProgressCount, fill: '#eab308' },
    { name: '待办', value: stats.todoCount, fill: '#94a3b8' },
  ].filter((d) => d.value > 0);

  // --- 优先级数据 ---
  const priorityData = [
    { name: '紧急', count: stats.urgentCount, fill: '#ef4444' },
    { name: '高', count: stats.highCount, fill: '#f97316' },
    { name: '中', count: stats.mediumCount, fill: '#eab308' },
    { name: '低', count: stats.lowCount, fill: '#6b7280' },
  ];

  // --- 阶段数据 ---
  const phaseData = [
    { name: '需求', count: stats.phaseMap.requirements },
    { name: '规划', count: stats.phaseMap.planning },
    { name: '架构', count: stats.phaseMap.architecture },
    { name: '开发', count: stats.phaseMap.implementation },
    { name: '测试', count: stats.phaseMap.testing },
    { name: '部署', count: stats.phaseMap.deployment },
    { name: '完成', count: stats.phaseMap.completed },
  ];

  // --- 自定义饼图中心标签 ---
  const PieCenterLabel = ({ viewBox }: any) => {
    const { cx, cy } = viewBox;
    return (
      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="central">
        <tspan className="text-sm font-semibold" fill="var(--foreground, #e2e8f0)">
          {stats.totalTasks}
        </tspan>
      </text>
    );
  };

  // --- 自定义 Tooltip ---
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="rounded-md border border-border/50 bg-popover px-2 py-1 text-xs shadow-md">
          <p className="text-popover-foreground">
            {payload[0].name}: {payload[0].value}
          </p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col gap-1">
      <div className="flex flex-row flex-wrap gap-4">
        {/* 1. 任务完成率 - 环形图 */}
        <div className="flex w-[200px] min-w-[180px] flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">任务完成率</span>
          <div className="h-[120px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={50} minHeight={60}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={40}
                  outerRadius={60}
                  dataKey="value"
                  stroke="none"
                  paddingAngle={2}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Pie>
                {stats.totalTasks > 0 && <PieCenterLabel viewBox={undefined} />}
                <Tooltip content={<CustomTooltip />} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex items-center justify-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-[#22c55e]" />
              已完成
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-[#eab308]" />
              进行中
            </span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-2 w-2 rounded-full bg-[#94a3b8]" />
              待办
            </span>
          </div>
        </div>

        {/* 2. 优先级分布 - 横向柱状图 */}
        <div className="flex w-[250px] min-w-[200px] flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">优先级分布</span>
          <div className="h-[120px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={50} minHeight={60}>
              <BarChart
                data={priorityData}
                layout="vertical"
                margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={36}
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground, #94a3b8)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" radius={[0, 3, 3, 0]} barSize={12}>
                  {priorityData.map((entry, index) => (
                    <Cell key={`bar-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 3. 阶段分布 - 堆叠柱状图 */}
        <div className="flex w-[250px] min-w-[200px] flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">阶段分布</span>
          <div className="h-[120px]">
            <ResponsiveContainer width="100%" height="100%" minWidth={50} minHeight={60}>
              <BarChart
                data={phaseData}
                layout="vertical"
                margin={{ top: 0, right: 0, left: 0, bottom: 0 }}
              >
                <XAxis type="number" hide />
                <YAxis
                  type="category"
                  dataKey="name"
                  width={36}
                  tick={{ fontSize: 11, fill: 'var(--muted-foreground, #94a3b8)' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} />
                <Bar dataKey="count" stackId="a" fill="#3b82f6" radius={[0, 3, 3, 0]} barSize={12} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 4. 快速统计卡片 */}
        <div className="flex flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-muted-foreground">概览</span>
          <div className="grid grid-cols-2 gap-2">
            {/* 活跃项目 */}
            <div className="flex items-center gap-2 rounded-lg border border-border/30 bg-card/50 px-3 py-2">
              <span className="inline-block h-2 w-2 rounded-full bg-green-500" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">活跃项目</span>
                <span className="text-sm font-semibold text-foreground">{stats.active}</span>
              </div>
            </div>
            {/* 完成率 */}
            <div className="flex items-center gap-2 rounded-lg border border-border/30 bg-card/50 px-3 py-2">
              <span className="inline-block h-2 w-2 rounded-full bg-blue-500" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">完成率</span>
                <span className="text-sm font-semibold text-foreground">{stats.completionRate}%</span>
              </div>
            </div>
            {/* 总任务 */}
            <div className="flex items-center gap-2 rounded-lg border border-border/30 bg-card/50 px-3 py-2">
              <span className="inline-block h-2 w-2 rounded-full bg-purple-500" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">总任务</span>
                <span className="text-sm font-semibold text-foreground">{stats.totalTasks}</span>
              </div>
            </div>
            {/* 本周工时 */}
            <div className="flex items-center gap-2 rounded-lg border border-border/30 bg-card/50 px-3 py-2">
              <span className="inline-block h-2 w-2 rounded-full bg-orange-500" />
              <div className="flex flex-col">
                <span className="text-xs text-muted-foreground">本周工时</span>
                <span className="text-sm font-semibold text-foreground">&mdash;</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
