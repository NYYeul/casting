import Link from 'next/link';

export function BrandMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M20.2 5.6 4.9 3.4l.5-1.8a1 1 0 0 1 1.2-.7l14.6 2.2a1 1 0 0 1 .8 1.2l-.4 1.6a1 1 0 0 1-1.4.3Zm.3 2.9H3.5A1.5 1.5 0 0 0 2 10v9a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3v-9a1.5 1.5 0 0 0-1.5-1.5Z" />
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
