'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import ProducerNav from '@/components/producer-nav';

const GENRES = ['단편영화', '장편영화', '웹드라마', '숏폼', '광고', '뮤직비디오', '연극', '기타'];
const STEPS = ['기본 정보', '배역 정보', '일정·조건', '확인'];
// 수정 모드: 배역·지원 조건은 PATCH 범위 밖(지원 링크 관리에서 수정)이라 2단계만 사용
const EDIT_STEPS = ['기본 정보', '확인'];
const DRAFT_KEY = 'casting_project_draft';

type RoleDraft = { title: string; description: string; requirement: string };
type Draft = {
  title: string;
  genre: string;
  shootStart: string;
  shootEnd: string;
  location: string;
  description: string;
  roles: RoleDraft[];
  deadline: string;
  announcementDate: string;
  pay: string;
  contactName: string;
};

export type ProjectInitial = Pick<
  Draft,
  'title' | 'genre' | 'shootStart' | 'shootEnd' | 'location' | 'description'
>;

const blankRole = (): RoleDraft => ({ title: '', description: '', requirement: '' });

type Props = {
  contactName: string;
  /** 수정 모드: 프로젝트 id (없으면 신규 등록) */
  editId?: string;
  /** 수정 모드: 기존 프로젝트 값 */
  initial?: Partial<ProjectInitial>;
};

