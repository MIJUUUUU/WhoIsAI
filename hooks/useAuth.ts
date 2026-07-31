'use client';

import { useCallback, useEffect, useState } from 'react';
import type { Models } from 'appwrite';
import { getCurrentUser, loginWithGoogle, logout as appwriteLogout } from '@/lib/appwrite';

export function useAuth() {
  const [user, setUser] = useState<Models.User<Models.Preferences> | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    setUser(await getCurrentUser());
  }, []);

  useEffect(() => {
    let cancelled = false;
    getCurrentUser().then((u) => {
      if (!cancelled) {
        setUser(u);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback((redirectTo?: string) => loginWithGoogle(redirectTo), []);

  const logout = useCallback(async () => {
    await appwriteLogout();
    setUser(null);
  }, []);

  return { user, loading, login, logout, refresh };
}
