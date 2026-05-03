'use client';

import { useState, useMemo } from 'react';
import {
  BookOpen, ChevronDown, ChevronUp, Tag, Calendar, Rocket, Star, CheckCircle2, ExternalLink,
} from 'lucide-react';
import { APP_VERSION, APP_CODENAME, VERSION_HISTORY } from '@/lib/core/version';

// ---- 版本代号映射 ----
const CODENAMES: Record<string, string> = {
  '3.0.1': 'Kernel Reborn',
  '3.0.0': 'Kernel Reborn',
  '2.7.0': 'Project Nova',
  '2.6.0': 'Project Nova',
  '2.4.0': 'AI Unleashed',
  '2.3.0': 'Workflow Evolution',
  '2.2.0': 'Platform Pulse',
  '2.1.0': '',
  '2.0.0': '',
  '1.9.0': '',
  '1.8.0': '',
  '1.7.0': '',
  '1.6.0': '',
  '1.5.0': '',
  '1.4.0': '',
  '1.3.0': '',
  '1.2.0': '',
  '1.1.0': '',
  '1.0.0': '',
};

// ---- 版本分组 ----
interface VersionGroup {
  major: string;
  label: string;
  versions: typeof VERSION_HISTORY;
}

function groupByMajor(versions: typeof VERSION_HISTORY): VersionGroup[] {
  const map = new Map<string, (typeof VERSION_HISTORY)[number][]>();
  for (const v of versions) {
    const major = v.version.split('.')[0];
    if (!map.has(major)) map.set(major, []);
    map.get(major)!.push(v);
  }
  const groups: VersionGroup[] = [];
  for (const [major, vers] of map) {
    groups.push({ major, label: `v${major}.x`, versions: vers });
  }
  return groups.sort((a, b) => Number(b.major) - Number(a.major));
}

// ---- 辅助：获取代号（兼容 prerelease 版本号） ----
function getCodename(version: string): string {
  // 先精确匹配
  if (CODENAMES[version]) return CODENAMES[version];
  // 对 prerelease 版本，取 major.minor 匹配
  const base = version.split('-')[0];
  if (CODENAMES[base]) return CODENAMES[base];
  return '';
}

// ---- 版本卡片颜色方案 ----
function getVersionColor(version: string): {
  badge: string;
  bg: string;
  border: string;
  dot: string;
} {
  const major = Number(version.split('.')[0]);
  switch (major) {
    case 3:
      return {
        badge: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
        bg: 'bg-blue-50/50 dark:bg-blue-950/20',
        border: 'border-blue-200 dark:border-blue-800',
        dot: 'bg-blue-500',
      };
    case 2:
      return {
        badge: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
        bg: 'bg-purple-50/50 dark:bg-purple-950/20',
        border: 'border-purple-200 dark:border-purple-800',
        dot: 'bg-purple-500',
      };
    default:
      return {
        badge: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
        bg: 'bg-gray-50/50 dark:bg-gray-800/20',
        border: 'border-gray-200 dark:border-gray-700',
        dot: 'bg-gray-400',
      };
  }
}

