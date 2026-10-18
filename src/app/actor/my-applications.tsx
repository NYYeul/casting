'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { loadReceipts, type SavedReceipt } from '@/lib/receipts';

export default function MyApplications() {
  const [items, setItems] = useState<SavedReceipt[] | null>(null);
  useEffect(() => setItems(loadReceipts()), []);
  if (!items || items.length === 0) return null;
  return (
    <>
      <div className="section-head" style={{ marginTop: 0 }}>
        <h2>내 지원</h2>
      </div>
      {items.map((item) => (
        <Link key={item.token} href={`/status/${item.token}`} className="audition-card">
          <span className="icon-tile">✓</span>
          <span className="txt">
            {item.projectTitle} · {item.roleTitle}
            <small>
              {item.name} ·{' '}
              {new Date(item.submittedAt).toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul' })}{' '}
              접수 · 진행 상황과 오디션 일정 보기
            </small>
          </span>
          <span className="chevron">›</span>
        </Link>
      ))}
    </>
  );
}
