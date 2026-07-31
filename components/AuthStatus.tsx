'use client';

import { useAuth } from '@/hooks/useAuth';

export default function AuthStatus() {
  const { user, loading, login, logout } = useAuth();

  if (loading) return <div className="h-8" />;

  if (user) {
    return (
      <div className="flex items-center gap-2 text-sm">
        <span className="text-neutral-400">{user.name || user.email}</span>
        <button onClick={logout} className="rounded-lg bg-neutral-800 px-3 py-1 hover:bg-neutral-700">
          로그아웃
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 text-sm">
      <button onClick={() => login()} className="rounded-lg bg-neutral-800 px-3 py-1 hover:bg-neutral-700">
        구글 로그인
      </button>
    </div>
  );
}
