'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';

interface WorkflowStep {
  id: string;
  type: 'ai-analyze' | 'create-task' | 'update-status' | 'send-notification' | 'wait';
  config: Record<string, unknown>;
}

const STEP_TYPES = [
  { value: 'ai-analyze', label: '🧠 AI 分析', desc: '使用 AI 分析任务数据' },
  { value: 'create-task', label: '✅ 创建任务', desc: '自动创建子任务' },
  { value: 'update-status', label: '🔄 更新状态', desc: '自动推进任务状态' },
  { value: 'send-notification', label: '🔔 发送通知', desc: '发送通知给相关人员' },
  { value: 'wait', label: '⏳ 等待', desc: '等待指定时间后继续' },
];

export default function AgentWorkflowsPage() {
  const [workflows, setWorkflows] = useState<{ name: string; steps: WorkflowStep[] }[]>([
    {
      name: '每日任务分析',
      steps: [
        { id: '1', type: 'ai-analyze', config: { query: '分析今日到期任务并按优先级排序' } },
        { id: '2', type: 'send-notification', config: { channel: 'email', message: '紧急任务提醒' } },
      ],
    },
    {
      name: '新任务自动拆解',
      steps: [
        { id: '1', type: 'ai-analyze', config: { query: '分析任务复杂度并生成子任务建议' } },
        { id: '2', type: 'create-task', config: { auto: true } },
        { id: '3', type: 'send-notification', config: { channel: 'in-app', message: '任务已自动拆解' } },
      ],
    },
  ]);
  const [selectedWorkflow, setSelectedWorkflow] = useState(0);
  const [running, setRunning] = useState(false);

  const currentWorkflow = workflows[selectedWorkflow];

  const runWorkflow = async () => {
    setRunning(true);
    // Simulate workflow execution
    for (let i = 0; i < currentWorkflow.steps.length; i++) {
      await new Promise(r => setTimeout(r, 1500));
    }
    setRunning(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">🤖 Agent 工作流</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">编排多步骤 AI Agent 自动化流程</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Workflow List */}
          <div className="space-y-2">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">工作流列表</h2>
            {workflows.map((wf, i) => (
              <button
                key={i}
                onClick={() => setSelectedWorkflow(i)}
                className={`w-full text-left p-3 rounded-lg border transition-colors ${
                  selectedWorkflow === i
                    ? 'border-blue-500 bg-blue-50 dark:bg-blue-950'
                    : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 hover:bg-gray-50 dark:hover:bg-gray-800'
                }`}
              >
                <h3 className="font-medium text-sm text-gray-900 dark:text-gray-100">{wf.name}</h3>
                <p className="text-xs text-gray-400 mt-0.5">{wf.steps.length} 个步骤</p>
              </button>
            ))}
          </div>

          {/* Workflow Editor */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900 dark:text-gray-100">{currentWorkflow.name}</h2>
                <button
                  onClick={runWorkflow}
                  disabled={running}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    running
                      ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-950 dark:text-yellow-300'
                      : 'bg-green-600 text-white hover:bg-green-700'
                  }`}
                >
                  {running ? '⏳ 执行中...' : '▶ 执行工作流'}
                </button>
              </div>

              {/* Steps */}
              <div className="space-y-3">
                {currentWorkflow.steps.map((step, i) => {
                  const stepType = STEP_TYPES.find(s => s.value === step.type);
                  return (
                    <div key={step.id} className="flex items-start gap-3">
                      {/* Connector */}
                      <div className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${
                          running ? 'bg-yellow-100 text-yellow-700 animate-pulse' : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                        }`}>
                          {i + 1}
                        </div>
                        {i < currentWorkflow.steps.length - 1 && (
                          <div className="w-0.5 h-8 bg-gray-200 dark:bg-gray-700" />
                        )}
                      </div>

                      {/* Step Content */}
                      <div className="flex-1 p-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
                        <h4 className="font-medium text-sm text-gray-900 dark:text-gray-100">{stepType?.label}</h4>
                        <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{stepType?.desc}</p>
                        {Object.keys(step.config).length > 0 && (
                          <pre className="mt-2 p-2 bg-white dark:bg-gray-900 rounded text-xs font-mono text-gray-600 dark:text-gray-400">
                            {JSON.stringify(step.config, null, 2)}
                          </pre>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