export default function ProjectWizard({ contactName, editId, initial }: Props) {
  const isEdit = Boolean(editId);
  const steps = isEdit ? EDIT_STEPS : STEPS;
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<Draft>({
    title: '',
    genre: '단편영화',
    shootStart: '',
    shootEnd: '',
    location: '',
    description: '',
    roles: [blankRole()],
    deadline: '',
    announcementDate: '',
    pay: '',
    contactName,
    ...initial,
  });
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (isEdit) return; // 수정 모드에서는 신규 등록 임시 저장을 불러오지 않는다
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) {
        setDraft((current) => ({ ...current, ...JSON.parse(saved) }));
        setNotice('임시 저장한 내용을 불러왔습니다.');
      }
    } catch {
      /* 손상된 임시 저장은 무시 */
    }
  }, [isEdit]);

  const set =
    (key: keyof Draft) =>
    (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
      setDraft((current) => ({ ...current, [key]: event.target.value }));
  const setRole = (index: number, key: keyof RoleDraft, value: string) =>
    setDraft((current) => ({
      ...current,
      roles: current.roles.map((role, i) => (i === index ? { ...role, [key]: value } : role)),
    }));

  function problem() {
    if (step === 0) {
      if (!draft.title.trim()) return '작품명을 입력해 주세요.';
      if (!draft.shootStart) return '촬영 시작일을 입력해 주세요.';
      if (draft.shootEnd && draft.shootEnd < draft.shootStart)
        return '촬영 종료일이 시작일보다 빠릅니다.';
      if (!draft.location.trim()) return '촬영 지역을 입력해 주세요.';
    }
    if (step === 1 && !isEdit) {
      const filled = draft.roles.filter((role) => role.title.trim() || role.description.trim());
      if (filled.length === 0) return '배역을 하나 이상 입력해 주세요.';
      if (filled.some((role) => !role.title.trim() || !role.description.trim()))
        return '배역명과 배역 설명을 모두 입력해 주세요.';
    }
    if (step === 2 && !isEdit) {
      if (!draft.deadline || !draft.announcementDate)
        return '지원 마감일과 결과 안내일을 입력해 주세요.';
      if (draft.announcementDate < draft.deadline)
        return '결과 안내일은 지원 마감일 이후여야 합니다.';
      if (!draft.pay.trim()) return '출연료·교통·식비 조건을 입력해 주세요.';
      if (!draft.contactName.trim()) return '담당자를 입력해 주세요.';
    }
    return '';
  }

  function saveDraft() {
    if (isEdit) return;
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
    setNotice('이 기기에 임시 저장했습니다.');
  }

  async function next() {
    const issue = problem();
    if (issue) {
      setError(issue);
      return;
    }
    setError('');
    if (step < steps.length - 1) {
      setStep(step + 1);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    setBusy(true);
    try {
      const response = await fetch('/api/projects', {
        method: isEdit ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: isEdit
          ? JSON.stringify({
              id: editId,
              title: draft.title,
              genre: draft.genre,
              shootStart: draft.shootStart,
              shootEnd: draft.shootEnd,
              location: draft.location,
              description: draft.description,
            })
          : JSON.stringify({
              ...draft,
              roles: draft.roles.filter((role) => role.title.trim()),
            }),
      });
      const data = await response.json();
      if (response.status === 401) {
        location.href = `/login?next=${isEdit ? `/studio/projects/${editId}/edit` : '/studio/projects/new'}`;
        return;
      }
      if (!response.ok)
        throw new Error(data.error || `프로젝트를 ${isEdit ? '수정' : '등록'}하지 못했습니다.`);
      if (!isEdit) localStorage.removeItem(DRAFT_KEY);
      location.href = '/studio?tab=applicants';
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : `프로젝트를 ${isEdit ? '수정' : '등록'}하지 못했습니다.`,
      );
      setBusy(false);
    }
  }

  return (
    <main className="app-shell wide">
      <ProducerNav active="new-project" />
      <div className="screen-pad page-top">
        <Link className="back-link" href="/studio">
          ‹ 프로젝트
        </Link>
        <div className="wizard-shell">
          <ol className="wizard-steps vertical">
            {steps.map((label, index) => (
              <li key={label} className={index === step ? 'on' : index < step ? 'done' : ''}>
                <b>{index < step ? '✓' : index + 1}</b>
                <span>{label}</span>
              </li>
            ))}
          </ol>
          <section className="wizard-panel">
            <h1 className="page-title" style={{ marginBottom: 6 }}>
              {isEdit ? '프로젝트 수정' : '프로젝트 등록'}
            </h1>
            <p className="muted" style={{ marginBottom: 20 }}>
              {
                (isEdit
                  ? [
                      '프로젝트 기본 정보를 수정합니다. 배역·지원 조건은 지원 링크 관리에서 변경하세요.',
                      '수정할 내용을 확인하고 저장하세요.',
                    ]
                  : [
                      '프로젝트의 기본 정보를 입력해 주세요. 배우가 지원 여부를 판단하는 데 쓰입니다.',
                      '모집할 배역을 추가해 주세요. 배역마다 지원 링크가 따로 만들어집니다.',
                      '지원 일정과 출연 조건을 정해 주세요.',
                      '입력한 내용을 확인하고 게시하세요.',
                    ])[step]
              }
            </p>
            <div className="role-form">
              <p className="form-legend">
                <em>*</em> 표시는 꼭 채워야 하는 항목이에요. 나머지는 나중에 채워도 됩니다.
              </p>
              {step === 0 && (
                <>
                  <label>
                    작품명 <em>*</em>
                    <input
                      value={draft.title}
                      onChange={set('title')}
                      placeholder="예: 단편영화 〈봄날〉"
                    />
                  </label>
                  <div className="form-two">
                    <label>
                      장르 <i>선택</i>
                      <select value={draft.genre} onChange={set('genre')}>
                        {GENRES.map((genre) => (
                          <option key={genre}>{genre}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      촬영 지역 <em>*</em>
                      <input
                        value={draft.location}
                        onChange={set('location')}
                        placeholder="예: 서울 성동구"
                      />
                    </label>
                  </div>
                  <div className="form-two">
                    <label>
                      촬영 시작일 <em>*</em>
                      <input type="date" value={draft.shootStart} onChange={set('shootStart')} />
                    </label>
                    <label>
                      촬영 종료일 <i>선택</i>
                      <input type="date" value={draft.shootEnd} onChange={set('shootEnd')} />
                    </label>
                  </div>
                  <label>
                    작품 소개 <i>선택</i>
                    <textarea
                      rows={4}
                      value={draft.description}
                      onChange={set('description')}
                      placeholder="작품의 줄거리, 분위기, 용도(졸업작품·영화제 출품 등)를 적어 주세요."
                    />
                  </label>
                </>
              )}
              {!isEdit && step === 1 && (
                <>
                  {draft.roles.map((role, index) => (
                    <div key={index} className="role-block">
                      <div className="role-block-head">
                        <strong>배역 {index + 1}</strong>
                        {draft.roles.length > 1 && (
                          <button
                            type="button"
                            className="text-button"
                            onClick={() =>
                              setDraft((current) => ({
                                ...current,
                                roles: current.roles.filter((_, i) => i !== index),
                              }))
                            }
                          >
                            삭제
                          </button>
                        )}
                      </div>
                      <label>
                        배역명 <em>*</em>
                        <input
                          value={role.title}
                          onChange={(event) => setRole(index, 'title', event.target.value)}
                          placeholder="예: 민수 역 (주연)"
                        />
                      </label>
                      <label>
                        배역 설명 <em>*</em>
                        <textarea
                          rows={3}
                          value={role.description}
                          onChange={(event) => setRole(index, 'description', event.target.value)}
                          placeholder="성별·연령대, 성격, 필요한 연기를 적어 주세요."
                        />
                      </label>
                      <label>
                        {/* 항목 이름에 '필수'가 들어가 있어서, 입력 자체는 선택이라는 걸 따로 적어 준다 */}
                        지원 필수 조건 <i>선택</i>
                        <input
                          value={role.requirement}
                          onChange={(event) => setRole(index, 'requirement', event.target.value)}
                          placeholder="예: 부산 사투리 가능, 촬영 3일 모두 참여"
                        />
                      </label>
                    </div>
                  ))}
                  {draft.roles.length < 20 && (
                    <button
                      type="button"
                      className="button button-soft full"
                      onClick={() =>
                        setDraft((current) => ({
                          ...current,
                          roles: [...current.roles, blankRole()],
                        }))
                      }
                    >
                      ＋ 배역 추가
                    </button>
                  )}
                </>
              )}
              {!isEdit && step === 2 && (
                <>
                  <div className="form-two">
                    <label>
                      지원 마감일 <em>*</em>
                      <input type="date" value={draft.deadline} onChange={set('deadline')} />
                    </label>
                    <label>
                      결과 안내일 <em>*</em>
                      <input
                        type="date"
                        value={draft.announcementDate}
                        onChange={set('announcementDate')}
                      />
                    </label>
                  </div>
                  <label>
                    출연료·교통·식비 <em>*</em>
                    <input
                      value={draft.pay}
                      onChange={set('pay')}
                      placeholder="예: 1일 15만 원, 교통비·식비 별도 지급"
                    />
                  </label>
                  <label>
                    담당자 <em>*</em>
                    <input
                      value={draft.contactName}
                      onChange={set('contactName')}
                      placeholder="예: 연출 이지현"
                    />
                  </label>
                </>
              )}
              {step === steps.length - 1 && (
                <div className="review-card">
                  <div>
                    <span>작품</span>
                    <strong>
                      {draft.title} · {draft.genre}
                    </strong>
                  </div>
                  <div>
                    <span>촬영</span>
                    <strong>
                      {draft.shootStart}
                      {draft.shootEnd && draft.shootEnd !== draft.shootStart
                        ? ` ~ ${draft.shootEnd}`
                        : ''}{' '}
                      · {draft.location}
                    </strong>
                  </div>
                  {draft.description.trim() && (
                    <div>
                      <span>소개</span>
                      <strong>{draft.description}</strong>
                    </div>
                  )}
                  {isEdit ? (
                    <div>
                      <span>배역·조건</span>
                      <strong>배역 수정은 지원 링크 관리에서 진행하세요.</strong>
                    </div>
                  ) : (
                    <>
                      <div>
                        <span>배역</span>
                        <strong>
                          {draft.roles
                            .filter((role) => role.title.trim())
                            .map((role) => role.title)
                            .join(', ')}
                        </strong>
                      </div>
                      <div>
                        <span>지원 마감</span>
                        <strong>{draft.deadline}</strong>
                      </div>
                      <div>
                        <span>결과 안내</span>
                        <strong>{draft.announcementDate}</strong>
                      </div>
                      <div>
                        <span>조건</span>
                        <strong>{draft.pay}</strong>
                      </div>
                      <div>
                        <span>담당자</span>
                        <strong>{draft.contactName}</strong>
                      </div>
                    </>
                  )}
                </div>
              )}
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              <div className="wizard-actions">
                {!isEdit && (
                  <button type="button" className="button button-outline" onClick={saveDraft}>
                    임시 저장
                  </button>
                )}
                {step > 0 && (
                  <button
                    type="button"
                    className="button button-outline"
                    onClick={() => setStep(step - 1)}
                  >
                    이전
                  </button>
                )}
                <button
                  type="button"
                  className="button button-primary"
                  disabled={busy}
                  onClick={() => void next()}
                >
                  {step === steps.length - 1
                    ? busy
                      ? isEdit
                        ? '수정 중…'
                        : '게시 중…'
                      : isEdit
                        ? '수정하기'
                        : '프로젝트 게시하기'
                    : '다음 단계 →'}
                </button>
              </div>
            </div>
          </section>
        </div>
      </div>
      {notice && (
        <div className="toast" role="status" onClick={() => setNotice('')}>
          {notice}
          <button aria-label="닫기">×</button>
        </div>
      )}
    </main>
  );
}
