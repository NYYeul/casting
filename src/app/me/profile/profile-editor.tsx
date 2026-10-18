'use client';

import Link from 'next/link';
import { useRef, useState } from 'react';
import ActorNav from '@/components/actor-nav';
import type { ActorProfileFull, ProfileDocument } from '@/lib/accounts';
import {
  IMAGE_TAGS,
  MAX_TAGS,
  profileCompletion,
  REGIONS,
  SKILLS,
  type Gender,
} from '@/lib/profile';
import { embedUrl } from '@/lib/video';

const SECTIONS = [
  ['basic', '기본 정보'],
  ['photos', '프로필 사진'],
  ['video', '연기 영상'],
  ['image', '이미지·특기'],
  ['filmo', '필모그래피'],
  ['docs', '자료실'],
  ['schedule', '출연 불가 일정'],
  ['visibility', '공개 설정'],
] as const;

type ActorProfile = ActorProfileFull;

// Mirror of MAX_DOCUMENTS in @/lib/accounts — that module is server-only
// (pulls in node:sqlite), so it cannot be imported from a client component.
const MAX_DOCUMENTS = 5;

export default function ProfileEditor({ initial }: { initial: ActorProfile }) {
  const [profile, setProfile] = useState(initial);
  const [saved, setSaved] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [docUploading, setDocUploading] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [newDate, setNewDate] = useState('');
  const fileInput = useRef<HTMLInputElement>(null);
  const docInput = useRef<HTMLInputElement>(null);
  const completion = profileCompletion(profile);
  const dirty = JSON.stringify(profile) !== JSON.stringify(saved);

  const update = <K extends keyof ActorProfile>(key: K, value: ActorProfile[K]) =>
    setProfile((current) => ({ ...current, [key]: value }));
  const toggle = (key: 'tags' | 'skills', value: string, max: number) =>
    setProfile((current) => {
      const list = current[key];
      if (list.includes(value)) return { ...current, [key]: list.filter((item) => item !== value) };
      if (list.length >= max) {
        setError(
          key === 'tags'
            ? `이미지 키워드는 최대 ${max}개까지 고를 수 있어요.`
            : '특기를 더 고를 수 없어요.',
        );
        return current;
      }
      setError('');
      return { ...current, [key]: [...list, value] };
    });
  const numberOrNull = (value: string) => (value === '' ? null : Number(value));

  async function upload(files: FileList | null) {
    if (!files?.length) return;
    setUploading(true);
    setError('');
    try {
      const urls: string[] = [];
      for (const file of Array.from(files).slice(0, 8 - profile.photos.length)) {
        const form = new FormData();
        form.append('file', file);
        const response = await fetch('/api/uploads', { method: 'POST', body: form });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || '사진을 올리지 못했습니다.');
        urls.push(data.url);
      }
      setProfile((current) => ({ ...current, photos: [...current.photos, ...urls].slice(0, 8) }));
      setNotice('사진을 올렸습니다. 저장을 눌러 프로필에 반영하세요.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '사진을 올리지 못했습니다.');
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  async function uploadDocument(files: FileList | null) {
    const file = files?.[0];
    if (!file) return;
    if (profile.documents.length >= MAX_DOCUMENTS) {
      setError(`자료는 최대 ${MAX_DOCUMENTS}개까지 올릴 수 있어요.`);
      if (docInput.current) docInput.current.value = '';
      return;
    }
    setDocUploading(true);
    setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      const response = await fetch('/api/uploads', { method: 'POST', body: form });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '자료를 올리지 못했습니다.');
      const document: ProfileDocument = { name: file.name, url: data.url };
      setProfile((current) => ({
        ...current,
        documents: [...current.documents, document].slice(0, MAX_DOCUMENTS),
      }));
      setNotice('자료를 올렸습니다. 저장을 눌러 프로필에 반영하세요.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '자료를 올리지 못했습니다.');
    } finally {
      setDocUploading(false);
      if (docInput.current) docInput.current.value = '';
    }
  }

  async function save() {
    setBusy(true);
    setError('');
    try {
      const response = await fetch('/api/me/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(profile),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || '저장하지 못했습니다.');
      setProfile(data.profile);
      setSaved(data.profile);
      setNotice('프로필을 저장했습니다.');
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : '저장하지 못했습니다.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="app-shell wide">
      <ActorNav active="profile" actorId={profile.userId} />
      <div className="screen-pad page-top">
        <div className="title-row">
          <h1 className="page-title">프로필 관리</h1>
          <Link className="button button-outline sm" href={`/actors/${profile.userId}`}>
            프로필 미리보기
          </Link>
        </div>
        <div className="completion-card static">
          <div>
            <strong>프로필 완성도 {completion}%</strong>
            <span>
              {completion < 100
                ? '사진 3장, 연기 영상, 필모그래피까지 채우면 100%가 돼요.'
                : '완벽해요! 제작자 검색에 잘 보입니다.'}
            </span>
          </div>
          <div className="bar">
            <i style={{ width: `${completion}%` }} />
          </div>
        </div>
        <div className="editor-layout">
          <aside className="desk-only editor-menu">
            {SECTIONS.map(([id, label]) => (
              <a key={id} href={`#${id}`}>
                {label}
              </a>
            ))}
          </aside>
          <div className="editor-body">
            <section id="basic" className="editor-card">
              <h2>기본 정보</h2>
              <div className="role-form">
                <label>
                  이름 <em>*</em>
                  <input
                    value={profile.name}
                    onChange={(event) => update('name', event.target.value)}
                  />
                </label>
                <div className="form-two">
                  <label>
                    성별
                    <select
                      value={profile.gender}
                      onChange={(event) => update('gender', event.target.value as Gender)}
                    >
                      <option value="">선택 안 함</option>
                      <option value="female">여성</option>
                      <option value="male">남성</option>
                      <option value="other">기타</option>
                    </select>
                  </label>
                  <label>
                    출생연도
                    <input
                      type="number"
                      inputMode="numeric"
                      placeholder="2000"
                      value={profile.birthYear ?? ''}
                      onChange={(event) => update('birthYear', numberOrNull(event.target.value))}
                    />
                  </label>
                </div>
                <div className="form-three">
                  <label>
                    키 (cm)
                    <input
                      type="number"
                      inputMode="numeric"
                      value={profile.height ?? ''}
                      onChange={(event) => update('height', numberOrNull(event.target.value))}
                    />
                  </label>
                  <label>
                    체중 (kg)
                    <input
                      type="number"
                      inputMode="numeric"
                      value={profile.weight ?? ''}
                      onChange={(event) => update('weight', numberOrNull(event.target.value))}
                    />
                  </label>
                  <label>
                    활동 지역
                    <select
                      value={profile.region}
                      onChange={(event) => update('region', event.target.value)}
                    >
                      <option value="">선택</option>
                      {REGIONS.map((region) => (
                        <option key={region}>{region}</option>
                      ))}
                    </select>
                  </label>
                </div>
                <label>
                  소속/에이전시
                  <input
                    value={profile.agency}
                    maxLength={60}
                    placeholder="소속사 또는 에이전시명 (없으면 비워 두세요)"
                    onChange={(event) => update('agency', event.target.value)}
                  />
                </label>
                <label>
                  소개글
                  <textarea
                    rows={4}
                    maxLength={2000}
                    value={profile.intro}
                    onChange={(event) => update('intro', event.target.value)}
                    placeholder="출연작, 연기 스타일, 하고 싶은 작품을 적어 주세요. (20자 이상)"
                  />
                </label>
              </div>
            </section>

            <section id="photos" className="editor-card">
              <h2>
                프로필 사진 <small>{profile.photos.length}/8 · 첫 번째 사진이 대표 사진</small>
              </h2>
              <div className="photo-editor">
                {profile.photos.map((url, index) => (
                  <div key={url} className={`pe-item${index === 0 ? ' main' : ''}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`프로필 사진 ${index + 1}`} />
                    {index === 0 && <span className="pe-badge">대표</span>}
                    <div className="pe-actions">
                      {index > 0 && (
                        <button
                          onClick={() =>
                            update('photos', [
                              url,
                              ...profile.photos.filter((item) => item !== url),
                            ])
                          }
                        >
                          대표로
                        </button>
                      )}
                      <button
                        onClick={() =>
                          update(
                            'photos',
                            profile.photos.filter((item) => item !== url),
                          )
                        }
                      >
                        삭제
                      </button>
                    </div>
                  </div>
                ))}
                {profile.photos.length < 8 && (
                  <button
                    className="pe-add"
                    onClick={() => fileInput.current?.click()}
                    disabled={uploading}
                  >
                    <span>＋</span>
                    {uploading ? '올리는 중…' : '사진 추가'}
                    <small>JPG·PNG·WEBP, 5MB 이하</small>
                  </button>
                )}
              </div>
              <input
                ref={fileInput}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                multiple
                hidden
                onChange={(event) => void upload(event.target.files)}
              />
            </section>

            <section id="video" className="editor-card">
              <h2>연기 영상</h2>
              <div className="role-form">
                <label>
                  영상 링크
                  <input
                    type="url"
                    value={profile.videoUrl}
                    onChange={(event) => update('videoUrl', event.target.value)}
                    placeholder="https://www.youtube.com/watch?v=..."
                  />
                  <small className="hint">YouTube·Vimeo 링크는 프로필에서 바로 재생됩니다.</small>
                </label>
                {profile.videoUrl && embedUrl(profile.videoUrl) && (
                  <div className="video-frame">
                    <iframe
                      src={embedUrl(profile.videoUrl)!}
                      title="연기 영상 미리보기"
                      allowFullScreen
                    />
                  </div>
                )}
              </div>
            </section>

            <section id="image" className="editor-card">
              <h2>
                이미지 키워드{' '}
                <small>
                  최대 {MAX_TAGS}개 · {profile.tags.length}개 선택
                </small>
              </h2>
              <div className="chip-pick">
                {IMAGE_TAGS.map((tag) => (
                  <button
                    key={tag}
                    className={profile.tags.includes(tag) ? 'on' : ''}
                    onClick={() => toggle('tags', tag, MAX_TAGS)}
                  >
                    {tag}
                  </button>
                ))}
              </div>
              <h2 style={{ marginTop: 22 }}>특기</h2>
              <div className="chip-pick">
                {SKILLS.map((skill) => (
                  <button
                    key={skill}
                    className={profile.skills.includes(skill) ? 'on' : ''}
                    onClick={() => toggle('skills', skill, 12)}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </section>

            <section id="filmo" className="editor-card">
              <h2>필모그래피</h2>
              {profile.filmography.map((item, index) => (
                <div key={index} className="filmo-row">
                  <input
                    aria-label="연도"
                    placeholder="2025"
                    maxLength={4}
                    value={item.year}
                    onChange={(event) =>
                      update(
                        'filmography',
                        profile.filmography.map((row, i) =>
                          i === index ? { ...row, year: event.target.value } : row,
                        ),
                      )
                    }
                  />
                  <input
                    aria-label="작품명"
                    placeholder="작품명"
                    value={item.title}
                    onChange={(event) =>
                      update(
                        'filmography',
                        profile.filmography.map((row, i) =>
                          i === index ? { ...row, title: event.target.value } : row,
                        ),
                      )
                    }
                  />
                  <input
                    aria-label="역할"
                    placeholder="주연"
                    value={item.role}
                    onChange={(event) =>
                      update(
                        'filmography',
                        profile.filmography.map((row, i) =>
                          i === index ? { ...row, role: event.target.value } : row,
                        ),
                      )
                    }
                  />
                  <button
                    className="text-button"
                    aria-label="삭제"
                    onClick={() =>
                      update(
                        'filmography',
                        profile.filmography.filter((_, i) => i !== index),
                      )
                    }
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                className="button button-soft full"
                onClick={() =>
                  update('filmography', [
                    ...profile.filmography,
                    { year: String(new Date().getFullYear()), title: '', role: '' },
                  ])
                }
              >
                ＋ 작품 추가
              </button>
            </section>

            <section id="docs" className="editor-card">
              <h2>
                자료실{' '}
                <small>
                  PDF 최대 {MAX_DOCUMENTS}개 · {profile.documents.length}개 등록
                </small>
              </h2>
              <p className="muted" style={{ marginBottom: 12 }}>
                경력기장, 포트폴리오 등 PDF 자료를 올리면 제작자가 프로필에서 열어볼 수 있습니다.
              </p>
              {profile.documents.length > 0 && (
                <ul className="filmo" style={{ marginBottom: 12 }}>
                  {profile.documents.map((doc) => (
                    <li key={doc.url}>
                      <a href={doc.url} target="_blank" rel="noreferrer">
                        {doc.name || '첨부 자료'} ↗
                      </a>
                      <button
                        className="text-button"
                        aria-label={`${doc.name || '첨부 자료'} 삭제`}
                        onClick={() =>
                          update(
                            'documents',
                            profile.documents.filter((item) => item.url !== doc.url),
                          )
                        }
                      >
                        삭제
                      </button>
                    </li>
                  ))}
                </ul>
              )}
              {profile.documents.length < MAX_DOCUMENTS && (
                <button
                  className="button button-soft full"
                  disabled={docUploading}
                  onClick={() => docInput.current?.click()}
                >
                  {docUploading ? '올리는 중…' : '＋ PDF 자료 추가'}
                </button>
              )}
              <input
                ref={docInput}
                type="file"
                accept="application/pdf,.pdf"
                hidden
                onChange={(event) => void uploadDocument(event.target.files)}
              />
            </section>

            <section id="schedule" className="editor-card">
              <h2>출연 불가 일정</h2>
              <p className="muted" style={{ marginBottom: 12 }}>
                촬영이 어려운 날짜만 등록하세요. 제작자에게는 해당 날짜에 가능/불가 여부만 보입니다.
              </p>
              <div className="date-add">
                <input
                  type="date"
                  value={newDate}
                  onChange={(event) => setNewDate(event.target.value)}
                />
                <button
                  className="button button-outline sm"
                  disabled={!newDate || profile.unavailableDates.includes(newDate)}
                  onClick={() => {
                    update('unavailableDates', [...profile.unavailableDates, newDate].sort());
                    setNewDate('');
                  }}
                >
                  추가
                </button>
              </div>
              <div className="chip-pick">
                {profile.unavailableDates.map((date) => (
                  <button
                    key={date}
                    className="on"
                    onClick={() =>
                      update(
                        'unavailableDates',
                        profile.unavailableDates.filter((item) => item !== date),
                      )
                    }
                  >
                    {date} ×
                  </button>
                ))}
              </div>
            </section>

            <section id="visibility" className="editor-card">
              <h2>공개 설정</h2>
              <label className="check">
                <input
                  type="checkbox"
                  checked={profile.isPublic}
                  onChange={(event) => update('isPublic', event.target.checked)}
                />
                <span>제작자 배우 검색에 내 프로필 공개</span>
              </label>
              <p className="small-note">
                연락처와 이메일은 검색에 공개되지 않습니다. 제안을 수락하고 지원한 배역의
                제작자에게만 전달됩니다.
              </p>
            </section>
          </div>
        </div>
      </div>
      <div className="save-bar">
        {error && <span className="save-error">{error}</span>}
        <span className="save-state">
          {dirty ? '저장하지 않은 변경 사항이 있습니다' : '모든 변경 사항이 저장됨'}
        </span>
        <button
          className="button button-primary"
          disabled={busy || !dirty}
          onClick={() => void save()}
        >
          {busy ? '저장 중…' : '저장하기'}
        </button>
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
