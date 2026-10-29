'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { Application, ReviewStatus } from '@/lib/types';
import { reviewLabels } from '@/lib/types';
import { useBackClose } from '@/lib/use-back-close';

/** 카드를 넘긴 방향. 오른쪽 = 관심, 왼쪽 = 보류, 위 = 오디션 후보 */
type Direction = 'right' | 'left' | 'up';
type Patch = { status: ReviewStatus; shortlist?: boolean };

// 오디션 후보에 넣으면 관심으로도 분류한다(지원자 상세의 '오디션 후보' 버튼과 같은 규칙).
const PATCHES: Record<Direction, Patch> = {
  right: { status: 'interested' },
  left: { status: 'hold' },
  up: { status: 'interested', shortlist: true },
};
const STAMPS: Record<Direction, string> = { right: '관심', left: '보류', up: '오디션 후보' };
/** 이만큼(px) 넘게 끌면 카드를 넘긴 것으로 본다 */
const THRESHOLD = 90;
const LEAVE_MS = 220;

function directionOf(dx: number, dy: number): Direction | null {
  if (dy < -THRESHOLD && Math.abs(dy) > Math.abs(dx)) return 'up';
  if (dx > THRESHOLD) return 'right';
  if (dx < -THRESHOLD) return 'left';
  return null;
}

function conditionLabel(value: string) {
  return value === 'yes' ? '가능' : value === 'no' ? '불가' : '미확인';
}

/**
 * 지원자를 카드 한 장씩 넘기며 검토한다(기획서의 '빠른 검토').
 * 들어올 때의 목록(deckIds)을 순서대로 보여 주고, 검토하는 동안 상태가 바뀌어도 카드가 빠지지 않는다.
 * 저장은 기존 PATCH /api/applications/[id]를 쓰고, 바로 직전 한 장은 되돌릴 수 있다.
 */
