'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Role } from '@/lib/types';
import { saveReceipt } from '@/lib/receipts';

export type Prefill = {
  name: string;
  email: string;
  phone: string;
  age: number | null;
  introduction: string;
  photoUrl: string;
  videoUrl: string;
  skill: string;
  unavailable: boolean;
};

export default function ApplyForm({
  role,
  prefill,
  proposalId,
}: {
  role: Role;
  prefill: Prefill | null;
  proposalId: string;
}) {
  const [step, setStep] = useState<'brief' | 'form'>('brief');
  const home = prefill ? '/me' : '/actor';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [online, setOnline] = useState(true);
  const closed = role.isClosed || role.deadline < new Date().toISOString().slice(0, 10);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  function begin() {
    setStep('form');
    window.scrollTo({ top: 0, behavior: 'smooth' });
    void fetch('/api/applications', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ roleSlug: role.slug }),
    });
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError('');
    if (!navigator.onLine) {
      setError(
        '연결이 끊겼습니다. 입력 내용은 화면에 남아 있습니다. 다시 연결한 뒤 제출해 주세요.',
      );
      return;
    }
    setBusy(true);
    const body = Object.fromEntries(new FormData(event.currentTarget).entries());
    try {
      const response = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...body, roleSlug: role.slug, proposalId }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '접수하지 못했습니다.');
      saveReceipt({
        token: data.receiptToken,
        name: String(body.name || ''),
        projectTitle: role.projectTitle,
        roleTitle: role.title,
        submittedAt: new Date().toISOString(),
      });
      location.href = `/status/${data.receiptToken}`;
    } catch (reason) {
      setError(
        reason instanceof Error ? reason.message : '접수하지 못했습니다. 다시 시도해 주세요.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell applicant-shell">
      <header className="apply-header">
        <Link href={home} className="apply-brand" style={{ color: 'inherit' }}>
          <svg width="19" height="19" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
            <path d="M20.2 5.6 4.9 3.4l.5-1.8a1 1 0 0 1 1.2-.7l14.6 2.2a1 1 0 0 1 .8 1.2l-.4 1.6a1 1 0 0 1-1.4.3Zm.3 2.9H3.5A1.5 1.5 0 0 0 2 10v9a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-9a1.5 1.5 0 0 0-1.5-1.5Z" />
          </svg>
          Casting Swipe
        </Link>
        <Link href={home} className="text-button">
          {prefill ? '내 홈' : '배역 목록'}
        </Link>
      </header>
      {!online && (
        <div className="offline-banner" role="status">
          오프라인 상태입니다. 지원서를 제출할 수 없습니다.
        </div>
      )}
      {step === 'brief' ? (
        <div className="apply-content">
          <div className="apply-cover">
            <span className="cover-kicker">CASTING CALL</span>
            <span className="cover-star">✦</span>
            <div>
              <p>{role.projectTitle}</p>
              <h1>{role.title}</h1>
            </div>
          </div>
          <div className="apply-intro">
            <span className="role-state">{closed ? '지원 마감' : '지원 접수 중'}</span>
            <h2>
              이 배역에
              <br />
              함께해 주세요
            </h2>
            <p>{role.description}</p>
          </div>
          <section className="brief-card">
            <h3>촬영과 지원 조건</h3>
            <div>
              <span>촬영일</span>
              <strong>{role.shootDate}</strong>
            </div>
            <div>
              <span>촬영 지역</span>
              <strong>{role.location}</strong>
            </div>
            <div>
              <span>출연료</span>
              <strong>{role.pay}</strong>
            </div>
            <div>
              <span>필수 조건</span>
              <strong>{role.requirement || '별도 조건 없음'}</strong>
            </div>
            <div>
              <span>지원 마감</span>
              <strong>{role.deadline}</strong>
            </div>
            <div>
              <span>결과 안내 예정</span>
              <strong>{role.announcementDate}</strong>
            </div>
          </section>
          <p className="small-note">
            담당: {role.contactName} · 지원 후 접수 상태를 확인할 수 있습니다.
          </p>
          <button
            className="button button-primary full sticky-action"
            onClick={begin}
            disabled={closed}
          >
            {closed ? '지원이 마감되었습니다' : '이 배역에 지원하기'}
          </button>
        </div>
      ) : (
        <div className="apply-content">
          <button className="back-link" onClick={() => setStep('brief')}>
            ← 배역 정보
          </button>
          <p className="eyebrow">
            {role.projectTitle} · {role.title}
          </p>
          <h1 className="form-heading">지원서 작성</h1>
          <p className="muted">
            {prefill
              ? '프로필 정보로 미리 채워 두었어요. 이 배역에 맞게 수정한 뒤 참여 조건만 답해 주세요.'
              : '연락 가능한 정보와 연기 자료를 남겨 주세요. 제출 후 수정이 필요하면 제작팀에 문의해 주세요.'}
          </p>
          <form className="application-form" onSubmit={submit}>
            <div className="form-section-title">
              기본 정보 <span>01 / 03</span>
            </div>
            <label>
              이름 <em>필수</em>
              <input
                name="name"
                required
                maxLength={80}
                autoComplete="name"
                defaultValue={prefill?.name}
                placeholder="본명을 입력해 주세요"
              />
            </label>
            <div className="form-two">
              <label>
                나이
                <input
                  name="age"
                  type="number"
                  min="1"
                  max="120"
                  inputMode="numeric"
                  defaultValue={prefill?.age ?? undefined}
                  placeholder="선택"
                />
              </label>
              <label>
                연락처 <em>필수</em>
                <input
                  name="phone"
                  type="tel"
                  required
                  autoComplete="tel"
                  defaultValue={prefill?.phone}
                  placeholder="010-0000-0000"
                />
              </label>
            </div>
            <label>
              이메일 <em>필수</em>
              <input
                name="email"
                type="email"
                required
                autoComplete="email"
                defaultValue={prefill?.email}
                placeholder="example@email.com"
              />
            </label>
            <div className="form-section-title">
              프로필과 자료 <span>02 / 03</span>
            </div>
            <label>
              소개와 연기 경험 <em>필수</em>
              <textarea
                name="introduction"
                required
                rows={5}
                maxLength={2000}
                defaultValue={prefill?.introduction}
                placeholder="출연작, 연기 경험, 이 배역에 전하고 싶은 내용을 적어 주세요"
              />
            </label>
            <label>
              사진 링크
              <input
                name="photoUrl"
                inputMode="url"
                defaultValue={prefill?.photoUrl}
                placeholder="https://... (선택)"
              />
              <small>공유 가능한 프로필 사진 링크를 넣어 주세요.</small>
            </label>
            <label>
              연기 영상 링크 <em>필수</em>
              <input
                name="videoUrl"
                type="url"
                inputMode="url"
                required
                defaultValue={prefill?.videoUrl}
                placeholder="https://..."
              />
              <small>유튜브, 비메오 또는 공유 가능한 영상 링크</small>
            </label>
            <label>
              필수 역량 또는 특기
              <input
                name="skill"
                maxLength={300}
                defaultValue={prefill?.skill}
                placeholder="예: 자연스러운 대화 연기"
              />
            </label>
            <div className="form-section-title">
              참여 조건 <span>03 / 03</span>
            </div>
            <label>
              촬영일에 참여할 수 있나요? <em>필수</em>
              {prefill?.unavailable && (
                <small className="warn">프로필에 이 촬영일을 출연 불가로 등록해 두셨어요.</small>
              )}
              <select name="available" required defaultValue="">
                <option value="" disabled>
                  선택해 주세요
                </option>
                <option value="yes">가능</option>
                <option value="no">불가</option>
                <option value="unsure">일정 조율 필요</option>
              </select>
            </label>
            <label>
              촬영 지역으로 이동할 수 있나요? <em>필수</em>
              <select name="travel" required defaultValue="">
                <option value="" disabled>
                  선택해 주세요
                </option>
                <option value="yes">가능</option>
                <option value="no">불가</option>
                <option value="unsure">확인 필요</option>
              </select>
            </label>
            <label>
              출연료 조건을 확인했나요? <em>필수</em>
              <select name="payAccepted" required defaultValue="">
                <option value="" disabled>
                  선택해 주세요
                </option>
                <option value="yes">확인하고 수용함</option>
                <option value="no">조건이 맞지 않음</option>
                <option value="unsure">문의가 필요함</option>
              </select>
            </label>
            <p className="small-note">
              지원 내용은 해당 배역의 제작진이 검토합니다. 접수 링크는 제출 후 이 기기에서 보관해
              주세요.
            </p>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <button className="button button-primary full" type="submit" disabled={busy || !online}>
              {busy ? '접수 중…' : '지원서 제출하기'}
            </button>
          </form>
        </div>
      )}
    </main>
  );
}
