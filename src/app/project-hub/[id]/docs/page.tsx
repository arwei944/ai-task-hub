// ============================================================
// Document Management Page - /project-hub/[id]/docs
// ============================================================
//
// Two-panel document management with tree view and editor.
// ============================================================

'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { trpc } from '@/lib/trpc/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  FileText,
  FolderOpen,
  Plus,
  Search,
  RefreshCw,
  ChevronRight,
  History,
  Save,
  Trash2,
} from 'lucide-react';

// ---- Types ----

interface DocItem {
  id: string;
  title: string;
  docType: string;
  status: string;
  parentDocId: string | null;
  sortOrder: number;
  tags: string[];
  updatedAt: string;
}

interface DocDetail {
  id: string;
  title: string;
  content: string;
  docType: string;
  status: string;
  tags: string[];
  version: number;
  updatedAt: string;
}

interface VersionItem {
  id: string;
  version: number;
  changeLog: string;
  createdAt: string;
  createdBy: string;
}

// ---- Helpers ----

const docTypeLabels: Record<string, string> = {
  general: '通用',
  requirement: '需求',
  design: '设计',
  meeting_notes: '会议记录',
  api_doc: 'API 文档',
  decision_log: '决策日志',
};

function buildDocTree(docs: DocItem[]): (DocItem & { children: DocItem[] })[] {
  const map = new Map<string, DocItem & { children: DocItem[] }>();
  const roots: (DocItem & { children: DocItem[] })[] = [];

  for (const doc of docs) {
    map.set(doc.id, { ...doc, children: [] });
  }

  for (const doc of docs) {
    const node = map.get(doc.id)!;
    if (doc.parentDocId && map.has(doc.parentDocId)) {
      map.get(doc.parentDocId)!.children.push(node);
    } else {
      roots.push(node);
    }
  }

  // Sort by sortOrder
  const sort = (items: (DocItem & { children: DocItem[] })[]) => {
    items.sort((a, b) => a.sortOrder - b.sortOrder);
    items.forEach(item => sort(item.children as (DocItem & { children: DocItem[] })[]));
  };
  sort(roots as (DocItem & { children: DocItem[] })[]);

  return roots;
}

// ---- Component ----

