// 규칙 기반 배우 적합도 점수. 외부 AI API 없이 동일 입력에 동일 결과를 반환한다.

export type Brief = {
  gender?: string;
  ageMin?: number;
  ageMax?: number;
  heightMin?: number;
  heightMax?: number;
  region?: string;
  tags?: string[];
  skills?: string[];
  keywords?: string[];
  shootDate?: string;
  /** 배역의 촬영일 전체. 있으면 shootDate 대신 이 날짜들을 모두 확인한다. */
  shootDates?: string[];
};

// scoreActor가 요구하는 최소 프로필 형태. ActorProfile이 구조적으로 호환된다.
export type ScorableProfile = {
  gender: string;
  birthYear: number | null;
  height: number | null;
  region: string;
  intro: string;
  tags: string[];
  skills: string[];
  unavailableDates: string[];
};

export type FitScore = {
  score: number; // 0-95 정수. 100점 상한 대신 95로 클램프해 "완벽한 매치" 과장을 피한다.
  reasons: string[];
};

export const MAX_SCORE = 95;

// 한국 나이: 현재 연도 - 출생 연도 + 1
export function koreanAge(birthYear: number | null, currentYear = new Date().getFullYear()) {
  return birthYear ? currentYear - birthYear + 1 : null;
}

function intersect(want: string[] | undefined, have: string[]) {
  if (!want?.length) return [];
  const owned = new Set(have);
  return [...new Set(want)].filter((item) => owned.has(item));
}

export function scoreActor(
  profile: ScorableProfile,
  brief: Brief,
  currentYear = new Date().getFullYear(),
): FitScore {
  let score = 0;
  const reasons: string[] = [];

  if (brief.gender && profile.gender === brief.gender) {
    score += 20;
    reasons.push('성별 조건 부합');
  }

  const age = koreanAge(profile.birthYear, currentYear);
  if (
    age !== null &&
    (brief.ageMin !== undefined || brief.ageMax !== undefined) &&
    (brief.ageMin === undefined || age >= brief.ageMin) &&
    (brief.ageMax === undefined || age <= brief.ageMax)
  ) {
    score += 15;
    reasons.push('연령 조건 부합');
  }

  if (
    profile.height !== null &&
    (brief.heightMin !== undefined || brief.heightMax !== undefined) &&
    (brief.heightMin === undefined || profile.height >= brief.heightMin) &&
    (brief.heightMax === undefined || profile.height <= brief.heightMax)
  ) {
    score += 10;
    reasons.push('키 조건 부합');
  }

  if (brief.region && profile.region.startsWith(brief.region)) {
    score += 10;
    reasons.push('지역 일치');
  }

  const matchedTags = intersect(brief.tags, profile.tags);
  if (matchedTags.length) {
    score += Math.min(matchedTags.length * 6, 24);
    reasons.push(`이미지 태그 ${matchedTags.length}개 일치 (${matchedTags.join('·')})`);
  }

  const matchedSkills = intersect(brief.skills, profile.skills);
  if (matchedSkills.length) {
    score += Math.min(matchedSkills.length * 5, 15);
    reasons.push(`특기 일치 (${matchedSkills.join('·')})`);
  }

  const matchedKeywords = (brief.keywords ?? []).filter(
    (word) => word && profile.intro.includes(word),
  );
  if (matchedKeywords.length) {
    score += Math.min(matchedKeywords.length * 4, 12);
    reasons.push(`소개글 키워드 일치 (${matchedKeywords.join('·')})`);
  }

  const shootDays = brief.shootDates?.length
    ? brief.shootDates
    : brief.shootDate
      ? [brief.shootDate]
      : [];
  if (shootDays.length) {
    const clashes = shootDays.filter((day) => profile.unavailableDates.includes(day));
    if (clashes.length) {
      score -= 25;
      reasons.push(
        shootDays.length > 1
          ? `출연 불가일과 촬영일 겹침 (${clashes.length}일)`
          : '출연 불가일과 촬영일 겹침',
      );
    } else {
      score += 5;
      reasons.push('촬영 일정 문제없음');
    }
  }

  return { score: Math.max(0, Math.min(MAX_SCORE, Math.round(score))), reasons };
}
