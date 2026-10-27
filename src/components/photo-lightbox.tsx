'use client';

import { useCallback, useEffect, useState } from 'react';
import { useBackClose } from '@/lib/use-back-close';

/**
 * 사진을 화면에 꽉 차게 띄운다.
 * 예전에는 사진 주소를 새 탭으로 열어서 브라우저 기본 이미지 뷰어가 원본 크기로 보여 줬고,
 * 그래서 모바일에서는 사진이 작게 떴다.
 */
export default function PhotoLightbox({
  photos,
  startAt = 0,
  name,
  onClose,
}: {
  photos: string[];
  startAt?: number;
  name: string;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startAt);
  const [failed, setFailed] = useState(false);
  const count = photos.length;
  // 휴대폰 뒤로가기는 사진만 닫고, 뒤에 열린 지원자 상세는 그대로 둔다.
  useBackClose(true, onClose);

  const move = useCallback(
    (step: number) => {
      if (count < 2) return;
      setFailed(false);
      setIndex((current) => (current + step + count) % count);
    },
    [count],
  );

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
      if (event.key === 'ArrowRight') move(1);
      if (event.key === 'ArrowLeft') move(-1);
    }
    document.addEventListener('keydown', onKey);
    // 뒤에 있는 목록이 같이 스크롤되지 않게 막는다.
    const { overflow } = document.body.style;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = overflow;
    };
  }, [move, onClose]);

  const url = photos[index];
  if (!url) return null;

  return (
    <div
      className="lightbox"
      role="dialog"
      aria-modal="true"
      aria-label={`${name} 프로필 사진`}
      onClick={onClose}
    >
      {/* 같은 사진을 크게 흐려 깔아 배경을 만든다 (인스타그램 보기와 같은 방식) */}
      {!failed && (
        <div
          className="lb-blur"
          style={{ backgroundImage: `url("${url.replace(/["\\]/g, '\\$&')}")` }}
        />
      )}
      <button className="lb-close" onClick={onClose} aria-label="사진 닫기">
        ×
      </button>
      {count > 1 && (
        <span className="lb-count">
          {index + 1} / {count}
        </span>
      )}
      {failed ? (
        <p className="lb-failed">
          사진을 불러오지 못했습니다.
          <a href={url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
            원본 주소로 열기 ↗
          </a>
        </p>
      ) : (
        <figure className="lb-card" onClick={(event) => event.stopPropagation()}>
          <figcaption className="lb-name">{name}</figcaption>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`${name} 프로필 사진 ${index + 1}`} onError={() => setFailed(true)} />
        </figure>
      )}
      {count > 1 && (
        <>
          <button
            className="lb-nav lb-prev"
            aria-label="이전 사진"
            onClick={(event) => {
              event.stopPropagation();
              move(-1);
            }}
          >
            ‹
          </button>
          <button
            className="lb-nav lb-next"
            aria-label="다음 사진"
            onClick={(event) => {
              event.stopPropagation();
              move(1);
            }}
          >
            ›
          </button>
        </>
      )}
      <p className="lb-hint">사진을 벗어난 곳을 누르거나 Esc를 누르면 닫혀요.</p>
    </div>
  );
}