export default function DocsManagementPage() {
  const params = useParams();
  const projectId = params.id as string;

  const [selectedDocId, setSelectedDocId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingContent, setEditingContent] = useState('');
  const [docs, setDocs] = useState<DocItem[]>([]);
  const [selectedDoc, setSelectedDoc] = useState<DocDetail | null>(null);
  const [versions, setVersions] = useState<VersionItem[]>([]);
  const [docsLoading, setDocsLoading] = useState(true);
  const [docLoading, setDocLoading] = useState(false);

  const fetchDocs = useCallback(async () => {
    try {
      setDocsLoading(true);
      const data = await trpc.projectHub.docs.list.query({ projectId });
      setDocs(data as unknown as DocItem[]);
    } catch (err) {
      console.error('Failed to fetch docs:', err);
    } finally {
      setDocsLoading(false);
    }
  }, [projectId]);

  const fetchSelectedDoc = useCallback(async (docId: string) => {
    try {
      setDocLoading(true);
      const data = await trpc.projectHub.docs.get.query({ id: docId });
      setSelectedDoc(data as unknown as DocDetail | null);
    } catch (err) {
      console.error('Failed to fetch doc detail:', err);
    } finally {
      setDocLoading(false);
    }
  }, []);

  const fetchVersions = useCallback(async (docId: string) => {
    try {
      const data = await trpc.projectHub.docs.versions.query({ docId });
      setVersions(data as unknown as VersionItem[]);
    } catch (err) {
      console.error('Failed to fetch versions:', err);
    }
  }, []);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  useEffect(() => {
    if (selectedDocId) {
      fetchSelectedDoc(selectedDocId);
      fetchVersions(selectedDocId);
    } else {
      setSelectedDoc(null);
      setVersions([]);
    }
  }, [selectedDocId, fetchSelectedDoc, fetchVersions]);

  const docsList = docs;
  const docDetail = selectedDoc;
  const versionList = versions;
  const docTree = buildDocTree(docsList);

  const handleSelectDoc = (docId: string) => {
    setSelectedDocId(docId);
    setEditingContent('');
  };

  const handleContentChange = (value: string) => {
    setEditingContent(value);
  };

  const currentContent = editingContent || docDetail?.content || '';

  // ---- Render tree node ----
  const renderTreeNode = (node: DocItem & { children: DocItem[] }, depth: number = 0) => (
    <div key={node.id}>
      <button
        onClick={() => handleSelectDoc(node.id)}
        className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm rounded-md transition-colors ${
          selectedDocId === node.id
            ? 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
            : 'text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800'
        }`}
        style={{ paddingLeft: `${depth * 16 + 12}px` }}
      >
        {(node.children?.length ?? 0) > 0 ? (
          <FolderOpen className="w-4 h-4 text-amber-500 shrink-0" />
        ) : (
          <FileText className="w-4 h-4 text-gray-400 shrink-0" />
        )}
        <span className="truncate flex-1">{node.title}</span>
        {node.docType && (
          <Badge variant="outline" className="text-[10px] shrink-0">
            {docTypeLabels[node.docType] || node.docType}
          </Badge>
        )}
      </button>
      {(node.children ?? []).map((child: any) => renderTreeNode(child as DocItem & { children: DocItem[] }, depth + 1))}
    </div>
  );

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">项目文档</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
            管理项目文档、知识库和设计文档
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => fetchDocs()}>
            <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
            刷新
          </Button>
          <Button size="sm">
            <Plus className="w-3.5 h-3.5 mr-1.5" />
            新建文档
          </Button>
        </div>
      </div>

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <Input
          placeholder="搜索文档..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Two-panel layout */}
      <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-6">
        {/* Left panel - Doc tree */}
        <Card className="h-[600px] overflow-hidden flex flex-col">
          <CardHeader className="pb-3 shrink-0">
            <CardTitle className="text-sm font-medium">文档目录</CardTitle>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto pt-0">
            {docsLoading ? (
              <div className="space-y-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  <div key={i} className="animate-pulse h-8 bg-gray-100 dark:bg-gray-800 rounded" />
                ))}
              </div>
            ) : (docTree?.length ?? 0) === 0 ? (
              <p className="text-sm text-gray-400 py-8 text-center">暂无文档</p>
            ) : (
              <div className="space-y-0.5">
                {(docTree ?? []).map(node => renderTreeNode(node))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Right panel - Doc content */}
        <div className="space-y-4">
          <Card className="h-[480px] overflow-hidden flex flex-col">
            <CardHeader className="pb-3 shrink-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium">
                  {docDetail?.title || '选择一个文档查看内容'}
                </CardTitle>
                {docDetail && (
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px]">
                      v{docDetail.version}
                    </Badge>
                    <Button variant="ghost" size="sm">
                      <Save className="w-3.5 h-3.5 mr-1" />
                      保存
                    </Button>
                    <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-600">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="flex-1 overflow-y-auto pt-0">
              {docLoading ? (
                <div className="animate-pulse h-full bg-gray-100 dark:bg-gray-800 rounded" />
              ) : !docDetail ? (
                <div className="flex items-center justify-center h-full text-gray-400">
                  <div className="text-center">
                    <FileText className="w-12 h-12 mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                    <p className="text-sm">从左侧选择文档查看内容</p>
                  </div>
                </div>
              ) : (
                <textarea
                  value={currentContent}
                  onChange={(e) => handleContentChange(e.target.value)}
                  className="w-full h-full min-h-[360px] p-4 text-sm font-mono bg-gray-50 dark:bg-gray-900 border border-gray-200 dark:border-gray-800 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Markdown 内容..."
                />
              )}
            </CardContent>
          </Card>

          {/* Version history */}
          {selectedDocId && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-sm font-medium">
                  <History className="w-4 h-4 text-gray-400" />
                  版本历史
                </CardTitle>
              </CardHeader>
              <CardContent>
                {(versionList?.length ?? 0) === 0 ? (
                  <p className="text-sm text-gray-400 py-2 text-center">暂无版本记录</p>
                ) : (
                  <div className="space-y-2">
                    {(versionList ?? []).map((ver) => (
                      <div
                        key={ver.id}
                        className="flex items-center justify-between py-2 px-3 rounded-md hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
                      >
                        <div className="flex items-center gap-2">
                          <Badge variant="outline" className="text-[10px]">v{ver.version}</Badge>
                          <span className="text-xs text-gray-500">{ver.changeLog || '无变更说明'}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-gray-400">{ver.createdBy}</span>
                          <span className="text-xs text-gray-400">{ver.createdAt}</span>
                          <Button variant="ghost" size="sm" className="text-xs h-6">
                            恢复
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
