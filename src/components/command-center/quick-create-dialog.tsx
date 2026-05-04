'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';
import { useToast } from '@/components/ui/toast';

interface QuickCreateDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated?: () => void;
}

export function QuickCreateDialog({ open, onClose, onCreated }: QuickCreateDialogProps) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('medium');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { success, error: toastError } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    try {
      setIsSubmitting(true);
      await trpc.projectHub.projects.create.mutate({
        name: name.trim(),
        description: description.trim() || undefined,
        priority: priority as any,
      });
      setName('');
      setDescription('');
      setPriority('medium');
      onCreated?.();
      success('项目已创建', `「${name.trim()}」已添加到指挥中心`);
      onClose();
    } catch (err) {
      toastError('创建失败', '项目创建时发生错误');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center" onClick={onClose}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-md rounded-xl border bg-card p-6 shadow-xl"
        onClick={e => e.stopPropagation()}
      >
        <h2 className="text-lg font-semibold mb-4">快速创建项目</h2>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">项目名称 <span className="text-red-500">*</span></label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="输入项目名称..."
              className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">描述</label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="简要描述项目..."
              rows={2}
              className="w-full px-3 py-2 text-sm rounded-lg border bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium mb-1.5">优先级</label>
            <div className="flex gap-2">
              {[
                { value: 'low', label: '低', color: 'bg-gray-500' },
                { value: 'medium', label: '中', color: 'bg-yellow-500' },
                { value: 'high', label: '高', color: 'bg-orange-500' },
                { value: 'urgent', label: '紧急', color: 'bg-red-500' },
              ].map(p => (
                <button
                  key={p.value}
                  type="button"
                  onClick={() => setPriority(p.value)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-all ${
                    priority === p.value
                      ? 'border-primary bg-primary/5 text-primary'
                      : 'border-muted hover:border-muted-foreground/30'
                  }`}
                >
                  <span className={`w-2 h-2 rounded-full ${p.color}`} />
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border hover:bg-muted transition-colors"
            >
              取消
            </button>
            <button
              type="submit"
              disabled={!name.trim() || isSubmitting}
              className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isSubmitting ? '创建中...' : '创建'}
            </button>
          </div>
        </form>

        <p className="text-[10px] text-muted-foreground mt-3">按 Esc 关闭 · ⌘N 快速创建</p>
      </div>
    </div>
  );
}
