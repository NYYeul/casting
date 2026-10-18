import { NextRequest, NextResponse } from 'next/server';
import { listFavoriteIds, listPublicProfiles } from '@/lib/accounts';
import { getProducerId } from '@/lib/auth';
import { ageOf, matchesFilters, type ActorFilters } from '@/lib/profile';

function num(value: string | null) {
  const parsed = Number(value);
  return value && Number.isFinite(parsed) ? parsed : undefined;
}

function intParam(value: string | null, min: number, max: number, fallback: number) {
  const parsed = Math.floor(Number(value));
  return value !== null && Number.isFinite(parsed)
    ? Math.min(Math.max(parsed, min), max)
    : fallback;
}

export async function GET(request: NextRequest) {
  const producerId = await getProducerId();
  if (!producerId) return NextResponse.json({ error: '인증이 필요합니다.' }, { status: 401 });
  const params = request.nextUrl.searchParams;
  const favorites = listFavoriteIds(producerId);
  const filters: ActorFilters = {
    q: params.get('q') || undefined,
    gender: params.get('gender') || undefined,
    ageMin: num(params.get('ageMin')),
    ageMax: num(params.get('ageMax')),
    heightMin: num(params.get('heightMin')),
    heightMax: num(params.get('heightMax')),
    region: params.get('region') || undefined,
    skill: params.get('skill') || undefined,
    tag: params.get('tag') || undefined,
    available: /^\d{4}-\d{2}-\d{2}$/.test(params.get('available') || '')
      ? params.get('available')!
      : undefined,
    ids: params.get('favorites') === '1' ? favorites : undefined,
  };
  const sort = params.get('sort');
  const limit = intParam(params.get('limit'), 1, 50, 20);
  const offset = intParam(params.get('offset'), 0, Number.MAX_SAFE_INTEGER, 0);
  const careerMin = Math.max(
    intParam(params.get('careerMin'), 0, 100, 0),
    params.get('career') === '1' ? 1 : 0,
  );
  const actors = listPublicProfiles()
    .filter(
      (profile) => matchesFilters(profile, filters) && profile.filmography.length >= careerMin,
    )
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name, 'ko')
        : sort === 'age'
          ? (ageOf(a.birthYear) ?? 99) - (ageOf(b.birthYear) ?? 99)
          : b.updatedAt.localeCompare(a.updatedAt),
    )
    .map((profile) => ({ ...profile, favorite: favorites.includes(profile.userId) }));
  const results = actors.slice(offset, offset + limit);
  return NextResponse.json(
    {
      results,
      total: actors.length,
      hasMore: offset + results.length < actors.length,
      // Deprecated alias kept for pre-pagination clients (e.g. /studio/recommend):
      // the full filtered list, unpaginated.
      actors,
    },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
