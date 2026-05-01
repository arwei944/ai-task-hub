'use client';

import { useState, useEffect, useCallback } from 'react';
import { MessageSquare, CheckCircle, XCircle, Clock, Star, AlertTriangle, ChevronRight } from 'lucide-react';

interface FeedbackCheckpoint {
  id: string;
  executionId: string;
  stepId: string;
  stepName: string;
  stepType: string;
  checkpointType: string;
  status: string;
  approvalMode: string;
  intervention?: string;
  rating?: number;
  feedback?: string;
  createdAt: Date;
  resolvedAt?: string;
}

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: any }> = {
  pending: { label: '待处理', color: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-300', icon: Clock },
  approved: { label: '已批准', color: 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300', icon: CheckCircle },
  rejected: { label: '已拒绝', color: 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300', icon: XCircle },
  skipped: { label: '已跳过', color: 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300', icon: Clock },
  modified: { label: '已修改', color: 'bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300', icon: AlertTriangle },
  timeout_expired: { label: '已超时', color: 'bg-orange-100 text-orange-700 dark:bg-orange-900 dark:text-orange-300', icon: Clock },
};

export default function FeedbackPage() {
  const [checkpoints, setCheckpoints] = useState<FeedbackCheckpoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'pending' | 'all'>('pending');
  const [selectedCheckpoint, setSelectedCheckpoint] = useState<FeedbackCheckpoint | null>(null);

  const fetchCheckpoints = useCallback(async () => {
    try {
      setLoading(true);
      // Phase A: 直接用 Prisma 查询（通过 tRPC）
      const res = await fetch('/api/trpc/feedback.listCheckpoints?input=%7B%7D');
      const data = await res.json();
      setCheckpoints(data?.result?.data?.items ?? []);
    } catch (err) {
      console.error('Failed to fetch checkpoints:', err);
      setCheckpoints([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchCheckpoints(); }, [fetchCheckpoints]);

  const pendingCount = checkpoints.filter(c => c.status === 'pending').length;
  const filteredCheckpoints = activeTab === 'pending'
    ? checkpoints.filter(c => c.status === 'pending')
    : checkpoints;

  const handleApprove = async (id: string) => {
    try {
      await fetch('/api/trpc/feedback.handleApproval?input=' + encodeURIComponent(JSON.stringify({ checkpointId: id, action: 'approved' })), { method: 'POST' });
      fetchCheckpoints();
      setSelectedCheckpoint(null);
    } catch (err) {
      console.error('Failed to approve:', err);
    }
  };

  const handleReject = async (id: string) => {
    try {
      await fetch('/api/trpc/feedback.handleApproval?input=' + encodeURIComponent(JSON.stringify({ checkpointId: id, action: 'rejected' })), { method: 'POST' });
      fetchCheckpoints();
      setSelectedCheckpoint(null);
    } catch (err) {
      console.error('Failed to reject:', err);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">反馈中心</h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">监督和干预 SOLO 的每一步执行</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={`text-sm px-3 py-1 rounded-full ${pendingCount > 0 ? 'bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300' : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'}`}>
              {pendingCount > 0 ? `${pendingCount} 待处理` : '全部已处理'}
            </span>
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab('pending')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'pending' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}
          >
            待处理 {pendingCount > 0 && `(${pendingCount})`}
          </button>
          <button
            onClick={() => setActiveTab('all')}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${activeTab === 'all' ? 'bg-blue-600 text-white' : 'bg-white dark:bg-gray-900 text-gray-700 dark:text-gray-300 border border-gray-200 dark:border-gray-700'}`}
          >
            全部
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-12 text-center text-gray-400">
            加载中...
          </div>
        ) : filteredCheckpoints.length === 0 ? (
          <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800 p-12 text-center">
            <MessageSquare className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
            <p className="text-gray-400 text-lg">{activeTab === 'pending' ? '暂无待处理项' : '暂无反馈记录'}</p>
            <p className="text-gray-400 text-sm mt-1">当 SOLO 执行工作流时，反馈检查点将出现在这里</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filteredCheckpoints.map((cp) => {
              const config = STATUS_CONFIG[cp.status] ?? STATUS_CONFIG.pending;
              const Icon = config.icon;
              const isSelected = selectedCheckpoint?.id === cp.id;

              return (
                <div
                  key={cp.id}
                  onClick={() => setSelectedCheckpoint(isSelected ? null : cp)}
                  className={`bg-white dark:bg-gray-900 rounded-xl shadow-sm border cursor-pointer transition-all ${isSelected ? 'border-blue-500 ring-2 ring-blue-100 dark:ring-blue-900' : 'border-gray-200 dark:border-gray-800 hover:border-gray-300 dark:hover:border-gray-700'}`}
                >
                  <div className="p-4 flex items-center gap-4">
                    <Icon className={`w-5 h-5 shrink-0 ${cp.status === 'pending' ? 'text-yellow-500' : ''}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-gray-900 dark:text-gray-100">{cp.stepName}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400">{cp.stepType}</span>
                        <span className={`text-xs px-2 py-0.5 rounded-full ${config.color}`}>{config.label}</span>
                      </div>
                      <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                        {cp.checkpointType === 'pre_execute' ? '执行前检查' : '执行后检查'} · {new Date(cp.createdAt).toLocaleString()}
                      </p>
                      {cp.intervention && (
                        <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">{cp.intervention}</p>
                      )}
                    </div>
                    {cp.status === 'pending' && (
                      <div className="flex items-center gap-2 shrink-0" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleApprove(cp.id)}
                          className="px-3 py-1.5 text-xs font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                        >
                          批准
                        </button>
                        <button
                          onClick={() => handleReject(cp.id)}
                          className="px-3 py-1.5 text-xs font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                        >
                          拒绝
                        </button>
                      </div>
                    )}
                    <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