export default function SwipeReview({
  deckIds,
  applications,
  roleTitle,
  save,
  onOpenDetail,
  onClose,
}: {
  deckIds: string[];
  applications: Application[];
  roleTitle: string;
  /** 저장에 성공하면 true. 실패 안내는 부르는 쪽이 한다. */
  save: (id: string, patch: Patch) => Promise<boolean>;
  onOpenDetail: (id: string) => void;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(0);
  const [last, setLast] = useState<{ id: string; prev: Patch; index: number } | null>(null);
  const [drag, setDrag] = useState({ dx: 0, dy: 0, active: false });
  const [leaving, setLeaving] = useState<Direction | null>(null);
  const [photoAt, setPhotoAt] = useState(0);
  const start = useRef<{ x: number; y: number; id: number } | null>(null);
  const moved = useRef(false);

  // 휴대폰 뒤로가기로 카드 검토를 닫는다.
  useBackClose(true, onClose);

  const byId = (id: string) => applications.find((item) => item.id === id);
  const current = index < deckIds.length ? byId(deckIds[index]) : undefined;
  const next = index + 1 < deckIds.length ? byId(deckIds[index + 1]) : undefined;
  const photos = current
    ? current.photoUrls.length
      ? current.photoUrls
      : current.photoUrl
        ? [current.photoUrl]
        : []
    : [];

  useEffect(() => setPhotoAt(0), [index]);

  const decide = useCallback(
    (direction: Direction) => {
      if (!current || leaving) return;
      const at = index;
      const prev: Patch = { status: current.status, shortlist: current.shortlist };
      setLeaving(direction);
      setLast({ id: current.id, prev, index: at });
      window.setTimeout(() => {
        setIndex(at + 1);
        setLeaving(null);
        setDrag({ dx: 0, dy: 0, active: false });
      }, LEAVE_MS);
      void save(current.id, PATCHES[direction]).then((ok) => {
        if (ok) return;
        // 저장하지 못한 카드는 다시 앞으로 꺼낸다.
        setIndex(at);
        setLast(null);
      });
    },
    [current, index, leaving, save],
  );

  const undo = useCallback(() => {
    if (!last || leaving) return;
    const target = last;
    setLast(null);
    setIndex(target.index);
    void save(target.id, target.prev);
  }, [last, leaving, save]);

  // 큰 화면에서는 방향키로도 넘긴다. ←보류 →관심 ↑후보, Backspace·Z 되돌리기
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowRight') decide('right');
      else if (event.key === 'ArrowLeft') decide('left');
      else if (event.key === 'ArrowUp') decide('up');
      else if (event.key === 'Backspace' || event.key.toLowerCase() === 'z') undo();
      else return;
      event.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [decide, undo]);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (leaving) return;
    start.current = { x: event.clientX, y: event.clientY, id: event.pointerId };
    moved.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    setDrag({ dx: 0, dy: 0, active: true });
  }
  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    if (!start.current || start.current.id !== event.pointerId) return;
    const dx = event.clientX - start.current.x;
    const dy = event.clientY - start.current.y;
    if (Math.abs(dx) > 6 || Math.abs(dy) > 6) moved.current = true;
    setDrag({ dx, dy, active: true });
  }
  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    if (!start.current || start.current.id !== event.pointerId) return;
    start.current = null;
    const direction = directionOf(drag.dx, drag.dy);
    if (direction) {
      decide(direction);
      return;
    }
    setDrag({ dx: 0, dy: 0, active: false });
    // 끌지 않고 톡 누르면 사진을 넘긴다(왼쪽 1/3은 이전, 나머지는 다음).
    if (!moved.current && photos.length > 1) {
      const box = event.currentTarget.getBoundingClientRect();
      const back = event.clientX - box.left < box.width / 3;
      setPhotoAt((at) => (at + (back ? photos.length - 1 : 1)) % photos.length);
    }
  }

  const hint = leaving ?? directionOf(drag.dx, drag.dy);
  const strength = Math.min(1, Math.max(Math.abs(drag.dx), -drag.dy, 0) / THRESHOLD);
  const leaveOffset: Record<Direction, string> = {
    right: 'translate(140%, 0) rotate(18deg)',
    left: 'translate(-140%, 0) rotate(-18deg)',
    up: 'translate(0, -130%)',
  };
  const transform = leaving
    ? leaveOffset[leaving]
    : `translate(${drag.dx}px, ${drag.dy}px) rotate(${drag.dx / 18}deg)`;
  const done = index >= deckIds.length;

  return (
    <div className="swipe-review" role="dialog" aria-modal="true" aria-label="카드로 검토">
      <header className="swipe-top">
        <button className="swipe-close" onClick={onClose} aria-label="카드 검토 닫기">
          ×
        </button>
        <div className="swipe-title">
          <strong>카드로 검토</strong>
          <span>{roleTitle}</span>
        </div>
        <span className="swipe-count">
          {Math.min(index + 1, deckIds.length)} / {deckIds.length}
        </span>
      </header>
      <div
        className="swipe-progress"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={deckIds.length}
        aria-valuenow={index}
      >
        <i style={{ width: `${(index / Math.max(1, deckIds.length)) * 100}%` }} />
      </div>

      <div className="swipe-stage">
        {done ? (
          <div className="swipe-done">
            <strong>모두 검토했어요</strong>
            <p>
              {deckIds.length}명을 분류했어요. 목록에서 관심·보류·후보 필터로 다시 볼 수 있어요.
            </p>
            {last && (
              <button className="button button-outline" onClick={undo}>
                ↺ 마지막 카드 되돌리기
              </button>
            )}
            <button className="button button-primary" onClick={onClose}>
              목록으로
            </button>
          </div>
        ) : (
          <>
            {next && (
              <div className="swipe-card is-next" aria-hidden>
                <CardPhoto app={next} url={next.photoUrls[0] || next.photoUrl} />
              </div>
            )}
            {current && (
              <div
                key={current.id}
                className={`swipe-card${drag.active ? ' is-dragging' : ''}`}
                style={{ transform, opacity: leaving ? 0 : 1 }}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={() => {
                  start.current = null;
                  setDrag({ dx: 0, dy: 0, active: false });
                }}
              >
                <CardPhoto app={current} url={photos[photoAt]} />
                {photos.length > 1 && (
                  <div className="swipe-dots" aria-label={`사진 ${photoAt + 1}/${photos.length}`}>
                    {photos.map((url, at) => (
                      <i key={url} className={at === photoAt ? 'on' : ''} />
                    ))}
                  </div>
                )}
                {hint && (
                  <span
                    className={`swipe-stamp stamp-${hint}`}
                    style={{ opacity: leaving ? 1 : strength }}
                  >
                    {STAMPS[hint]}
                  </span>
                )}
                <div className="swipe-info">
                  <div className="swipe-name">
                    <strong>
                      {current.name} <small>{current.age ? current.age : ''}</small>
                    </strong>
                    <span className={`status-chip chip-${current.status}`}>
                      {reviewLabels[current.status]}
                    </span>
                    {current.shortlist && <span className="swipe-star">★ 후보</span>}
                  </div>
                  <p>{current.introduction}</p>
                  <div className="swipe-meta">
                    <span className={current.available === 'yes' ? 'positive' : ''}>
                      촬영 {conditionLabel(current.available)}
                    </span>
                    <span>이동 {conditionLabel(current.travel)}</span>
                    <span>{current.videoUrl ? '영상 있음' : '영상 없음'}</span>
                  </div>
                  <button
                    className="swipe-more"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={() => onOpenDetail(current.id)}
                  >
                    지원서 자세히 ›
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {!done && (
        <div className="swipe-actions">
          <button
            className="swipe-btn undo"
            onClick={undo}
            disabled={!last || Boolean(leaving)}
            aria-label="되돌리기"
            title="되돌리기 (한 장)"
          >
            ↺<small>되돌리기</small>
          </button>
          <button
            className="swipe-btn hold"
            onClick={() => decide('left')}
            disabled={Boolean(leaving)}
          >
            ←<small>보류</small>
          </button>
          <button
            className="swipe-btn short"
            onClick={() => decide('up')}
            disabled={Boolean(leaving)}
          >
            ★<small>오디션 후보</small>
          </button>
          <button
            className="swipe-btn like"
            onClick={() => decide('right')}
            disabled={Boolean(leaving)}
          >
            →<small>관심</small>
          </button>
        </div>
      )}
    </div>
  );
}

function CardPhoto({ app, url }: { app: Application; url?: string }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!url || failed === url)
    return <div className="swipe-photo swipe-initials">{app.name.slice(-2)}</div>;
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className="swipe-photo"
      src={url}
      alt={`${app.name} 사진`}
      draggable={false}
      onError={() => setFailed(url)}
    />
  );
}
