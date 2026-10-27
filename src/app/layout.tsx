import type { Metadata, Viewport } from 'next';
import { NavTracker } from '@/components/back-button';
import './globals.css';

export const metadata: Metadata = {
  title: '캐스팅플로우',
  description: '배역 지원부터 오디션 후보 선정까지, 작은 제작팀을 위한 모바일 캐스팅 도구',
  applicationName: '캐스팅플로우',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: '캐스팅' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f4f6fa',
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>
        <NavTracker />
        {children}
      </body>
    </html>
  );
}
