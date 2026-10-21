import { DemoEntry } from '@/components/demo-entry';
import { Brand } from '@/components/brand';
import { redirect } from 'next/navigation';
import { getSession, homeFor } from '@/lib/auth';
import LoginForm from './login-form';

export const dynamic = 'force-dynamic';

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const session = await getSession();
  if (session) redirect(homeFor(session.role));
  if (process.env.DEMO_MODE === 'true') {
    return (
      <main className="auth-page">
        <header className="auth-top">
          <Brand />
        </header>
        <section className="auth-card wide-card">
          <h1>캐스팅을 바로 체험해 보세요</h1>
          <p className="muted">역할을 고르면 준비된 프로젝트와 배우들을 만나볼 수 있어요.</p>
          <DemoEntry />
        </section>
      </main>
    );
  }
  const { next } = await searchParams;
  const safeNext = next && next.startsWith('/') && !next.startsWith('//') ? next : '';
  return <LoginForm next={safeNext} />;
}
