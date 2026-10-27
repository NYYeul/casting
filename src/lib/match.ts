// 공개 공고와 배우 프로필의 조건 기반 적합도. fit.ts와 같은 철학의 순수 함수 —
// 외부 AI 없이 동일 입력에 동일 결과를 반환한다.
// (리프 모듈 유지: node --test에서 바로 불러오도록 lib 내부 import를 두지 않는다)

const MAX_SCORE = 95;

type FitScore = { score: number; reasons: string[] };

function koreanAge(birthYear: number | null, currentYear = new Date().getFullYear()) {
  return birthYear ? currentYear - birthYear + 1 : null;
}

export type MatchRoleInput = {
  title: string;
  description: string;
  requirement: string;
  location: string;
  shootDate: string;
  /** 배역 촬영일 전체. 있으면 shootDate 대신 모두 확인한다. */
  shootDates?: string[];
  /** 배역에 적은 성별 조건(male·female·any). 있으면 설명 글에서 추측하지 않는다. */
  gender?: string;
  /** 배역에 적은 연령대. 0이면 제한 없음. 있으면 설명 글의 '20대'보다 우선한다. */
  ageMin?: number;
  ageMax?: number;
};

export type MatchProfileInput = {
  gender: string;
  birthYear: number | null;
  region: string;
  intro: string;
  tags: string[];
  skills: string[];
  unavailableDates: string[];
};

function decadeOf(age: number) {
  return Math.floor(age / 10) * 10;
}

export function matchRoleForActor(
  profile: MatchProfileInput,
  role: MatchRoleInput,
  currentYear = new Date().getFullYear(),
): FitScore {
  const text = `${role.title} ${role.description} ${role.requirement}`;
  let score = 0;
  const reasons: string[] = [];

  // 성별: 배역에 적은 조건이 있으면 그것만 본다. '성별 무관'이면 설명 글에서도 추측하지 않는다.
  const wantedGender = role.gender === 'male' || role.gender === 'female' ? role.gender : '';
  if (wantedGender) {
    if (profile.gender === wantedGender) {
      score += 12;
      reasons.push('성별 조건 부합');
    } else {
      score -= 12;
    }
  } else if (role.gender !== 'any' && (/남성|남자/.test(text) || /여성|여자/.test(text))) {
    const wantsMale = /남성|남자/.test(text);
    const wantsFemale = /여성|여자/.test(text);
    const matches =
      (wantsMale && profile.gender === 'male') || (wantsFemale && profile.gender === 'female');
    if (matches) {
      score += 12;
      reasons.push('성별 조건 부합');
    } else if (wantsMale !== wantsFemale) {
      score -= 12;
    }
  }

  const age = koreanAge(profile.birthYear, currentYear);
  // 연령: 배역에 적은 연령대가 있으면 그것을, 없으면 설명 글의 '20대' 같은 표현을 본다.
  const minAge = role.ageMin ?? 0;
  const maxAge = role.ageMax ?? 0;
  const decadeMatch = minAge > 0 || maxAge > 0 ? null : text.match(/(\d)0대/);
  if (age !== null && (minAge > 0 || maxAge > 0)) {
    if ((!minAge || age >= minAge) && (!maxAge || age <= maxAge)) {
      score += 12;
      reasons.push('연령 조건 부합');
    } else {
      score -= 8;
    }
  } else if (age !== null && decadeMatch) {
    if (decadeOf(age) === Number(decadeMatch[1]) * 10) {
      score += 12;
      reasons.push(`${decadeMatch[1]}0대 조건 부합`);
    } else {
      score -= 8;
    }
  }

  if (profile.region && role.location.startsWith(profile.region.slice(0, 2))) {
    score += 15;
    reasons.push(`지역 일치 (${role.location})`);
  }

  const matchedTags = [...new Set(profile.tags)].filter((tag) => tag && text.includes(tag));
  if (matchedTags.length) {
    score += Math.min(matchedTags.length * 8, 32);
    reasons.push(`이미지 태그 일치 (${matchedTags.slice(0, 3).join('·')})`);
  }

  const matchedSkills = [...new Set(profile.skills)].filter(
    (skill) => skill && text.includes(skill),
  );
  if (matchedSkills.length) {
    score += Math.min(matchedSkills.length * 6, 18);
    reasons.push(`특기 일치 (${matchedSkills.slice(0, 3).join('·')})`);
  }

  const shootDays = role.shootDates?.length
    ? role.shootDates
    : role.shootDate
      ? [role.shootDate]
      : [];
  if (shootDays.length) {
    const clashes = shootDays.filter((day) => profile.unavailableDates.includes(day));
    if (clashes.length) {
      score -= 25;
      reasons.push(
        shootDays.length > 1
          ? `촬영일과 출연 불가일 겹침 (${clashes.length}일)`
          : '촬영일과 출연 불가일 겹침',
      );
    } else {
      score += 5;
    }
  }

  return { score: Math.max(0, Math.min(MAX_SCORE, Math.round(score))), reasons };
}
