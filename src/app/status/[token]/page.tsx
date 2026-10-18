import Link from 'next/link';
import { notFound } from 'next/navigation';
import { getApplicationByReceipt, getLatestOffer, getRoleById } from '@/lib/db';
import { publicLabels } from '@/lib/types';
import ChatThread from '@/components/chat-thread';
import OfferResponse from '@/components/offer-response';

export const dynamic = 'force-dynamic';

export default async function StatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const application = getApplicationByReceipt(token);
  if (!application) notFound();
  const role = getRoleById(application.roleId);
  if (!role) notFound();
  const offer = getLatestOffer(application.id);
  return (
    <main className="app-shell narrow">
      <header className="sub-header">
        <Link className="sh-back" href={`/apply/${role.slug}`} aria-label="배역 정보로">
          ‹
        </Link>
        <h1>{offer ? '오디션 일정' : '지원 현황'}</h1>
        <span className="sh-more" />
      </header>
      <div className="status-wrap">
        <div className="mini-proj">
          <div className="mp-main">
            <span className="badge-soft mp-badge">{role.isClosed ? '지원 마감' : '모집 중'}</span>
            <strong>{role.projectTitle}</strong>
            <span>
              {role.title} · {application.name}
            </span>
          </div>
          <div className="mp-photo">
            {application.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={application.photoUrl} alt={`${application.name} 프로필 사진`} />
            ) : (
              application.name.slice(-2)
            )}
          </div>
        </div>
        <div className="pd-card">
          <div className="avatar">{role.contactName.slice(-2)}</div>
          <div className="pd-main">
            <strong>{role.contactName}</strong>
            <p>프로젝트 관련 문의는 언제든지 대화로 남겨주세요.</p>
          </div>
          {application.chatOpen && <a href="#chat">대화 보기 ›</a>}
        </div>
        <div className="status-card" style={{ marginTop: 14 }}>
          <span className="status-orb">✓</span>
          <div>
            <strong>{publicLabels[application.publicStage]}</strong>
            <p>
              {application.name}님의 지원이{' '}
              {application.publicStage === 'received' ? '접수되었습니다' : '진행 중입니다'}
            </p>
          </div>
        </div>
        {offer && <OfferResponse applicationId={application.id} receipt={token} offer={offer} />}
        <div className="info-panel">
          <div>
            <span>접수일</span>
            <strong>
              {new Date(application.createdAt).toLocaleDateString('ko-KR', {
                timeZone: 'Asia/Seoul',
              })}
            </strong>
          </div>
          <div>
            <span>결과 안내 예정</span>
            <strong>{role.announcementDate}</strong>
          </div>
        </div>
        <p className="small-note">
          이 페이지 주소를 보관하면 공개된 진행 상태를 다시 확인할 수 있습니다. 제작진의 내부 검토
          상태와 메모는 공개되지 않습니다.
        </p>
        {application.chatOpen && (
          <section id="chat" className="actor-chat">
            <ChatThread
              applicationId={application.id}
              mode="actor"
              receipt={token}
              peerName={role.contactName}
              peerSub={`${role.projectTitle} · ${role.title}`}
              projectTitle={role.projectTitle}
              roleTitle={role.title}
              projectImage={`https://picsum.photos/seed/${role.slug}/96/96`}
              profileHref={`/apply/${role.slug}`}
            />
          </section>
        )}
      </div>
    </main>
  );
}
