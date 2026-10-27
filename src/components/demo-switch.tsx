'use client';

import { useState } from 'react';

const OTHER = {
  producer: { label: '🎭 배우로 전환', email: 'actor01@demo.casting', home: '/me' },
  actor: { label: '🎬 제작자로 전환', email: 'producer@demo.casting', home: '/studio' },
} as const;

// 체험 모드에서 로그인한 채로 반대 역할로 바로 넘어가는 버튼.
export function DemoSwitch({ role }: { role: keyof typeof OTHER }) {
  const [busy, setBusy] = useState(false);
  const other = OTHER[role];

  async function switchRole() {
    setBusy(true);
    try {
      const response = await fetch('/api/auth', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: other.email, password: 'demo1234' }),
      });
      if (response.ok) {
        location.href = other.home;
        return;
      }
    } catch {
      // 아래에서 버튼을 다시 풀어 준다.
    }
    setBusy(false);
  }

  return (
    <button className="demo-switch" onClick={switchRole} disabled={busy}>
      {busy ? '전환 중…' : other.label}
    </button>
  );
}