// ---- 版本卡片组件 ----
function VersionCard({
  version,
  date,
  highlights,
  isCurrent,
  isExpanded,
  onToggle,
}: {
  version: string;
  date: string;
  highlights: string[];
  isCurrent: boolean;
  isExpanded: boolean;
  onToggle: () => void;
}) {
  const codename = getCodename(version);
  const colors = getVersionColor(version);
  const isPrerelease = version.includes('-');

  return (
    <div
      className={`rounded-xl border transition-all duration-200 ${
        isExpanded
          ? `${colors.border} ${colors.bg} shadow-sm`
          : 'border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:shadow-sm'
      }`}
    >
      {/* 卡片头部 */}
      <button
        onClick={onToggle}
        className="w-full px-5 py-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3 flex-wrap min-w-0">
          {/* 版本号 badge */}
          <span
            className={`font-mono font-bold text-sm px-2.5 py-1 rounded-lg ${colors.badge}`}
          >
            v{version}
          </span>

          {/* 当前版本标记 */}
          {isCurrent && (
            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2 py-0.5 rounded-full bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300">
              <CheckCircle2 className="w-3 h-3" />
              当前版本
            </span>
          )}

          {/* 预发布标记 */}
          {isPrerelease && (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300">
              Pre-release
            </span>
          )}

          {/* 代号 */}
          {codename && (
            <span className="inline-flex items-center gap-1 text-[11px] text-gray-500 dark:text-gray-400">
              <Tag className="w-3 h-3" />
              {codename}
            </span>
          )}

          {/* 日期 */}
          <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
            <Calendar className="w-3 h-3" />
            {date}
          </span>
        </div>

        {/* 展开/收起图标 */}
        <div className="shrink-0 ml-3">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </button>

      {/* 收起状态：显示 highlights 标签 */}
      {!isExpanded && (
        <div className="px-5 pb-3 flex flex-wrap gap-1.5">
          {highlights.slice(0, 4).map((h) => (
            <span
              key={h}
              className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-400 truncate max-w-[180px]"
            >
              {h}
            </span>
          ))}
          {highlights.length > 4 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-500">
              +{highlights.length - 4}
            </span>
          )}
        </div>
      )}

      {/* 展开状态：详细列表 */}
      {isExpanded && (
        <div className="px-5 pb-5 pt-1">
          <div className="border-t border-gray-100 dark:border-gray-800 pt-4">
            <h4 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wider mb-3">
              更新亮点
            </h4>
            <ul className="space-y-2">
              {highlights.map((h) => (
                <li key={h} className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-green-500 mt-0.5 shrink-0" />
                  <span className="text-sm text-gray-700 dark:text-gray-300 leading-relaxed">
                    {h}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

// ---- 主页面 ----
export default function ReleasesPage() {
  const [expandedVersion, setExpandedVersion] = useState<string | null>(APP_VERSION);
  const groups = useMemo(() => groupByMajor(VERSION_HISTORY), []);

  const toggleVersion = (version: string) => {
    setExpandedVersion((prev) => (prev === version ? null : version));
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Hero */}
      <div className="bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 text-white">
        <div className="max-w-5xl mx-auto px-6 py-16">
          <div className="flex items-center gap-4 mb-6">
            <div className="h-14 w-14 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center">
              <BookOpen className="w-8 h-8" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">版本变更记录</h1>
              <p className="text-blue-200 text-sm">
                当前版本 v{APP_VERSION} &middot; {APP_CODENAME}
              </p>
            </div>
          </div>
          <p className="text-xl text-blue-100 max-w-2xl leading-relaxed">
            AI Task Hub 的完整版本演进历程，从 v1.0.0 首次发布到 v3.0.0 内核架构重构，
            记录每一次重要更新与改进。
          </p>
          <div className="flex gap-3 mt-8">
            <a
              href="https://github.com/arwei944/ai-task-hub"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 rounded-lg text-sm font-medium transition-colors backdrop-blur"
            >
              <Star className="w-4 h-4" />
              GitHub
              <ExternalLink className="w-3 h-3" />
            </a>
            <a
              href="/about"
              className="inline-flex items-center gap-2 px-4 py-2 bg-white/15 hover:bg-white/25 rounded-lg text-sm font-medium transition-colors backdrop-blur"
            >
              <Rocket className="w-4 h-4" />
              关于项目
            </a>
          </div>
        </div>
      </div>

      {/* 统计概览 */}
      <div className="max-w-5xl mx-auto px-6 -mt-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">{VERSION_HISTORY.length}</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">总版本数</div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">3</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">大版本迭代</div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">162+</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">MCP 工具</div>
          </div>
          <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 text-center shadow-sm">
            <div className="text-2xl font-bold text-amber-600 dark:text-amber-400">1936</div>
            <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">测试用例</div>
          </div>
        </div>
      </div>

      {/* 版本列表 */}
      <div className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        {groups.map((group) => (
          <section key={group.major}>
            {/* 分组标题 */}
            <div className="flex items-center gap-3 mb-5">
              <div className={`w-3 h-3 rounded-full ${getVersionColor(`${group.major}.0.0`).dot}`} />
              <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                {group.label}
              </h2>
              <span className="text-xs text-gray-400 dark:text-gray-500">
                {group.versions.length} 个版本
              </span>
              <div className="flex-1 border-t border-gray-200 dark:border-gray-800" />
            </div>

            {/* 版本卡片列表 */}
            <div className="space-y-3">
              {group.versions.map((v) => (
                <VersionCard
                  key={v.version}
                  version={v.version}
                  date={v.date}
                  highlights={v.highlights}
                  isCurrent={v.version === APP_VERSION}
                  isExpanded={expandedVersion === v.version}
                  onToggle={() => toggleVersion(v.version)}
                />
              ))}
            </div>
          </section>
        ))}

        {/* Footer */}
        <section className="text-center py-8 border-t border-gray-200 dark:border-gray-800">
          <p className="text-xs text-gray-400 dark:text-gray-500">
            完整变更记录请查看{' '}
            <a
              href="https://github.com/arwei944/ai-task-hub/releases"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-500 hover:text-blue-600 dark:text-blue-400 dark:hover:text-blue-300 inline-flex items-center gap-1"
            >
              GitHub Releases
              <ExternalLink className="w-3 h-3" />
            </a>
          </p>
        </section>
      </div>
    </div>
  );
}
