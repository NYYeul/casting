'use client';

import { useState } from 'react';

const DEMOS = [
  { key: 'producer', label: '🎬 제작자로 체험하기', email: 'producer@demo.casting', home: '/studio' },
  { key: 'actor', label: '🎭 배우로 체험하기', email: 'actor01@demo.casting', home: '/me' },
];

export function DemoEntry({ caption = '가입 없이 데모로 둘러보기' }: { caption?: string }) {
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');

  // 체험용 배포(NEXT_PUBLIC_DEMO_MODE=true)에서만 보인다.
  if (process.env.NEXT_PUBLIC_DEMO_MODE !== 'true') return null;

  async function enter(email: string, home: string) {
    setBusy(email);
    setError('');
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password: 'demo1234' }),
      });
      if (!response.ok) {
        setError('데모 계정이 준비되지 않았어요. SEED_DEMO 설정을 확인해 주세요.');
        setBusy('');
        return;
      }
      location.href = home;
    } catch {
      setError('연결에 실패했어요. 잠시 후 다시 시도해 주세요.');
      setBusy('');
    }
  }

  return (
    <div className="demo-entry">
      <span className="demo-caption">{caption}</span>
      <div className="demo-row">
        {DEMOS.map((demo) => (
          <button
            key={demo.key}
            className="button button-outline"
            onClick={() => enter(demo.email, demo.home)}
            disabled={!!busy}
          >
            {busy === demo.email ? '입장 중…' : demo.label}
          </button>
        ))}
      </div>
      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}
