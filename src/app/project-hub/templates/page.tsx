// ============================================================
// Templates Page - /project-hub/templates
// ============================================================
//
// Template gallery with category filters, built-in templates,
// and user-created templates.
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  LayoutTemplate,
  Code2,
  Smartphone,
  Palette,
  Star,
  Users,
  Save,
  RefreshCw,
} from 'lucide-react';

// ---- Types ----

interface TemplateItem {
  id: string;
  name: string;
  description: string;
  category: string;
  icon: string;
  isBuiltIn: boolean;
  isPublic: boolean;
  usageCount: number;
  rating: number;
  ratingCount: number;
  createdAt: string;
}

// ---- Category tabs ----

const categories = [
  { key: 'all', label: '全部' },
  { key: 'software', label: '软件开发' },
  { key: 'product', label: '产品设计' },
  { key: 'marketing', label: '市场营销' },
  { key: 'custom', label: '自定义' },
];

// ---- Color classes for categories ----

const categoryColorClasses: Record<string, { bg: string; text: string; border: string }> = {
  software: {
    bg: 'bg-blue-100 dark:bg-blue-950',
    text: 'text-blue-600 dark:text-blue-400',
    border: 'border-blue-200 dark:border-blue-800',
  },
  product: {
    bg: 'bg-violet-100 dark:bg-violet-950',
    text: 'text-violet-600 dark:text-violet-400',
    border: 'border-violet-200 dark:border-violet-800',
  },
  marketing: {
    bg: 'bg-rose-100 dark:bg-rose-950',
    text: 'text-rose-600 dark:text-rose-400',
    border: 'border-rose-200 dark:border-rose-800',
  },
  custom: {
    bg: 'bg-amber-100 dark:bg-amber-950',
    text: 'text-amber-600 dark:text-amber-400',
    border: 'border-amber-200 dark:border-amber-800',
  },
};

function getCategoryColors(category: string) {
  return categoryColorClasses[category] || categoryColorClasses.software;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          className={`w-3 h-3 ${i < rating ? 'text-amber-400 fill-amber-400' : 'text-gray-300 dark:text-gray-600'}`}
        />
      ))}
    </div>
  );
}

// ---- Component ----

export default function TemplatesPage() {
  const [activeCategory, setActiveCategory] = useState('all');
  const [templates, setTemplates] = useState<TemplateItem[]>([]);
  const [builtInTemplates, setBuiltInTemplates] = useState<TemplateItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchTemplates = useCallback(async (category: string) => {
    try {
      setIsLoading(true);
      const data = await trpc.projectHub.templates.list.query({
        ...(category !== 'all' ? { category } : {}),
      });
      setTemplates(data as unknown as TemplateItem[]);
    } catch (err) {
      console.error('Failed to fetch templates:', err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const fetchBuiltInTemplates = useCallback(async () => {
    try {
      const data = await trpc.projectHub.templates.builtIn.query();
      setBuiltInTemplates(data as unknown as TemplateItem[]);
    } catch (err) {
      console.error('Failed to fetch built-in templates:', err);
    }
  }, []);

  const fetchAll = useCallback(async (category: string) => {
    await Promise.allSettled([fetchTemplates(category), fetchBuiltInTemplates()]);
  }, [fetchTemplates, fetchBuiltInTemplates]);

  useEffect(() => {
    fetchAll(activeCategory);
  }, [activeCategory, fetchAll]);

  const templateList = templates;
  const builtInList = builtInTemplates;

  const displayTemplates = activeCategory === 'all'
    ? [...builtInList, ...templateList.filter(t => !t.isBuiltIn)]
    : templateList;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">模板中心</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            从预置模板快速创建项目，或将现有项目保存为模板
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchAll(activeCategory)}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            刷新
          </Button>
          <Button size="sm">
            <Save className="w-3.5 h-3.5 mr-1.5" />
            保存为模板
          </Button>
        </div>
      </div>

      {/* Category filter tabs */}
      <div className="flex items-center gap-1.5">
        {categories.map((cat) => (
          <button
            key={cat.key}
            onClick={() => setActiveCategory(cat.key)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              activeCategory === cat.key
                ? 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                : 'text-gray-500 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Template cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <div className="animate-pulse space-y-3">
                  <div className="h-10 w-10 bg-gray-200 dark:bg-gray-700 rounded-lg" />
                  <div className="h-5 w-32 bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-4 w-full bg-gray-200 dark:bg-gray-700 rounded" />
                  <div className="h-4 w-24 bg-gray-200 dark:bg-gray-700 rounded" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : displayTemplates.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <LayoutTemplate className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
            <p className="text-sm text-gray-400">暂无模板</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {displayTemplates.map((template) => {
            const colors = getCategoryColors(template.category);

            return (
              <Card
                key={template.id}
                className={`hover:shadow-md transition-shadow ${colors.border}`}
              >
                <CardHeader className="pb-3">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center text-xl`}>
                      {template.icon || (
                        template.category === 'software' ? <Code2 className={`w-5 h-5 ${colors.text}`} /> :
                        template.category === 'product' ? <Palette className={`w-5 h-5 ${colors.text}`} /> :
                        <LayoutTemplate className={`w-5 h-5 ${colors.text}`} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <CardTitle className="text-base truncate">{template.name}</CardTitle>
                      <div className="flex items-center gap-2 mt-0.5">
                        {template.isBuiltIn && (
                          <Badge variant="outline" className="text-[10px]">内置</Badge>
                        )}
                        {template.isPublic && (
                          <Badge variant="outline" className="text-[10px]">公开</Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">
                    {template.description || '暂无描述'}
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <StarRating rating={template.rating} />
                      <span className="text-xs text-gray-400">{template.ratingCount} 评价</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs text-gray-400">
                      <Users className="w-3 h-3" />
                      {template.usageCount} 次使用
                    </div>
                  </div>
                  <Button variant="outline" size="sm" className="w-full">
                    <LayoutTemplate className="w-3.5 h-3.5 mr-1.5" />
                    使用模板
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
