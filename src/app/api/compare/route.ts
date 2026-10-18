import { NextRequest, NextResponse } from 'next/server';
import { getProfile, listFavoriteIds, listPublicProfiles } from '@/lib/accounts';
import { getProducerId } from '@/lib/auth';
import { MIN_CANDIDATES } from '@/lib/compare';
import { listApplications, roleOwnedBy } from '@/lib/db';
import { ageOf, type ActorProfile } from '@/lib/profile';
import { reviewLabels, type Application } from '@/lib/types';

type Candidate = {
  id: string;
  name: string;
  age: number | null;
  photo: string;
  intro: string;
  meta: string;
};

function fromApplication(application: Application): Candidate {
  const meta = [
    reviewLabels[application.status] ?? application.status,
    application.shortlist ? '후보' : '',
    application.skill,
  ]
    .filter(Boolean)
    .join(' · ');
  return {
    id: application.id,
    name: application.name,
    age: application.age,
    photo: application.photoUrl,
    intro: application.introduction,
    meta,
  };
}

function fromProfile(profile: ActorProfile): Candidate {
  return {
    id: profile.userId,
    name: profile.name,
    age: ageOf(profile.birthYear),
    photo: profile.photos[0] ?? '',
    intro: profile.intro,
    meta: [profile.region, ...profile.tags.slice(0, 3)].filter(Boolean).join(' · '),
  };
}

export async function GET(request: NextRequest) {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });

  const source = request.nextUrl.searchParams.get('source') || 'role';
  let candidates: Candidate[];

  if (source === 'role') {
    const roleId = request.nextUrl.searchParams.get('roleId') || '';
    if (!roleId) return NextResponse.json({ error: '배역을 선택해 주세요.' }, { status: 400 });
    if (!roleOwnedBy(roleId, producerId))
      return NextResponse.json({ error: '배역을 찾을 수 없습니다.' }, { status: 404 });
    candidates = listApplications(roleId)
      .filter((application) => !['excluded', 'rejected'].includes(application.status))
      .map(fromApplication);
  } else if (source === 'favorites') {
    candidates = listFavoriteIds(producerId)
      .map((actorId) => getProfile(actorId))
      .filter((profile): profile is ActorProfile => Boolean(profile))
      .map(fromProfile);
  } else if (source === 'actors') {
    candidates = listPublicProfiles().map(fromProfile);
  } else {
    return NextResponse.json({ error: '지원하지 않는 후보 소스입니다.' }, { status: 400 });
  }

  if (candidates.length < MIN_CANDIDATES)
    return NextResponse.json(
      { error: `비교할 후보가 ${MIN_CANDIDATES}명 이상 필요합니다.` },
      { status: 400 },
    );
  return NextResponse.json({ candidates });
}
