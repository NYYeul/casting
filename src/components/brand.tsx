import Link from 'next/link';

// 로고는 크롬 질감. 밝은 배경에서도 읽히도록 어두운 강철색에 빛 띠 하나를 지나가게 한다.
export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <defs>
        <linearGradient id="cs-chrome" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3a4254" />
          <stop offset="0.42" stopColor="#0b0d12" />
          <stop offset="0.55" stopColor="#9aa4b5" />
          <stop offset="0.68" stopColor="#1c2230" />
          <stop offset="1" stopColor="#0b0d12" />
        </linearGradient>
      </defs>
      <path
        fill="url(#cs-chrome)"
        d="M20.2 5.6 4.9 3.4l.5-1.8a1 1 0 0 1 1.2-.7l14.6 2.2a1 1 0 0 1 .8 1.2l-.4 1.6a1 1 0 0 1-1.4.3Zm.3 2.9H3.5A1.5 1.5 0 0 0 2 10v9a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-9a1.5 1.5 0 0 0-1.5-1.5Z"
      />
      <circle cx="17.5" cy="15" r="1.6" fill="#c5ff45" />
    </svg>
  );
}

export function Brand({ href = '/' }: { href?: string }) {
  return (
    <Link href={href} className="brand-word" style={{ color: 'inherit' }}>
      <BrandMark />
      Casting Swipe
    </Link>
  );
}
