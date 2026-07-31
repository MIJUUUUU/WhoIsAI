'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { account } from '@/lib/appwrite';

function CallbackHandler() {
  const params = useSearchParams();
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const userId = params.get('userId');
    const secret = params.get('secret');

    if (params.get('error') || !userId || !secret) {
      // URL 쿼리(외부 리다이렉트 결과)를 반영하는 것이므로 effect 내 setState가 맞다.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError(`로그인에 실패했습니다. 쿼리: ${params.toString() || '(비어있음)'}`);
      return;
    }

    const redirect = params.get('redirect');
    // 오픈 리다이렉트 방지: 우리 앱 내부 경로("/"로 시작)만 허용
    const destination = redirect && redirect.startsWith('/') ? redirect : '/';

    account
      .createSession({ userId, secret })
      .then(() => router.replace(destination))
      .catch((err) => setError(`로그인에 실패했습니다: ${err?.message || err}`));
  }, [params, router]);

  if (error) {
    return (
      <p className="text-sm text-neutral-500">
        {error}{' '}
        <Link href="/" className="text-emerald-400 underline">
          로비로 돌아가기
        </Link>
      </p>
    );
  }

  return <p className="text-sm text-neutral-500">로그인 처리 중...</p>;
}

export default function AuthCallbackPage() {
  return (
    <main className="flex flex-1 items-center justify-center">
      <Suspense fallback={<p className="text-sm text-neutral-500">로그인 처리 중...</p>}>
        <CallbackHandler />
      </Suspense>
    </main>
  );
}
