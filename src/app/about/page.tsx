'use client';

import { useState } from 'react';
import {
  Brain, ExternalLink, Layers, Zap, Shield, Puzzle,
  Bot, Globe, Database, Code2, Server, Cpu, ChevronDown, ChevronUp,
  Heart, BookOpen, Rocket, GitFork,
} from 'lucide-react';
import { APP_VERSION, VERSION_HISTORY as VERSION_HISTORY_IMPORTED } from '@/lib/core/version';

const VERSION = APP_VERSION;

const techStack = [
  { name: 'Next.js 16', desc: 'React 全栈框架 (Turbopack)', icon: Globe, color: 'text-black dark:text-white' },
  { name: 'React 19', desc: '用户界面库', icon: Code2, color: 'text-blue-500' },
  { name: 'tRPC v11', desc: '端到端类型安全 API', icon: Server, color: 'text-blue-600' },
  { name: 'Prisma 7', desc: '下一代 ORM', icon: Database, color: 'text-indigo-500' },
  { name: 'Tailwind CSS 4', desc: '实用优先 CSS 框架', icon: Cpu, color: 'text-cyan-500' },
  { name: 'shadcn/ui', desc: '可组合 UI 组件', icon: Layers, color: 'text-purple-500' },
  { name: 'TypeScript 5.9', desc: '类型安全的 JavaScript', icon: Code2, color: 'text-blue-400' },
  { name: 'SQLite', desc: '轻量级嵌入式数据库', icon: Database, color: 'text-green-500' },
];

const coreFeatures = [
  { icon: Brain, title: 'AI 驱动', desc: '内置 AI 引擎，支持任务自动提取、智能推断与分析' },
  { icon: Bot, title: '智能体协作', desc: '多 AI 智能体注册与协作，REST API v1 通用接入' },
  { icon: Puzzle, title: '模块化架构', desc: 'EventBus + DIContainer + ModuleRegistry 内核' },
  { icon: Zap, title: '工作流引擎', desc: '可视化工作流编排，支持条件分支与模板变量' },
  { icon: Shield, title: '安全加固', desc: 'JWT 认证 + RBAC 权限 + 48 个 API 权限管控' },
  { icon: Globe, title: '多平台集成', desc: 'GitHub / 飞书 / Notion / Webhook 深度集成' },
];

const archComponents = [
  { name: 'EventBus', desc: '事件总线 — 模块间解耦通信，发布/订阅模式' },
  { name: 'DIContainer', desc: '依赖注入容器 — 服务生命周期管理与自动注入' },
  { name: 'ModuleRegistry', desc: '模块注册表 — 动态注册、启停、热重载' },
  { name: 'ConfigAccessor', desc: '配置加载器 — YAML 配置 + 环境变量覆盖' },
  { name: 'ModuleKernel', desc: '模块内核 — 整合所有组件，统一启动入口' },
  { name: 'Logger', desc: '日志系统 — 结构化日志，支持多级别输出' },
];

const versionHistory = VERSION_HISTORY_IMPORTED;

const modules = [
  { name: '任务管理核心', id: 'task-core', status: 'stable' },
  { name: 'AI 引擎', id: 'ai-engine', status: 'stable' },
  { name: 'MCP 服务', id: 'mcp-server', status: 'stable' },
  { name: '智能体协作', id: 'agent-collab', status: 'stable' },
  { name: '通知系统', id: 'notifications', status: 'stable' },
  { name: '数据可视化', id: 'dashboard', status: 'stable' },
  { name: 'GitHub 集成', id: 'integration-github', status: 'stable' },
  { name: '飞书集成', id: 'integration-feishu', status: 'stable' },
  { name: 'Notion 集成', id: 'integration-notion', status: 'stable' },
  { name: 'Webhook', id: 'integration-webhook', status: 'stable' },
  { name: '工作流引擎', id: 'workflow-engine', status: 'stable' },
  { name: '插件系统', id: 'plugins', status: 'stable' },
];

