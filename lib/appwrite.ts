'use client';

import { Client, Account, OAuthProvider } from 'appwrite';

const client = new Client()
  .setEndpoint(process.env.NEXT_PUBLIC_APPWRITE_ENDPOINT!)
  .setProject(process.env.NEXT_PUBLIC_APPWRITE_PROJECT_ID!);

export const account = new Account(client);
export { OAuthProvider };

// redirectTo: 로그인 완료 후 돌아갈 경로 (예: 초대 링크로 들어온 방). 없으면 로비로.
export function loginWithGoogle(redirectTo?: string) {
  const base = window.location.origin;
  const back = redirectTo ? `?redirect=${encodeURIComponent(redirectTo)}` : '';
  account.createOAuth2Token({
    provider: OAuthProvider.Google,
    success: `${base}/auth/callback${back}`,
    failure: `${base}/auth/callback${back ? back + '&' : '?'}error=1`,
  });
}

export async function logout() {
  await account.deleteSession({ sessionId: 'current' });
}

export async function getCurrentUser() {
  try {
    return await account.get();
  } catch {
    return null;
  }
}

// 방 생성/입장 시 서버에 신원을 증명하기 위한 단기 JWT (로그인 상태가 아니면 null).
export async function getGameJwt(): Promise<string | null> {
  try {
    const jwtPromise = account.createJWT();
    const timeoutPromise = new Promise<never>((_, reject) =>
      window.setTimeout(() => reject(new Error('JWT request timeout')), 10000)
    );
    const { jwt } = await Promise.race([jwtPromise, timeoutPromise]);
    return jwt;
  } catch {
    return null;
  }
}

// 대기실에서 보일 닉네임을 계정에 저장 (본인 계정이라 서버 없이 클라이언트에서 직접 가능).
export async function setPersistentNickname(nickname: string): Promise<void> {
  const { jwt } = await account.createJWT();
  const res = await fetch('/api/nickname', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jwt, nickname }),
  });
  const data = (await res.json()) as { error?: string };
  if (!res.ok) throw new Error(data.error || '닉네임 저장에 실패했습니다.');
}
