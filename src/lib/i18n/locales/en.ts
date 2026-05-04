// ============================================================
// English Language Pack
// ============================================================

export default {
  // Common
  'common.loading': 'Loading...',
  'common.save': 'Save',
  'common.cancel': 'Cancel',
  'common.delete': 'Delete',
  'common.edit': 'Edit',
  'common.create': 'Create',
  'common.search': 'Search',
  'common.filter': 'Filter',
  'common.export': 'Export',
  'common.import': 'Import',
  'common.confirm': 'Confirm',
  'common.back': 'Back',
  'common.retry': 'Retry',
  'common.close': 'Close',
  'common.submit': 'Submit',
  'common.reset': 'Reset',
  'common.noData': 'No data',
  'common.success': 'Success',
  'common.error': 'Error',
  'common.warning': 'Warning',
  'common.all': 'All',

  // Nav
  'nav.dashboard': 'Dashboard',
  'nav.tasks': 'Tasks',
  'nav.agents': 'Agents',
  'nav.integrations': 'Integrations',
  'nav.plugins': 'Plugins',
  'nav.settings': 'Settings',
  'nav.login': 'Login',
  'nav.logout': 'Logout',

  // Dashboard
  'dashboard.title': 'Dashboard',
  'dashboard.subtitle': 'Task overview & analytics',
  'dashboard.totalTasks': 'Total Tasks',
  'dashboard.completionRate': 'Completion Rate',
  'dashboard.inProgress': 'In Progress',
  'dashboard.overdueTasks': 'Overdue',
  'dashboard.trend14d': '14-Day Trend',
  'dashboard.trendCreated': 'Created',
  'dashboard.trendCompleted': 'Completed',
  'dashboard.statusDistribution': 'Status Distribution',
  'dashboard.recentTasks': 'Recent Tasks',
  'dashboard.riskAlerts': 'Risk Alerts',
  'dashboard.notifications': 'Notifications',
  'dashboard.noRisk': 'No risks',
  'dashboard.noNotifications': 'No notifications',
  'dashboard.unread': '{count} unread',
  'dashboard.deadline': 'Due: {date}',

  // Task statuses
  'status.todo': 'To Do',
  'status.in_progress': 'In Progress',
  'status.done': 'Done',
  'status.closed': 'Closed',
  'status.deleted': 'Deleted',

  // Task priorities
  'priority.urgent': 'Urgent',
  'priority.high': 'High',
  'priority.medium': 'Medium',
  'priority.low': 'Low',

  // Task page
  'tasks.title': 'Task Management',
  'tasks.kanban': 'Kanban',
  'tasks.list': 'List',
  'tasks.createTask': 'Create Task',
  'tasks.taskTitle': 'Task Title',
  'tasks.description': 'Description',
  'tasks.priority': 'Priority',
  'tasks.type': 'Type',
  'tasks.dueDate': 'Due Date',
  'tasks.assignee': 'Assignee',
  'tasks.tags': 'Tags',
  'tasks.progress': 'Progress',
  'tasks.noTasks': 'No tasks',

  // Task detail
  'taskDetail.title': 'Task Detail',
  'taskDetail.source': 'Source',
  'taskDetail.creator': 'Creator',
  'taskDetail.createdAt': 'Created At',
  'taskDetail.updatedAt': 'Updated At',
  'taskDetail.subTasks': 'Sub-tasks',
  'taskDetail.dependencies': 'Dependencies',
  'taskDetail.dependents': 'Dependents',
  'taskDetail.history': 'History',
  'taskDetail.advanceStatus': 'Advance Status',

  // AI
  'ai.assistant': 'AI Assistant',
  'ai.thinking': 'Thinking...',
  'ai.send': 'Send',
  'ai.placeholder': 'Type your question...',
  'ai.welcome': 'Hello! I\'m your AI Task Assistant 🧠\n\nYou can ask me:\n• "Find urgent tasks due this week"\n• "Analyze current workload"\n• "Break down: implement user login"',
  'ai.notUnderstood': 'Sorry, I cannot understand this query.',
  'ai.error': 'Error: {error}',

  // Plugins
  'plugins.title': 'Plugins',
  'plugins.subtitle': 'Manage and extend functionality',
  'plugins.install': '+ Install Plugin',
  'plugins.installNew': 'Install New Plugin',
  'plugins.pluginName': 'Plugin Name',
  'plugins.displayName': 'Display Name',
  'plugins.entryPoint': 'Entry Point',
  'plugins.author': 'Author',
  'plugins.description': 'Description',
  'plugins.enable': 'Enable',
  'plugins.disable': 'Disable',
  'plugins.uninstall': 'Uninstall',
  'plugins.enabled': 'Enabled',
  'plugins.disabled': 'Disabled',
  'plugins.noPlugins': 'No plugins',
  'plugins.noPluginsHint': 'Click "Install Plugin" above to add a new plugin',
  'plugins.installedAt': 'Installed',
  'plugins.confirmUninstall': 'Are you sure you want to uninstall "{name}"?',

  // Auth
  'auth.login': 'Login',
  'auth.register': 'Register',
  'auth.username': 'Username',
  'auth.password': 'Password',
  'auth.email': 'Email',
  'auth.displayName': 'Display Name',
  'auth.noAccount': 'No account?',
  'auth.hasAccount': 'Already have an account?',
  'auth.loginFailed': 'Invalid username or password',
  'auth.registerFailed': 'Registration failed',

  // Settings
  'settings.title': 'Settings',
  'settings.general': 'General',
  'settings.appearance': 'Appearance',
  'settings.language': 'Language',
  'settings.theme': 'Theme',
  'settings.themeLight': 'Light',
  'settings.themeDark': 'Dark',
  'settings.themeSystem': 'System',

  // Theme
  'theme.toggle': 'Toggle theme',
  'theme.light': 'Light mode',
  'theme.dark': 'Dark mode',

  // Error
  'error.pageCrash': 'Something went wrong',
  'error.backHome': 'Back to Home',

  // Notifications
  'notification.channels': 'Notification Channels',
  'notification.level.info': 'Info',
  'notification.level.warning': 'Warning',
  'notification.level.error': 'Error',
  'notification.level.success': 'Success',

  // Integrations
  'integrations.title': 'Integrations',
  'integrations.subtitle': 'Connect external services',

  // Admin
  'admin.users.title': 'User Management',
  'admin.users.subtitle': 'Manage users, roles and permissions',
  'admin.users.search': 'Search username or display name...',
  'admin.users.total': '{count} users total',
  'admin.users.role.admin': 'Admin',
  'admin.users.role.user': 'User',
  'admin.users.role.agent': 'Agent',
  'admin.users.status.active': 'Active',
  'admin.users.status.disabled': 'Disabled',
  'admin.users.action.enable': 'Enable user',
  'admin.users.action.disable': 'Disable user',
  'admin.users.noUsers': 'No users',
  'admin.users.noMatch': 'No matching users',

  'admin.modules.title': 'Module Management',
  'admin.modules.subtitle': 'Enable, disable and hot-reload system modules',
  'admin.modules.search': 'Search modules...',
  'admin.modules.stats': '{enabled}/{total} enabled · {locked} locked',
  'admin.modules.action.enable': 'Enable',
  'admin.modules.action.disable': 'Disable',
  'admin.modules.action.reload': 'Reload',
  'admin.modules.locked': 'Core module (locked)',
  'admin.modules.noModules': 'No modules',
  'admin.modules.noMatch': 'No matching modules',

  // Notification Settings
  'settings.notifications.title': 'Notification Settings',
  'settings.notifications.subtitle': 'Configure notification channels and preferences',
  'settings.notifications.push': 'Browser Push',
  'settings.notifications.pushEnabled': 'Enabled',
  'settings.notifications.pushDisabled': 'Disabled',
  'settings.notifications.pushUnsupported': 'Not supported in this browser',
  'settings.notifications.testPush': 'Send Test',
  'settings.notifications.channels': 'Notification Channels',
  'settings.notifications.rules': 'Notification Rules',
  'settings.notifications.noRules': 'No rules yet. Create one in the notification management page.',

  // PWA
  'pwa.install.title': 'Install AI Task Hub',
  'pwa.install.description': 'Add to home screen for a better experience',
  'pwa.install.button': 'Install',
  'pwa.offline.title': 'Network Connection Lost',
  'pwa.offline.description': 'AI Task Hub requires a network connection. Please check your settings and try again.',
  'pwa.offline.retry': 'Reconnect',
} as const;
