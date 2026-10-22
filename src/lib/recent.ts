// '최근 본' 목록. 브라우저에만 남는다.
//
// 서버에 저장하지 않는 이유: 최근 본 기록은 개인의 흔적이라 기기별로 남는 게 자연스럽고,
// 데모 환경의 저장소가 임시 폴더라 서버에 넣으면 금방 사라진다.
// 저장이 막힌 브라우저(시크릿 모드 등)에서도 화면이 깨지지 않게 전부 감싸 둔다.

export type RecentItem = {
  id: string;
  name: string;
  /** 이름 아래 한 줄 (지역·나이, 배역명 등) */
  sub: string;
  photo: string;
  href: string;
  at: number;
};

export const RECENT_ACTORS = 'casting_recent_actors';
export const RECENT_ROLES = 'casting_recent_roles';

const LIMIT = 12;

export function loadRecent(key: string): RecentItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(parsed) ? (parsed as RecentItem[]).filter((item) => item?.id) : [];
  } catch {
    return [];
  }
}

/** 같은 대상은 하나만 남기고 맨 앞으로 올린다. */
export function pushRecent(key: string, item: Omit<RecentItem, 'at'>) {
  if (!item.id) return;
  try {
    const rest = loadRecent(key).filter((saved) => saved.id !== item.id);
    localStorage.setItem(
      key,
      JSON.stringify([{ ...item, at: Date.now() }, ...rest].slice(0, LIMIT)),
    );
  } catch {
    /* 저장이 막혀 있으면 기록을 남기지 않을 뿐, 화면은 그대로 쓴다 */
  }
}
