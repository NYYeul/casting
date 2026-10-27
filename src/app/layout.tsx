import type { Metadata, Viewport } from 'next';
import './globals.css';
import { DemoSwitch } from '@/components/demo-switch';
import { getSession } from '@/lib/auth';

export const metadata: Metadata = {
  title: '캐스팅 스와이프',
  description: '배역 지원부터 오디션 후보 선정까지, 작은 제작팀을 위한 모바일 캐스팅 도구',
  applicationName: '캐스팅 스와이프',
  appleWebApp: { capable: true, statusBarStyle: 'default', title: '캐스팅' },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#f4f6fa',
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const session = process.env.DEMO_MODE === 'true' ? await getSession() : null;
  return (
    <html lang="ko">
      <body>
        {children}
        {session && <DemoSwitch role={session.role} />}
      </body>
    </html>
  );
}
