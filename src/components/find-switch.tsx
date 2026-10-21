import Link from 'next/link';

/**
 * 배우 추천 ↔ 배우 검색 전환.
 * 추천 화면은 데스크톱 메뉴(desk-only)에만 있어서 모바일에서는 이 줄이 유일한 입구다.
 * 둘 다 '아직 지원하지 않은 배우를 찾는' 같은 일이라 한 묶음으로 둔다.
 */
export default function FindSwitch({ active }: { active: 'recommend' | 'search' }) {
  return (
    <nav className="find-switch" aria-label="배우 찾기 방법">
      <Link
        href="/studio/recommend"
        className={active === 'recommend' ? 'on' : ''}
        aria-current={active === 'recommend' ? 'page' : undefined}
      >
        배역에 맞는 추천
      </Link>
      <Link
        href="/studio/actors"
        className={active === 'search' ? 'on' : ''}
        aria-current={active === 'search' ? 'page' : undefined}
      >
        조건으로 검색
      </Link>
    </nav>
  );
}
