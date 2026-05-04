'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Brain } from 'lucide-react';
import { ThemeToggle } from './theme-toggle';
import { LanguageSwitcher } from './language-switcher';
import { getSidebarItems } from '@/config/navigation';

export default function Sidebar() {
  const pathname = usePathname();
  const sidebarItems = getSidebarItems();

  const isActive = (href: string) =>
    pathname === href || (href !== '/' && pathname.startsWith(href));

  return (
    <aside
      className="hidden md:flex flex-col h-screen sticky top-0 w-[60px] bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-gray-800"
      role="navigation"
      aria-label="Main navigation"
    >
      {/* Logo */}
      <div className="flex flex-col items-center justify-center h-14 border-b border-gray-200 dark:border-gray-800 shrink-0">
        <Brain className="w-5 h-5 text-blue-600 dark:text-blue-400" />
        <span className="text-[10px] font-bold text-gray-900 dark:text-gray-100 mt-0.5">
          AI
        </span>
      </div>

      {/* Nav icons */}
      <div className="flex-1 flex flex-col items-center py-3 gap-1">
        {sidebarItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              title={item.label}
              className={`flex items-center justify-center w-10 h-10 rounded-lg transition-colors ${
                active
                  ? 'bg-blue-100 text-blue-600 dark:bg-blue-950 dark:text-blue-400'
                  : 'text-gray-400 hover:bg-gray-100 hover:text-gray-600 dark:text-gray-500 dark:hover:bg-gray-800 dark:hover:text-gray-300'
              }`}
            >
              <Icon className="w-5 h-5" strokeWidth={1.8} />
            </Link>
          );
        })}
      </div>

      {/* Footer: theme + language */}
      <div className="shrink-0 border-t border-gray-200 dark:border-gray-800 flex flex-col items-center py-3 gap-2">
        <div className="flex items-center justify-center w-10 h-10">
          <ThemeToggle />
        </div>
        <div className="flex items-center justify-center w-10 h-10">
          <LanguageSwitcher />
        </div>
      </div>
    </aside>
  );
}
