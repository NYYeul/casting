'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import type { ChatMessage } from '@/lib/types';

function slotLabel(slot: string) {
  const date = new Date(`${slot}:00+09:00`);
  if (Number.isNaN(date.valueOf())) return slot;
  const day = date.toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'numeric',
    day: 'numeric',
  });
  const dow = date.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', weekday: 'short' });
  const time = date.toLocaleTimeString('ko-KR', {
    timeZone: 'Asia/Seoul',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  return `${day} (${dow}) ${time}`;
}
function dateHeading(day: string) {
  return new Date(`${day}T00:00:00+09:00`).toLocaleDateString('ko-KR', {
    timeZone: 'Asia/Seoul',
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
}
function timeOnly(slot: string) {
  return slot.slice(11, 16);
}

const Svg = {
  pin: (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path
        d="M12 21s-6.5-5.4-6.5-10.5a6.5 6.5 0 1 1 13 0C18.5 15.6 12 21 12 21Z"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="10.3" r="2.2" />
    </svg>
  ),
  doc: (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <path d="M6 3h8l4 4v14H6V3Z" strokeLinejoin="round" />
      <path d="M14 3v4h4M9 12h6M9 16h6" strokeLinecap="round" />
    </svg>
  ),
  calendar: (
    <svg
      width="17"
      height="17"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      aria-hidden
    >
      <rect x="3.5" y="5" width="17" height="16" rx="3" />
      <path d="M8 3v4M16 3v4M3.5 10h17" strokeLinecap="round" />
    </svg>
  ),
  info: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      aria-hidden
    >
      <circle cx="12" cy="12" r="9" />
      <path d="M12 10.5V17M12 7.2v.3" strokeLinecap="round" />
    </svg>
  ),
  check: (
    <svg
      width="13"
      height="13"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      aria-hidden
    >
      <path d="m4.5 12.5 5 5 10-11" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  ),
};

export default function OfferResponse({
  applicationId,
  receipt,
  offer,
}: {
  applicationId: string;
  receipt: string;
  offer: ChatMessage;
}) {
  const router = useRouter();
  const [picked, setPicked] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  async function respond(action: 'select' | 'decline' | 'request_change', selectedSlot = '') {
    if (!navigator.onLine) {
      setError('연결이 끊겼습니다. 응답이 저장되지 않았습니다.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      const response = await fetch(`/api/chat/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId: offer.id, action, selectedSlot, receipt }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '응답을 저장하지 못했습니다.');
      router.refresh();
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '응답을 저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  const days = offer.slots.reduce<Record<string, string[]>>((acc, slot) => {
    const day = slot.slice(0, 10);
    (acc[day] ||= []).push(slot);
    return acc;
  }, {});

  if (offer.status === 'sent')
    return (
      <section className="sched-section">
        <h2>가능한 시간을 선택해주세요</h2>
        {Object.entries(days).map(([day, times]) => (
          <div key={day} style={{ marginBottom: 14 }}>
            <p className="sched-date">{dateHeading(day)}</p>
            <p className="sched-hint">제작진이 제안한 오디션 시간입니다.</p>
            <div className="slot-row">
              {times.map((slot) => (
                <button
                  key={slot}
                  className={`slot-btn${picked === slot ? ' on' : ''}`}
                  onClick={() => setPicked(slot)}
                >
                  {timeOnly(slot)}
                  {picked === slot && Svg.check}
                </button>
              ))}
            </div>
          </div>
        ))}
        <p className="info-line">{Svg.info} 선택한 일정에 참여 가능 여부만 공유됩니다.</p>
        <div className="info-card">
          <span className="ic-tile">{Svg.pin}</span>
          <div>
            <strong>{offer.place}</strong>
            <span>상세 안내는 대화에서 확인해 주세요</span>
          </div>
        </div>
        {offer.preparation && (
          <div className="info-card">
            <span className="ic-tile">{Svg.doc}</span>
            <div>
              <strong>준비 자료</strong>
              <span>{offer.preparation}</span>
            </div>
          </div>
        )}
        <div className="sel-card">
          <span className="ic-tile">{Svg.calendar}</span>
          <div>
            <span>선택한 일정</span>
            <strong>{picked ? slotLabel(picked) : '시간을 선택해 주세요'}</strong>
          </div>
        </div>
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button
          className="button button-primary full"
          disabled={busy || !picked}
          onClick={() => void respond('select', picked)}
        >
          이 일정으로 확정하기
        </button>
        <button
          className="link-center"
          disabled={busy}
          onClick={() => void respond('request_change')}
        >
          다른 일정 요청
        </button>
        <button
          className="link-center subtle"
          disabled={busy}
          onClick={() => void respond('decline')}
        >
          참석이 어렵습니다
        </button>
      </section>
    );

  if (offer.status === 'selected')
    return (
      <section className="sched-section">
        <h2>오디션 일정</h2>
        <div className="sel-card">
          <span className="ic-tile">{Svg.calendar}</span>
          <div>
            <span>선택한 일정 · 제작자 확정 대기</span>
            <strong>{slotLabel(offer.selectedSlot)}</strong>
          </div>
        </div>
        <div className="info-card">
          <span className="ic-tile">{Svg.pin}</span>
          <div>
            <strong>{offer.place}</strong>
            <span>확정되면 이 화면과 대화에 표시됩니다</span>
          </div>
        </div>
      </section>
    );

  if (offer.status === 'confirmed')
    return (
      <section className="sched-section">
        <h2>오디션 일정</h2>
        <div className="sel-card">
          <span className="ic-tile">{Svg.calendar}</span>
          <div>
            <span>확정된 일정</span>
            <strong>{slotLabel(offer.selectedSlot)}</strong>
          </div>
        </div>
        <div className="info-card">
          <span className="ic-tile">{Svg.pin}</span>
          <div>
            <strong>{offer.place}</strong>
            <span>상세 안내는 대화에서 확인해 주세요</span>
          </div>
        </div>
        {offer.preparation && (
          <div className="info-card">
            <span className="ic-tile">{Svg.doc}</span>
            <div>
              <strong>준비 자료</strong>
              <span>{offer.preparation}</span>
            </div>
          </div>
        )}
      </section>
    );

  return (
    <section className="sched-section">
      <h2>오디션 일정</h2>
      <div className="empty-card" style={{ margin: 0 }}>
        {offer.status === 'change_requested'
          ? '다른 시간을 요청했습니다. 새 제안을 기다려 주세요.'
          : '참석 어려움을 전달했습니다.'}
      </div>
    </section>
  );
}
