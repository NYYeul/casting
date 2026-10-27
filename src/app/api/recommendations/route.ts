import { NextRequest, NextResponse } from 'next/server';
import { listPublicProfiles } from '@/lib/accounts';
import { getProducerId } from '@/lib/auth';
import { getRoleById, roleOwnedBy } from '@/lib/db';
import { koreanAge, scoreActor, type Brief } from '@/lib/fit';
import { IMAGE_TAGS, SKILLS, type ActorProfile } from '@/lib/profile';
import { normalizeDates } from '@/lib/schedule';
import type { Role } from '@/lib/types';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const NO_STORE = { 'Cache-Control': 'private, no-store' };

// 배역에서 추천용 brief를 자동 생성한다 (결정적 규칙, 외부 API 없음).
// 배역에 적은 성별·연령대 칸이 있으면 그것을 쓰고, 없을 때만 설명 글에서 추측한다.
function briefFromRole(role: Role): Brief {
  const text = `${role.title} ${role.description} ${role.requirement}`;
  const tags = IMAGE_TAGS.filter((tag) => text.includes(tag));
  const skills = SKILLS.filter((skill) => text.includes(skill));
  const female = text.search(/여성|여자/);
  const male = text.search(/남성|남자/);
  const decade = text.match(/(\d{2})대/);
  const guessedGender =
    female === -1 && male === -1
      ? undefined
      : male === -1 || (female !== -1 && female < male)
        ? 'female'
        : 'male';
  const hasAge = role.ageMin > 0 || role.ageMax > 0;
  return {
    gender:
      role.gender === 'male' || role.gender === 'female'
        ? role.gender
        : role.gender === 'any'
          ? undefined
          : guessedGender,
    ageMin: hasAge ? role.ageMin || undefined : decade ? Number(decade[1]) : undefined,
    ageMax: hasAge ? role.ageMax || undefined : decade ? Number(decade[1]) + 9 : undefined,
    region: role.location.split(/\s+/)[0] || undefined,
    tags,
    skills,
    keywords: [...new Set([...tags, ...skills])],
    shootDate: role.shootDate || undefined,
    shootDates: role.shootDates.length ? role.shootDates : undefined,
  };
}

function num(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : undefined;
}

function text(value: unknown, max = 60) {
  return typeof value === 'string' ? value.trim().slice(0, max) : undefined;
}

function wordList(value: unknown, max: number) {
  if (!Array.isArray(value)) return undefined;
  const words = [
    ...new Set(
      value
        .filter((item): item is string => typeof item === 'string')
        .map((item) => item.trim())
        .filter(Boolean),
    ),
  ];
  return words.length ? words.slice(0, max) : undefined;
}

function sanitizeBrief(value: unknown): Brief {
  const body = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>;
  const gender = text(body.gender);
  const shootDate = text(body.shootDate, 10);
  return {
    gender: gender === 'female' || gender === 'male' ? gender : undefined,
    ageMin: num(body.ageMin),
    ageMax: num(body.ageMax),
    heightMin: num(body.heightMin),
    heightMax: num(body.heightMax),
    region: text(body.region, 30),
    tags: wordList(body.tags, IMAGE_TAGS.length),
    skills: wordList(body.skills, SKILLS.length),
    keywords: wordList(body.keywords, 12),
    shootDate: shootDate && DATE_PATTERN.test(shootDate) ? shootDate : undefined,
    shootDates: normalizeDates(body.shootDates).length
      ? normalizeDates(body.shootDates)
      : undefined,
  };
}

async function recommend(brief: Brief, limit = 12) {
  const year = new Date().getFullYear();
  return (await listPublicProfiles())
    .map((profile: ActorProfile) => ({ profile, ...scoreActor(profile, brief, year) }))
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.profile.name.localeCompare(b.profile.name, 'ko'))
    .slice(0, limit)
    .map(({ profile, score, reasons }) => ({
      actor: {
        id: profile.userId,
        name: profile.name,
        age: koreanAge(profile.birthYear, year),
        gender: profile.gender,
        height: profile.height,
        region: profile.region,
        photo: profile.photos[0] || '',
        tags: profile.tags,
      },
      score,
      reasons,
    }));
}

export async function GET(request: NextRequest) {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const roleId = request.nextUrl.searchParams.get('roleId') || '';
  if (!roleId) return NextResponse.json({ error: 'roleId가 필요합니다.' }, { status: 400 });
  if (!(await roleOwnedBy(roleId, producerId)))
    return NextResponse.json({ error: '배역을 찾을 수 없습니다.' }, { status: 404 });
  const role = (await getRoleById(roleId))!;
  const brief = briefFromRole(role);
  return NextResponse.json({ brief, results: await recommend(brief) }, { headers: NO_STORE });
}

export async function POST(request: NextRequest) {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const body = await request.json().catch(() => ({}));
  const brief = sanitizeBrief(body?.brief ?? body);
  return NextResponse.json({ brief, results: await recommend(brief) }, { headers: NO_STORE });
}
