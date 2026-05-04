'use client';

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/lib/trpc/client';
import { Breadcrumb } from '@/components/layout/breadcrumb';
import {
  Shield,
  UserCheck,
  UserX,
  RefreshCw,
  Search,
  Users,
} from 'lucide-react';

type Role = 'admin' | 'user' | 'agent';

interface UserRecord {
  id: string;
  username: string;
  displayName?: string | null;
  role: Role;
  isActive: boolean;
  createdAt: string;
  lastLoginAt?: string | null;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const data = await trpc.auth.listUsers.query({});
      setUsers((data as unknown as UserRecord[]) ?? []);
    } catch (err) {
      console.error('Failed to fetch users:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const filteredUsers = users.filter((u) =>
    u.username.toLowerCase().includes(search.toLowerCase()) ||
    (u.displayName ?? '').toLowerCase().includes(search.toLowerCase())
  );

  const handleToggleUser = async (userId: string) => {
    const user = users.find(u => u.id === userId);
    if (!user) return;
    setActionLoading(userId);
    try {
      await trpc.auth.toggleUser.mutate({ userId, isActive: !user.isActive });
      await fetchUsers();
    } catch (err) {
      console.error('Failed to toggle user:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const handleUpdateRole = async (userId: string, newRole: Role) => {
    setActionLoading(userId);
    try {
      await trpc.auth.updateRole.mutate({ userId, role: newRole });
      await fetchUsers();
    } catch (err) {
      console.error('Failed to update role:', err);
    } finally {
      setActionLoading(null);
    }
  };

  const roleBadge = (role: Role) => {
    const colors: Record<Role, string> = {
      admin: 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300',
      user: 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300',
      agent: 'bg-purple-100 text-purple-700 dark:bg-purple-950 dark:text-purple-300',
    };
    const labels: Record<Role, string> = { admin: '管理员', user: '用户', agent: '智能体' };
    return (
      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${colors[role]}`}>
        {labels[role]}
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <Breadcrumb />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-100 dark:bg-blue-950">
            <Shield className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">用户管理</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">管理系统用户、角色和权限</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-gray-400">
            共 {users.length} 位用户
          </span>
          <button
            onClick={fetchUsers}
            disabled={loading}
            className="p-2 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
            title="刷新"
          >
            <RefreshCw className={`w-4 h-4 text-gray-500 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索用户名或显示名..."
          className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 text-sm text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>

      {/* User Table */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 dark:bg-gray-800/50">
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">用户</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">角色</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">状态</th>
              <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-gray-400">创建时间</th>
              <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-gray-400">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
            {loading ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin" />
                  加载中...
                </td>
              </tr>
            ) : filteredUsers.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  <Users className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  {search ? '未找到匹配用户' : '暂无用户'}
                </td>
              </tr>
            ) : (
              filteredUsers.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/30">
                  <td className="px-4 py-3">
                    <div>
                      <div className="font-medium text-gray-900 dark:text-gray-100">{user.displayName || user.username}</div>
                      <div className="text-xs text-gray-400">@{user.username}</div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={user.role}
                      onChange={(e) => handleUpdateRole(user.id, e.target.value as Role)}
                      disabled={actionLoading === user.id}
                      className="text-xs rounded-md border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900 px-2 py-1"
                    >
                      <option value="admin">管理员</option>
                      <option value="user">用户</option>
                      <option value="agent">智能体</option>
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center gap-1 text-xs ${user.isActive ? 'text-green-600 dark:text-green-400' : 'text-gray-400'}`}>
                      {user.isActive ? <UserCheck className="w-3 h-3" /> : <UserX className="w-3 h-3" />}
                      {user.isActive ? '活跃' : '已禁用'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-gray-400 text-xs">
                    {new Date(user.createdAt).toLocaleDateString('zh-CN')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleToggleUser(user.id)}
                      disabled={actionLoading === user.id}
                      className={`p-1.5 rounded-lg transition-colors ${
                        user.isActive
                          ? 'text-red-500 hover:bg-red-50 dark:hover:bg-red-950'
                          : 'text-green-500 hover:bg-green-50 dark:hover:bg-green-950'
                      }`}
                      title={user.isActive ? '禁用用户' : '启用用户'}
                    >
                      {user.isActive ? <UserX className="w-4 h-4" /> : <UserCheck className="w-4 h-4" />}
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
