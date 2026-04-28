'use client';

import { useState } from 'react';
import { trpc } from '@/lib/trpc/client';

export default function LoginPage() {
  const [isRegister, setIsRegister] = useState(false);
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessage(null);
    setLoading(true);

    try {
      if (isRegister) {
        const result = await trpc.auth.register.mutate({
          username,
          email,
          password,
          displayName: displayName || undefined,
        });
        localStorage.setItem('token', result.token);
        localStorage.setItem('user', JSON.stringify(result.user));
        setMessage({ type: 'success', text: '注册成功，正在跳转到仪表盘...' });
      } else {
        const result = await trpc.auth.login.mutate({
          username,
          password,
        });
        localStorage.setItem('token', result.token);
        localStorage.setItem('user', JSON.stringify(result.user));
        setMessage({ type: 'success', text: '登录成功，正在跳转到仪表盘...' });
      }
      // Delay redirect so user can see the success message
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 800);
    } catch (err: any) {
      setMessage({ type: 'error', text: err.message || '操作失败，请重试' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <div className="max-w-md w-full bg-white rounded-2xl shadow-lg p-8">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600 rounded-2xl mb-4">
            <span className="text-2xl">🧠</span>
          </div>
          <h1 className="text-2xl font-bold text-gray-900">AI Task Hub</h1>
          <p className="text-gray-500 mt-1">
            {isRegister ? '创建新账户' : '登录到你的账户'}
          </p>
        </div>

        {/* Message (success or error) */}
        {message && (
          <div
            className={`mb-4 p-3 rounded-lg text-sm flex items-center gap-2 ${
              message.type === 'success'
                ? 'bg-green-50 border border-green-200 text-green-700'
                : 'bg-red-50 border border-red-200 text-red-700'
            }`}
          >
            <span>{message.type === 'success' ? '✓' : '✗'}</span>
            {message.text}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">用户名</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              minLength={3}
              maxLength={32}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="请输入用户名"
            />
          </div>

          {isRegister && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="请输入邮箱"
              />
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">密码</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
              placeholder="请输入密码"
            />
          </div>

          {isRegister && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">显示名称（可选）</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                placeholder="请输入显示名称"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? '处理中...' : isRegister ? '注册' : '登录'}
          </button>
        </form>

        {/* Toggle */}
        <div className="mt-6 text-center text-sm text-gray-500">
          {isRegister ? (
            <>
              已有账户？{' '}
              <button
                onClick={() => { setIsRegister(false); setMessage(null); }}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                登录
              </button>
            </>
          ) : (
            <>
              没有账户？{' '}
              <button
                onClick={() => { setIsRegister(true); setMessage(null); }}
                className="text-blue-600 hover:text-blue-700 font-medium"
              >
                注册
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
