import {
  LayoutDashboard,
  CheckSquare,
  Bot,
  Link2,
  Puzzle,
  BookOpen,
  Store,
  Brain,
  FolderKanban,
  Info,
  GitBranch,
  Activity,
  Bell,
  Wrench,
  Rocket,
  FileText,
  GanttChart,
  Network,
  MessageSquare,
  Settings,
  Shield,
  Boxes,
  type LucideIcon,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────

export interface NavItem {
  /** Route path, e.g. '/project-hub' */
  href: string;
  /** Display label */
  label: string;
  /** Lucide icon component */
  icon: LucideIcon;
  /** Show in sidebar? default true */
  sidebar?: boolean;
  /** Show in navbar? default false */
  navbar?: boolean;
  /** Show in mobile bottom nav? default false */
  mobile?: boolean;
  /** Require admin role? default false */
  adminOnly?: boolean;
  /** Show only when inside a project context? default false */
  projectOnly?: boolean;
  /** Navigation group for sidebar categorization */
  group?: NavGroup;
}

export type NavGroup = 'core' | 'collaboration' | 'management' | 'ops' | 'secondary';

// ─── Navigation Groups ───────────────────────────────────

export const NAV_GROUPS: Record<NavGroup, { label: string; order: number }> = {
  core: { label: '核心', order: 1 },
  collaboration: { label: '协作', order: 2 },
  management: { label: '管理', order: 3 },
  ops: { label: '运维', order: 4 },
  secondary: { label: '其他', order: 5 },
};

// ─── All Navigation Items (single source of truth) ──────

export const NAV_ITEMS: NavItem[] = [
  // ── Core ──
  {
    href: '/dashboard',
    label: '仪表盘',
    icon: LayoutDashboard,
    navbar: true,
    mobile: false,
    group: 'core',
  },
  {
    href: '/project-hub',
    label: '我的项目',
    icon: FolderKanban,
    sidebar: true,
    mobile: true,
    group: 'core',
  },
  {
    href: '/tasks',
    label: '任务',
    icon: CheckSquare,
    navbar: true,
    mobile: true,
    group: 'core',
  },

  // ── Collaboration ──
  {
    href: '/workflows',
    label: '工作流',
    icon: GitBranch,
    sidebar: true,
    navbar: true,
    group: 'collaboration',
  },
  {
    href: '/agents',
    label: '智能体',
    icon: Bot,
    sidebar: true,
    navbar: true,
    mobile: true,
    group: 'collaboration',
  },
  {
    href: '/integrations',
    label: '集成管理',
    icon: Link2,
    sidebar: true,
    group: 'collaboration',
  },

  // ── Management ──
  {
    href: '/settings',
    label: '设置',
    icon: Settings,
    sidebar: true,
    navbar: true,
    mobile: true,
    group: 'management',
  },
  {
    href: '/admin/users',
    label: '用户管理',
    icon: Shield,
    sidebar: true,
    adminOnly: true,
    group: 'management',
  },
  {
    href: '/admin/modules',
    label: '模块管理',
    icon: Boxes,
    sidebar: true,
    adminOnly: true,
    group: 'management',
  },
  {
    href: '/plugins',
    label: '插件',
    icon: Puzzle,
    sidebar: true,
    navbar: true,
    mobile: true,
    group: 'management',
  },
  {
    href: '/notifications',
    label: '通知管理',
    icon: Bell,
    sidebar: true,
    group: 'management',
  },
  {
    href: '/deployments',
    label: '部署管理',
    icon: Rocket,
    sidebar: true,
    group: 'management',
  },

  // ── Ops ──
  {
    href: '/ops',
    label: '运维面板',
    icon: Wrench,
    sidebar: true,
    group: 'ops',
  },
  {
    href: '/observability',
    label: '可观测性',
    icon: Activity,
    sidebar: true,
    group: 'ops',
  },

  // ── Secondary ──
  {
    href: '/plugin-market',
    label: '插件市场',
    icon: Store,
    sidebar: true,
    group: 'secondary',
  },
  {
    href: '/feedback',
    label: '反馈中心',
    icon: MessageSquare,
    sidebar: true,
    group: 'secondary',
  },
  {
    href: '/api-docs',
    label: 'API 文档',
    icon: BookOpen,
    navbar: true,
    sidebar: true,
    group: 'secondary',
  },
  {
    href: '/releases',
    label: '版本记录',
    icon: GanttChart,
    sidebar: true,
    group: 'secondary',
  },
  {
    href: '/about',
    label: '关于',
    icon: Info,
    sidebar: true,
    group: 'secondary',
  },
];

// ─── Project-internal navigation (shown inside a project) ─

export function getProjectNavItems(projectId: string): NavItem[] {
  return [
    { href: `/project-hub/${projectId}`, label: '概览', icon: LayoutDashboard, projectOnly: true, group: 'core' },
    { href: `/project-hub/${projectId}/tasks`, label: '任务', icon: CheckSquare, projectOnly: true, group: 'core' },
    { href: `/project-hub/${projectId}/team`, label: '工作台', icon: Bot, projectOnly: true, group: 'collaboration' },
    { href: `/project-hub/${projectId}/docs`, label: '文档', icon: FileText, projectOnly: true, group: 'collaboration' },
    { href: `/project-hub/${projectId}/workflows`, label: '工作流', icon: GitBranch, projectOnly: true, group: 'collaboration' },
    { href: `/project-hub/${projectId}/dependencies`, label: '依赖关系', icon: Network, projectOnly: true, group: 'collaboration' },
    { href: `/project-hub/${projectId}/deployments`, label: '部署', icon: Rocket, projectOnly: true, group: 'management' },
    { href: `/project-hub/${projectId}/notifications`, label: '通知', icon: Bell, projectOnly: true, group: 'management' },
    { href: `/project-hub/${projectId}/activity`, label: '活动', icon: Activity, projectOnly: true, group: 'ops' },
  ];
}

// ─── Helpers ─────────────────────────────────────────────

/** Get items for sidebar, grouped by NavGroup */
export function getSidebarItems(): NavItem[] {
  return NAV_ITEMS.filter((item) => item.sidebar !== false);
}

/** Get items for top navbar */
export function getNavbarItems(): NavItem[] {
  return NAV_ITEMS.filter((item) => item.navbar === true);
}

/** Get items for mobile bottom nav (max 5) */
export function getMobileNavItems(): NavItem[] {
  return NAV_ITEMS.filter((item) => item.mobile === true).slice(0, 5);
}

/** Get items grouped by NavGroup */
export function getGroupedItems(items: NavItem[]): Record<NavGroup, NavItem[]> {
  const groups: Record<NavGroup, NavItem[]> = {
    core: [],
    collaboration: [],
    management: [],
    ops: [],
    secondary: [],
  };

  for (const item of items) {
    const group = item.group ?? 'secondary';
    groups[group].push(item);
  }

  return groups;
}
