import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: '캐스팅 스와이프',
    short_name: '캐스팅',
    description: '모바일 캐스팅 지원·검토 도구',
    start_url: '/studio',
    display: 'standalone',
    background_color: '#f7f8fc',
    theme_color: '#f7f8fc',
    icons: [
      { src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
    ],
  };
}
