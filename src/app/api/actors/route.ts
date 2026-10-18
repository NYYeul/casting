import { NextRequest, NextResponse } from 'next/server';
import { listFavoriteIds, listPublicProfiles } from '@/lib/accounts';
import { getProducerId } from '@/lib/auth';
import { ageOf, matchesFilters, type ActorFilters } from '@/lib/profile';

function num(value: string | null) {
  const parsed = Number(value);
  return value && Number.isFinite(parsed) ? parsed : undefined;
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
  const actors = listPublicProfiles()
    .filter((profile) => matchesFilters(profile, filters))
    .sort((a, b) =>
      sort === 'name'
        ? a.name.localeCompare(b.name, 'ko')
        : sort === 'age'
          ? (ageOf(a.birthYear) ?? 99) - (ageOf(b.birthYear) ?? 99)
          : b.updatedAt.localeCompare(a.updatedAt),
    )
    .map((profile) => ({ ...profile, favorite: favorites.includes(profile.userId) }));
  return NextResponse.json(
    { actors, total: actors.length },
    { headers: { 'Cache-Control': 'private, no-store' } },
  );
}
