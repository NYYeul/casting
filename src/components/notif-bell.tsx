'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { BrandIcon, type BrandIconName } from './brand';

// 알림 아이콘 중 브랜드 3D 아이콘이 있는 것은 이미지로 보여 준다.
const ICON_IMAGES: Record<string, BrandIconName> = {
  '✨': 'sparkle',
  '✦': 'sparkle',
  '⚡': 'bolt',
  '👥': 'team',
  '🎬': 'clapper',
  '🎭': 'masks',
};

type FeedItem = { id: string; icon: string; text: string; href: string; at: string };
type Feed = { items: FeedItem[]; badge: number };

function timeAgo(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return '방금 전';
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}일 전`;
  return new Date(iso).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
}

export function NotifBell() {
  const router = useRouter();
  const [feed, setFeed] = useState<Feed>({ items: [], badge: 0 });
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let alive = true;
    async function load() {
      try {
        const res = await fetch('/api/activity', { cache: 'no-store' });
        if (!res.ok) return;
        const data = (await res.json()) as Feed;
        if (alive) setFeed(data);
      } catch {
        /* 폴링 실패는 무시 */
      }
    }
    void load();
    const timer = setInterval(load, 30_000);
    return () => {
      alive = false;
      clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    function onDown(event: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', onDown);
    return () => document.removeEventListener('mousedown', onDown);
  }, [open]);

  return (
    <div className="notif-wrap" ref={wrapRef}>
      <button
        className="bell-btn"
        aria-label={feed.badge > 0 ? `새 알림 ${feed.badge}건` : '알림'}
        onClick={() => setOpen((value) => !value)}
      >
        <svg
          width="22"
          height="22"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          aria-hidden
        >
          <path
            d="M6 9.5a6 6 0 1 1 12 0c0 4 1.5 5.5 2.3 6.3H3.7C4.5 15 6 13.5 6 9.5Z"
            strokeLinejoin="round"
          />
          <path d="M10 19a2 2 0 0 0 4 0" strokeLinecap="round" />
        </svg>
        {feed.badge > 0 && <span className="dot pulse">{Math.min(feed.badge, 9)}</span>}
      </button>
      {open && (
        <div className="notif-panel" role="dialog" aria-label="알림">
          <div className="notif-head">
            <strong>알림</strong>
            {feed.badge > 0 && <span className="badge-soft">새 소식 {feed.badge}</span>}
          </div>
          {feed.items.length === 0 ? (
            <p className="notif-empty">아직 새 소식이 없어요.</p>
          ) : (
            feed.items.map((item) => (
              <button
                key={item.id}
                className="notif-item"
                onClick={() => {
                  setOpen(false);
                  router.push(item.href);
                }}
              >
                <span className="notif-icon">
                  {ICON_IMAGES[item.icon] ? (
                    <BrandIcon name={ICON_IMAGES[item.icon]} size={20} />
                  ) : (
                    item.icon
                  )}
                </span>
                <span className="notif-text">{item.text}</span>
                <small>{timeAgo(item.at)}</small>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
