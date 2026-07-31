'use client';

import { useState } from 'react';
import type { Models } from 'appwrite';
import { setPersistentNickname } from '@/lib/appwrite';
import { generateRandomNickname } from '@/worker/names';

// 로그인 리다이렉트가 로비가 아니라 방으로 곧장 돌아오는 경우에도 닉네임 설정을 놓치지 않도록
// 로비/방 페이지 양쪽에서 공용으로 쓴다.
export function useNicknameSetup(user: Models.User<Models.Preferences> | null, authLoading: boolean, refresh: () => Promise<void>) {
  const [nicknameSuggestion] = useState(() => generateRandomNickname());

  const needsNickname = !authLoading && !!user && !(user.prefs as { nickname?: string }).nickname;

  async function handleSetNickname(nickname: string) {
    await setPersistentNickname(nickname);
    await refresh();
  }

  return { needsNickname, nicknameSuggestion, handleSetNickname };
}
