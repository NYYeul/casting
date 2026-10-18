export type Gender = 'female' | 'male' | 'other' | '';

export type Filmography = { year: string; title: string; role: string };

export type ActorProfile = {
  userId: string;
  name: string;
  gender: Gender;
  birthYear: number | null;
  height: number | null;
  weight: number | null;
  region: string;
  intro: string;
  tags: string[];
  skills: string[];
  photos: string[];
  videoUrl: string;
  filmography: Filmography[];
  unavailableDates: string[];
  isPublic: boolean;
  updatedAt: string;
};

export type ActorFilters = {
  q?: string;
  gender?: string;
  ageMin?: number;
  ageMax?: number;
  heightMin?: number;
  heightMax?: number;
  region?: string;
  skill?: string;
  tag?: string;
  available?: string;
  ids?: string[];
};

export const IMAGE_TAGS = [
  '청순한',
  '시크한',
  '지적인',
  '따뜻한',
  '카리스마',
  '소년미',
  '도시적인',
  '유쾌한',
  '차분한',
  '강인한',
  '사랑스러운',
  '신비로운',
];
export const SKILLS = [
  '자연스러운 대화 연기',
  '액션',
  '사투리',
  '영어',
  '일본어',
  '노래',
  '댄스',
  '수영',
  '운전',
  '악기 연주',
  '무술',
  '즉흥 연기',
];
export const REGIONS = ['서울', '경기', '인천', '부산', '대구', '광주', '대전', '강원', '제주'];
export const MAX_TAGS = 5;

export const genderLabel: Record<Gender, string> = {
  female: '여성',
  male: '남성',
  other: '기타',
  '': '미입력',
};

export function ageOf(birthYear: number | null, currentYear = new Date().getFullYear()) {
  return birthYear ? currentYear - birthYear : null;
}

export function profileCompletion(profile: ActorProfile) {
  const checks = [
    Boolean(profile.name),
    Boolean(profile.gender),
    Boolean(profile.birthYear),
    Boolean(profile.height),
    Boolean(profile.region),
    profile.intro.length >= 20,
    profile.tags.length > 0,
    profile.skills.length > 0,
    profile.photos.length > 0,
    profile.photos.length >= 3,
    Boolean(profile.videoUrl),
    profile.filmography.length > 0,
  ];
  return Math.round((checks.filter(Boolean).length / checks.length) * 100);
}

export function matchesFilters(
  profile: ActorProfile,
  filters: ActorFilters,
  currentYear = new Date().getFullYear(),
) {
  if (filters.ids && !filters.ids.includes(profile.userId)) return false;
  if (filters.gender && profile.gender !== filters.gender) return false;
  const age = ageOf(profile.birthYear, currentYear);
  if (filters.ageMin && (age === null || age < filters.ageMin)) return false;
  if (filters.ageMax && (age === null || age > filters.ageMax)) return false;
  if (filters.heightMin && (!profile.height || profile.height < filters.heightMin)) return false;
  if (filters.heightMax && (!profile.height || profile.height > filters.heightMax)) return false;
  if (filters.region && !profile.region.startsWith(filters.region)) return false;
  if (filters.skill && !profile.skills.includes(filters.skill)) return false;
  if (filters.tag && !profile.tags.includes(filters.tag)) return false;
  if (filters.available && profile.unavailableDates.includes(filters.available)) return false;
  if (filters.q) {
    const haystack = [profile.name, profile.intro, ...profile.tags, ...profile.skills]
      .join(' ')
      .toLowerCase();
    if (!haystack.includes(filters.q.toLowerCase())) return false;
  }
  return true;
}

export function cleanList(value: unknown, allowed: string[] | null, max: number) {
  if (!Array.isArray(value)) return [];
  const items = value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item && (!allowed || allowed.includes(item)));
  return [...new Set(items)].slice(0, max);
}
