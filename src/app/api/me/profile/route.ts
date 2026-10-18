import { NextRequest, NextResponse } from 'next/server';
import {
  getProfileFull,
  MAX_DOCUMENTS,
  safeDocumentRef,
  updateProfile,
  type ProfileDocument,
} from '@/lib/accounts';
import { getActorId } from '@/lib/auth';
import {
  cleanList,
  IMAGE_TAGS,
  MAX_TAGS,
  REGIONS,
  SKILLS,
  type Filmography,
  type Gender,
} from '@/lib/profile';
import { requiredText, safeImageRef, safeUrl } from '@/lib/validation';

function intIn(value: unknown, min: number, max: number) {
  const parsed = Number(value);
  return value !== '' && value != null && Number.isInteger(parsed) && parsed >= min && parsed <= max
    ? parsed
    : null;
}

export async function GET() {
  const actorId = await getActorId();
  if (!actorId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  return NextResponse.json({ profile: getProfileFull(actorId) });
}

export async function PUT(request: NextRequest) {
  const actorId = await getActorId();
  if (!actorId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const gender: Gender = ['female', 'male', 'other'].includes(body.gender) ? body.gender : '';
  const region = requiredText(body.region, 20);
  const filmography: Filmography[] = Array.isArray(body.filmography)
    ? body.filmography
        .map((item: Record<string, unknown>) => ({
          year: requiredText(item?.year, 4),
          title: requiredText(item?.title, 100),
          role: requiredText(item?.role, 60),
        }))
        .filter((item: Filmography) => item.title)
        .slice(0, 30)
    : [];
  const photos = (Array.isArray(body.photos) ? body.photos : [])
    .map((item: unknown) => safeImageRef(item))
    .filter(Boolean)
    .slice(0, 8);
  const documents: ProfileDocument[] = (Array.isArray(body.documents) ? body.documents : [])
    .map((item: Record<string, unknown>) => ({
      name: requiredText(item?.name, 120) || '첨부 자료',
      url: safeDocumentRef(item?.url),
    }))
    .filter((doc: ProfileDocument) => doc.url)
    .slice(0, MAX_DOCUMENTS);
  const name = requiredText(body.name, 60);
  if (!name) return NextResponse.json({ error: '이름을 입력해 주세요.' }, { status: 400 });
  const profile = updateProfile(actorId, {
    name,
    gender,
    birthYear: intIn(body.birthYear, 1930, new Date().getFullYear()),
    height: intIn(body.height, 100, 230),
    weight: intIn(body.weight, 25, 200),
    region: REGIONS.includes(region) ? region : '',
    intro: requiredText(body.intro, 2000),
    tags: cleanList(body.tags, IMAGE_TAGS, MAX_TAGS),
    skills: cleanList(body.skills, SKILLS, 12),
    photos,
    videoUrl: safeUrl(body.videoUrl),
    filmography,
    unavailableDates: cleanList(body.unavailableDates, null, 60).filter((date) =>
      /^\d{4}-\d{2}-\d{2}$/.test(date),
    ),
    isPublic: body.isPublic !== false,
    agency: requiredText(body.agency, 60),
    documents,
  });
  return NextResponse.json({ profile });
}