export default function AboutPage() {
  const [expandedVersion, setExpandedVersion] = useState<string | null>(null);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <Brain className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">AI Task Hub</h1>
              <p className="text-blue-200 text-sm">v{VERSION}</p>
            </div>
          </div>
          <p className="text-xl text-blue-100 max-w-2xl leading-relaxed">
            AI 驱动的智能任务管理平台，支持 MCP 协议与 REST API 双接口，
            为 AI 智能体提供完整的任务生命周期管理能力。
          </p>
          <div className="flex gap-3 mt-8">
            <a
              href="https://github.com/arwei944/ai-task-hub"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 rounded-lg text-sm font-medium transition-colors backdrop-blur"
            >
              <GitFork className="w-4 h-4" />
              GitHub
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="/api-docs"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 rounded-lg text-sm font-medium transition-colors backdrop-blur"
            >
              <BookOpen className="w-4 h-4" />
              API 文档
            </a>
          </div>
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        {/* Core Features */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-5 flex items-center gap-2">
            <Rocket className="w-5 h-5 text-blue-600" />
            核心特性
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {coreFeatures.map((feat) => {
              const Icon = feat.icon;
              return (
                <div
                  key={feat.title}
                  className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-5 hover:shadow-md transition-shadow"
                >
                  <Icon className="w-6 h-6 text-blue-600 dark:text-blue-400 mb-3" />
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm mb-1">{feat.title}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400 leading-relaxed">{feat.desc}</p>
                </div>
              );
            })}
          </div>
        </section>

        {/* Tech Stack */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-5 flex items-center gap-2">
            <Code2 className="w-5 h-5 text-blue-600" />
            技术栈
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {techStack.map((tech) => {
              const Icon = tech.icon;
              return (
                <div
                  key={tech.name}
                  className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 flex items-center gap-3"
                >
                  <Icon className={`w-5 h-5 shrink-0 ${tech.color}`} />
                  <div className="min-w-0">
                    <div className="font-medium text-sm text-gray-900 dark:text-gray-100 truncate">{tech.name}</div>
                    <div className="text-[11px] text-gray-400 truncate">{tech.desc}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* Architecture */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-5 flex items-center gap-2">
            <Layers className="w-5 h-5 text-blue-600" />
            模块化架构
          </h2>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 overflow-hidden">
            <div className="divide-y divide-gray-100 dark:divide-gray-800">
              {archComponents.map((comp) => (
                <div key={comp.name} className="px-5 py-4 flex items-start gap-4">
                  <div className="w-2 h-2 rounded-full bg-blue-500 mt-2 shrink-0" />
                  <div>
                    <div className="font-mono font-semibold text-sm text-gray-900 dark:text-gray-100">{comp.name}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">{comp.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Modules */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-5 flex items-center gap-2">
            <Puzzle className="w-5 h-5 text-blue-600" />
            已实现模块
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
            {modules.map((mod) => (
              <div
                key={mod.id}
                className="bg-white dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-800 px-3 py-2.5 flex items-center justify-between"
              >
                <div>
                  <div className="text-sm font-medium text-gray-900 dark:text-gray-100">{mod.name}</div>
                  <div className="text-[10px] font-mono text-gray-400">{mod.id}</div>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
                  {mod.status}
                </span>
              </div>
            ))}
          </div>
        </section>

        {/* Version History */}
        <section>
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-5 flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-blue-600" />
            版本历史
          </h2>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 divide-y divide-gray-100 dark:divide-gray-800">
            {versionHistory.map((v) => (
              <div key={v.version}>
                <button
                  onClick={() => setExpandedVersion(expandedVersion === v.version ? null : v.version)}
                  className="w-full px-5 py-3.5 flex items-center justify-between hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono font-bold text-sm text-blue-600 dark:text-blue-400">v{v.version}</span>
                    <span className="text-xs text-gray-400">{v.date}</span>
                    <div className="flex gap-1">
                      {v.highlights.map((h) => (
                        <span key={h} className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400">
                          {h}
                        </span>
                      ))}
                    </div>
                  </div>
                  {expandedVersion === v.version ? (
                    <ChevronUp className="w-4 h-4 text-gray-400" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-gray-400" />
                  )}
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Footer */}
        <section className="text-center py-8 border-t border-gray-200 dark:border-gray-800">
          <div className="flex items-center justify-center gap-2 text-gray-500 dark:text-gray-400 text-sm">
            <span>Built with</span>
            <Heart className="w-4 h-4 text-red-500 fill-red-500" />
            <span>by arwei944</span>
          </div>
          <p className="text-xs text-gray-400 mt-2">
            MIT License · Deployed on Hugging Face Spaces
          </p>
        </section>
      </div>
    </div>
  );
}
