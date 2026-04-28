import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function HomePage() {
  const modules = [
    { id: 'task-core', name: '任务管理核心', status: 'planned', priority: 'P0', phase: 'M2' },
    { id: 'ai-engine', name: 'AI 引擎', status: 'planned', priority: 'P0', phase: 'M3' },
    { id: 'mcp-server', name: 'MCP 服务', status: 'planned', priority: 'P0', phase: 'M4' },
    { id: 'agent-collab', name: '智能体协作', status: 'planned', priority: 'P1', phase: 'M5' },
    { id: 'notifications', name: '通知系统', status: 'planned', priority: 'P1', phase: 'M7' },
    { id: 'dashboard', name: '数据可视化', status: 'planned', priority: 'P2', phase: 'M7' },
    { id: 'integration-github', name: 'GitHub 集成', status: 'planned', priority: 'P1', phase: 'M6' },
    { id: 'integration-feishu', name: '飞书集成', status: 'planned', priority: 'P1', phase: 'M6' },
    { id: 'integration-notion', name: 'Notion 集成', status: 'planned', priority: 'P1', phase: 'M6' },
    { id: 'integration-webhook', name: '通用 Webhook', status: 'planned', priority: 'P1', phase: 'M6' },
  ];

  const coreComponents = [
    { name: 'EventBus', desc: '事件总线 - 模块间解耦通信', status: 'done' },
    { name: 'DIContainer', desc: '依赖注入容器 - 服务管理', status: 'done' },
    { name: 'ModuleRegistry', desc: '模块注册表 - 生命周期管理', status: 'done' },
    { name: 'ConfigAccessor', desc: '配置加载器 - YAML + 环境变量', status: 'done' },
    { name: 'Logger', desc: '日志系统 - 结构化日志', status: 'done' },
    { name: 'ModuleKernel', desc: '模块内核 - 整合所有组件', status: 'done' },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center text-primary-foreground font-bold text-sm">
              AT
            </div>
            <h1 className="text-xl font-bold">AI Task Hub</h1>
            <Badge variant="secondary">v0.1.0</Badge>
          </div>
          <Badge variant="outline">M1 - 内核框架</Badge>
        </div>
      </header>

      <main className="container mx-auto px-6 py-8 space-y-8">
        {/* Hero */}
        <section className="text-center space-y-4 py-12">
          <h2 className="text-4xl font-bold tracking-tight">
            智能任务管理系统
          </h2>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            基于 AI 的模块化任务管理平台，支持 Trae 深度集成、
            多智能体协作、自动任务提取与进度追踪。
          </p>
          <div className="flex gap-4 justify-center">
            <Badge variant="default" className="text-sm px-3 py-1">
              模块化架构
            </Badge>
            <Badge variant="default" className="text-sm px-3 py-1">
              事件驱动
            </Badge>
            <Badge variant="default" className="text-sm px-3 py-1">
              插件化扩展
            </Badge>
            <Badge variant="default" className="text-sm px-3 py-1">
              MCP 协议
            </Badge>
          </div>
        </section>

        {/* Core Components Status */}
        <section>
          <h3 className="text-2xl font-semibold mb-4">内核组件</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {coreComponents.map((comp) => (
              <Card key={comp.name}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{comp.name}</CardTitle>
                    <Badge
                      variant={comp.status === 'done' ? 'default' : 'secondary'}
                    >
                      {comp.status === 'done' ? '已完成' : '开发中'}
                    </Badge>
                  </div>
                  <CardDescription>{comp.desc}</CardDescription>
                </CardHeader>
              </Card>
            ))}
          </div>
        </section>

        {/* Module Roadmap */}
        <section>
          <h3 className="text-2xl font-semibold mb-4">模块路线图</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {modules.map((mod) => (
              <Card key={mod.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base">{mod.name}</CardTitle>
                    <div className="flex gap-2">
                      <Badge variant="outline">{mod.phase}</Badge>
                      <Badge variant="secondary">{mod.priority}</Badge>
                    </div>
                  </div>
                  <CardDescription className="text-xs font-mono">{mod.id}</CardDescription>
                </CardHeader>
                <CardContent>
                  <Badge variant="outline" className="text-xs">
                    {mod.status === 'done' ? '已实现' : mod.status === 'wip' ? '开发中' : '计划中'}
                  </Badge>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        {/* Architecture Info */}
        <section>
          <h3 className="text-2xl font-semibold mb-4">架构特性</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">模块隔离</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                每个模块独立目录、独立职责，修改一个模块不影响其他模块。
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">事件驱动</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                模块间通过事件总线解耦，新增/删除模块无需修改已有代码。
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">依赖注入</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                所有依赖通过 DI 容器注入，方便替换实现和单元测试。
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle className="text-base">配置驱动</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted-foreground">
                模块启停和行为通过 YAML 配置文件控制，无需修改代码。
              </CardContent>
            </Card>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t mt-12">
        <div className="container mx-auto px-6 py-4 text-center text-sm text-muted-foreground">
          AI Task Hub v0.1.0 · Modular Kernel Architecture · M1 Complete
        </div>
      </footer>
    </div>
  );
}
