// ============================================================
// 中文语言包
// ============================================================

export default {
  // Common
  'common.loading': '加载中...',
  'common.save': '保存',
  'common.cancel': '取消',
  'common.delete': '删除',
  'common.edit': '编辑',
  'common.create': '创建',
  'common.search': '搜索',
  'common.filter': '筛选',
  'common.export': '导出',
  'common.import': '导入',
  'common.confirm': '确认',
  'common.back': '返回',
  'common.retry': '重试',
  'common.close': '关闭',
  'common.submit': '提交',
  'common.reset': '重置',
  'common.noData': '暂无数据',
  'common.success': '操作成功',
  'common.error': '操作失败',
  'common.warning': '警告',
  'common.all': '全部',

  // Nav
  'nav.dashboard': '仪表盘',
  'nav.tasks': '任务',
  'nav.agents': '智能体',
  'nav.integrations': '集成',
  'nav.plugins': '插件',
  'nav.settings': '设置',
  'nav.login': '登录',
  'nav.logout': '退出登录',

  // Dashboard
  'dashboard.title': '仪表盘',
  'dashboard.subtitle': '任务概览与数据分析',
  'dashboard.totalTasks': '总任务数',
  'dashboard.completionRate': '完成率',
  'dashboard.inProgress': '进行中',
  'dashboard.overdueTasks': '超期任务',
  'dashboard.trend14d': '近 14 天趋势',
  'dashboard.trendCreated': '创建',
  'dashboard.trendCompleted': '完成',
  'dashboard.statusDistribution': '状态分布',
  'dashboard.recentTasks': '最近任务',
  'dashboard.riskAlerts': '风险预警',
  'dashboard.notifications': '通知',
  'dashboard.noRisk': '暂无风险',
  'dashboard.noNotifications': '暂无通知',
  'dashboard.unread': '{count} 未读',
  'dashboard.deadline': '截止: {date}',

  // Task statuses
  'status.todo': '待办',
  'status.in_progress': '进行中',
  'status.done': '已完成',
  'status.closed': '已关闭',
  'status.deleted': '已删除',

  // Task priorities
  'priority.urgent': '紧急',
  'priority.high': '高',
  'priority.medium': '中',
  'priority.low': '低',

  // Task page
  'tasks.title': '任务管理',
  'tasks.kanban': '看板视图',
  'tasks.list': '列表视图',
  'tasks.createTask': '创建任务',
  'tasks.taskTitle': '任务标题',
  'tasks.description': '描述',
  'tasks.priority': '优先级',
  'tasks.type': '类型',
  'tasks.dueDate': '截止日期',
  'tasks.assignee': '负责人',
  'tasks.tags': '标签',
  'tasks.progress': '进度',
  'tasks.noTasks': '暂无任务',

  // Task detail
  'taskDetail.title': '任务详情',
  'taskDetail.source': '来源',
  'taskDetail.creator': '创建者',
  'taskDetail.createdAt': '创建时间',
  'taskDetail.updatedAt': '更新时间',
  'taskDetail.subTasks': '子任务',
  'taskDetail.dependencies': '依赖',
  'taskDetail.dependents': '被依赖',
  'taskDetail.history': '历史记录',
  'taskDetail.advanceStatus': '推进状态',

  // AI
  'ai.assistant': 'AI 任务助手',
  'ai.thinking': '思考中...',
  'ai.send': '发送',
  'ai.placeholder': '输入你的问题...',
  'ai.welcome': '你好！我是 AI 任务助手 🧠\n\n你可以问我：\n• "帮我找出本周到期的紧急任务"\n• "分析一下当前的工作负载"\n• "拆解任务：实现用户登录功能"',
  'ai.notUnderstood': '抱歉，我暂时无法理解这个查询。',
  'ai.error': '出错了：{error}',

  // Plugins
  'plugins.title': '插件管理',
  'plugins.subtitle': '管理和扩展系统功能',
  'plugins.install': '+ 安装插件',
  'plugins.installNew': '安装新插件',
  'plugins.pluginName': '插件名称',
  'plugins.displayName': '显示名称',
  'plugins.entryPoint': '入口文件',
  'plugins.author': '作者',
  'plugins.description': '描述',
  'plugins.enable': '启用',
  'plugins.disable': '禁用',
  'plugins.uninstall': '卸载',
  'plugins.enabled': '已启用',
  'plugins.disabled': '已禁用',
  'plugins.noPlugins': '暂无插件',
  'plugins.noPluginsHint': '点击上方"安装插件"按钮来添加新插件',
  'plugins.installedAt': '安装于',
  'plugins.confirmUninstall': '确定要卸载插件 "{name}" 吗？',

  // Auth
  'auth.login': '登录',
  'auth.register': '注册',
  'auth.username': '用户名',
  'auth.password': '密码',
  'auth.email': '邮箱',
  'auth.displayName': '显示名称',
  'auth.noAccount': '没有账户？',
  'auth.hasAccount': '已有账户？',
  'auth.loginFailed': '用户名或密码错误',
  'auth.registerFailed': '注册失败',

  // Settings
  'settings.title': '设置',
  'settings.general': '通用',
  'settings.appearance': '外观',
  'settings.language': '语言',
  'settings.theme': '主题',
  'settings.themeLight': '浅色',
  'settings.themeDark': '深色',
  'settings.themeSystem': '跟随系统',

  // Theme
  'theme.toggle': '切换主题',
  'theme.light': '浅色模式',
  'theme.dark': '深色模式',

  // Error
  'error.pageCrash': '页面出现了问题',
  'error.backHome': '返回首页',

  // Notifications
  'notification.channels': '通知渠道',
  'notification.level.info': '信息',
  'notification.level.warning': '警告',
  'notification.level.error': '错误',
  'notification.level.success': '成功',

  // Integrations
  'integrations.title': '集成管理',
  'integrations.subtitle': '连接外部服务',
} as const;
