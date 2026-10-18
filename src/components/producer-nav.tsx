'use client';

import Link from 'next/link';
import { BrandMark } from './brand';

export type ProducerSection =
  'home' | 'applicants' | 'messages' | 'profile' | 'actors' | 'new-project';

const stroke = {
  width: 21,
  height: 21,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  'aria-hidden': true,
} as const;

const icons: Record<ProducerSection, React.ReactNode> = {
  home: (
    <svg {...stroke}>
      <path
        d="M3 7a2 2 0 0 1 2-2h4l2 2.5h8a2 2 0 0 1 2 2V17a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7Z"
        strokeLinejoin="round"
      />
    </svg>
  ),
  actors: (
    <svg {...stroke}>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m20 20-3.8-3.8" strokeLinecap="round" />
    </svg>
  ),
  applicants: (
    <svg {...stroke}>
      <circle cx="9" cy="8" r="3.2" />
      <path d="M3.5 19.5c.6-3.2 2.9-5 5.5-5s4.9 1.8 5.5 5" strokeLinecap="round" />
      <path d="M15.5 5.5a3.2 3.2 0 0 1 0 5.6M17.8 14.9c1.6.6 2.6 2 3 4" strokeLinecap="round" />
    </svg>
  ),
  messages: (
    <svg {...stroke}>
      <path d="M21 12a8 8 0 0 1-8 8H4l1.5-3A8 8 0 1 1 21 12Z" strokeLinejoin="round" />
    </svg>
  ),
  'new-project': (
    <svg {...stroke}>
      <rect x="4" y="4" width="16" height="16" rx="4" />
      <path d="M12 8.5v7M8.5 12h7" strokeLinecap="round" />
    </svg>
  ),
  profile: (
    <svg {...stroke}>
      <circle cx="12" cy="8" r="3.6" />
      <path d="M5 20c.8-3.8 3.7-6 7-6s6.2 2.2 7 6" strokeLinecap="round" />
    </svg>
  ),
};

const items: { key: ProducerSection; label: string; href: string; mobile: boolean }[] = [
  { key: 'home', label: '프로젝트', href: '/studio', mobile: true },
  { key: 'actors', label: '배우 찾기', href: '/studio/actors', mobile: true },
  { key: 'applicants', label: '지원자', href: '/studio?tab=applicants', mobile: true },
  { key: 'messages', label: '메시지', href: '/studio?tab=messages', mobile: true },
  { key: 'new-project', label: '프로젝트 등록', href: '/studio/projects/new', mobile: false },
  { key: 'profile', label: '내 정보', href: '/studio?tab=profile', mobile: true },
];

type StudioTab = 'home' | 'applicants' | 'messages' | 'profile';

export default function ProducerNav({
  active,
  onTab,
  badge,
}: {
  active: ProducerSection;
  onTab?: (tab: StudioTab) => void;
  badge?: Partial<Record<ProducerSection, boolean>>;
}) {
  return (
    <nav className="pnav" aria-label="제작자 메뉴">
      <div className="pnav-brand">
        <BrandMark />
        Casting Swipe
      </div>
      {items.map((item) => {
        const content = (
          <>
            <span className="nav-ic">
              {icons[item.key]}
              {badge?.[item.key] && <span className="nav-dot" />}
            </span>
            {item.label}
          </>
        );
        const className = `${active === item.key ? 'active' : ''}${item.mobile ? '' : ' desk-only'}`;
        const isTab = ['home', 'applicants', 'messages', 'profile'].includes(item.key);
        return onTab && isTab ? (
          <button key={item.key} className={className} onClick={() => onTab(item.key as StudioTab)}>
            {content}
          </button>
        ) : (
          <Link key={item.key} href={item.href} className={className}>
            {content}
          </Link>
        );
      })}
    </nav>
  );
}
