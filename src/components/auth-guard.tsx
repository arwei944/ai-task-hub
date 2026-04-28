'use client';

import { useEffect, useState } from 'react';
import { trpc } from '@/lib/trpc/client';

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const [checked, setChecked] = useState(false);
  const [valid, setValid] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      window.location.href = '/login';
      return;
    }
    // Verify token is still valid
    trpc.auth.me.query()
      .then(() => {
        setValid(true);
        setChecked(true);
      })
      .catch(() => {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = '/login';
      });
  }, []);

  if (!checked) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center text-gray-400">
        加载中...
      </div>
    );
  }

  if (!valid) return null;

  return <>{children}</>;
}
