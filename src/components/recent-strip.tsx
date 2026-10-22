'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { loadRecent, type RecentItem } from '@/lib/recent';

/**
 * '최근 본' 가로 목록. 기록이 없으면 아무것도 그리지 않는다.
 * 저장된 값은 브라우저에만 있어서 서버에서 미리 그릴 수 없으므로 화면이 뜬 뒤에 읽는다.
 */
export default function RecentStrip({
  storageKey,
  title,
  unit = '개',
}: {
  storageKey: string;
  title: string;
  unit?: string;
}) {
  const [items, setItems] = useState<RecentItem[] | null>(null);
  useEffect(() => setItems(loadRecent(storageKey)), [storageKey]);
  if (!items || items.length === 0) return null;
  return (
    <>
      <div className="section-head">
        <h2>{title}</h2>
        <span className="muted" style={{ fontSize: 12 }}>
          {items.length}
          {unit}
        </span>
      </div>
      <div className="actor-strip">
        {items.map((item) => (
          <Link key={item.id} href={item.href} className="actor-card">
            <div className="photo">
              {item.photo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={item.photo} alt="" loading="lazy" />
              ) : (
                item.name.slice(-2)
              )}
            </div>
            <strong>{item.name}</strong>
            <span>{item.sub}</span>
          </Link>
        ))}
      </div>
    </>
  );
}
