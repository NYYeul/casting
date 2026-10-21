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
      {/*
        로그인하지 않고 지원한 내역. 접수 링크가 이 브라우저에만 남아 있어서
        계정에 묶이는 '내 지원 현황'(/me)과는 다르다는 걸 제목에서 구분해 준다.
      */}
      <div className="section-head" style={{ marginTop: 0 }}>
        <h2>이 기기에서 지원한 내역</h2>
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
