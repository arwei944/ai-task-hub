// ============================================================
// Ops Topology View - /ops/topology
// ============================================================
//
// Visual topology of the 7 capability building blocks
// using ReactFlow. Shows dependencies, health status,
// and service connections.
// ============================================================

'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  Handle,
  Position,
  type NodeProps,
} from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useHealthSSE, type HealthSSEEvent } from '@/lib/hooks/use-health-sse';

// ---- Types ----

interface CapabilityNodeData {
  label: string;
  icon: string;
  status: 'healthy' | 'degraded' | 'failed' | 'unknown';
  details?: string;
  latencyMs?: number;
  metrics?: Record<string, unknown>;
}

// ---- Capability definitions ----

const CAPABILITIES = [
  { id: 'task', label: '任务引擎', icon: '📋', x: 400, y: 0 },
  { id: 'notification', label: '通知系统', icon: '🔔', x: 0, y: 150 },
  { id: 'workflow', label: '工作流', icon: '🔄', x: 200, y: 150 },
  { id: 'ai', label: 'AI 服务', icon: '🤖', x: 600, y: 150 },
  { id: 'integration', label: '集成适配', icon: '🔌', x: 800, y: 150 },
  { id: 'agent', label: '智能体', icon: '🤝', x: 400, y: 300 },
  { id: 'observability', label: '可观测性', icon: '📊', x: 200, y: 450 },
];

// Dependencies: [from, to]
const DEPENDENCIES: [string, string][] = [
  ['workflow', 'task'],
  ['ai', 'task'],
  ['agent', 'ai'],
  ['agent', 'task'],
  ['notification', 'task'],
  ['integration', 'task'],
  ['observability', 'task'],
  ['workflow', 'notification'],
];

// ---- Custom Node Component ----

function CapabilityNode({ data }: { data: CapabilityNodeData }) {
  const statusColors = {
    healthy: 'border-emerald-400 dark:border-emerald-600 bg-emerald-50/80 dark:bg-emerald-950/40',
    degraded: 'border-amber-400 dark:border-amber-600 bg-amber-50/80 dark:bg-amber-950/40',
    failed: 'border-red-400 dark:border-red-600 bg-red-50/80 dark:bg-red-950/40',
    unknown: 'border-gray-300 dark:border-gray-600 bg-gray-50/80 dark:bg-gray-800/40',
  };

  const statusDot = {
    healthy: 'bg-emerald-500',
    degraded: 'bg-amber-500',
    failed: 'bg-red-500',
    unknown: 'bg-gray-400',
  };

  return (
    <div
      className={`
        px-4 py-3 rounded-xl border-2 shadow-sm min-w-[140px]
        transition-all duration-300
        ${statusColors[data.status]}
      `}
    >
      <Handle type="target" position={Position.Top} className="!w-2 !h-2 !bg-gray-400" />
      <div className="flex items-center gap-2 mb-1">
        <span className="text-xl">{data.icon}</span>
        <span className="text-sm font-semibold text-gray-900 dark:text-gray-100">{data.label}</span>
        <div className={`w-2 h-2 rounded-full ml-auto ${statusDot[data.status]}`} />
      </div>
      <div className="flex items-center gap-2 text-xs text-gray-500">
        {data.latencyMs != null && <span>{data.latencyMs}ms</span>}
        {data.details && <span className="truncate max-w-[100px]">{data.details}</span>}
      </div>
      <Handle type="source" position={Position.Bottom} className="!w-2 !h-2 !bg-gray-400" />
    </div>
  );
}

const nodeTypes = { capability: CapabilityNode };

// ---- Main Component ----

export default function OpsTopologyPage() {
  const [healthData, setHealthData] = useState<Record<string, {
    status: string;
    details?: string;
    latencyMs?: number;
    metrics?: Record<string, unknown>;
  }>>({});

  // SSE health updates
  const handleEvent = useCallback((event: HealthSSEEvent) => {
    if (event.type === 'health.initial' && event.data.health) {
      setHealthData(event.data.health as unknown as Record<string, {
        status: string;
        details?: string;
        latencyMs?: number;
        metrics?: Record<string, unknown>;
      }>);
    }
    if (event.type === 'health.check' && event.data.report && event.data.capabilityId) {
      setHealthData(prev => ({
        ...prev,
        [event.data.capabilityId!]: event.data.report as unknown as {
          status: string;
          details?: string;
          latencyMs?: number;
          metrics?: Record<string, unknown>;
        },
      }));
    }
  }, []);

  const { isConnected } = useHealthSSE({ enabled: true, onEvent: handleEvent });

  // Build nodes
  const initialNodes: Node[] = useMemo(() =>
    CAPABILITIES.map(cap => ({
      id: cap.id,
      type: 'capability',
      position: { x: cap.x, y: cap.y },
      data: {
        label: cap.label, icon: cap.icon, status: (healthData[cap.id]?.status as CapabilityNodeData['status']) ?? 'unknown',
        details: healthData[cap.id]?.details,
        latencyMs: healthData[cap.id]?.latencyMs,
        metrics: healthData[cap.id]?.metrics,
      },
    })),
    [healthData],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes);

  // Update nodes when health data changes
  useEffect(() => {
    setNodes(nds =>
      nds.map(node => {
        const hd = healthData[node.id];
        if (!hd) return node;
        return {
          ...node,
          data: {
            ...node.data,
            status: (hd.status as CapabilityNodeData['status']) ?? 'unknown',
            details: hd.details,
            latencyMs: hd.latencyMs,
            metrics: hd.metrics,
          },
        };
      }),
    );
  }, [healthData, setNodes]);

  // Build edges
  const initialEdges: Edge[] = useMemo(() =>
    DEPENDENCIES.map(([from, to], i) => ({
      id: `e-${from}-${to}`,
      source: from,
      target: to,
      animated: true,
      style: { stroke: '#94a3b8', strokeWidth: 2 },
      type: 'smoothstep',
    })),
    [],
  );

  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">积木拓扑图</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            7 大能力模块的依赖关系与健康状态可视化
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-gray-300'}`} />
            <span className="text-xs text-gray-500">{isConnected ? '实时' : '离线'}</span>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-emerald-500" />正常</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-amber-500" />降级</div>
            <div className="flex items-center gap-1"><div className="w-2 h-2 rounded-full bg-red-500" />故障</div>
          </div>
        </div>
      </div>

      {/* ReactFlow canvas */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="h-[600px]">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.3}
              maxZoom={2}
            >
              <Background />
              <Controls />
              <MiniMap
                nodeColor={(node) => {
                  const status = (node.data as unknown as CapabilityNodeData)?.status;
                  switch (status) {
                    case 'healthy': return '#10b981';
                    case 'degraded': return '#f59e0b';
                    case 'failed': return '#ef4444';
                    default: return '#9ca3af';
                  }
                }}
                maskColor="rgba(0,0,0,0.1)"
              />
            </ReactFlow>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
