// web/app/login/page.tsx
import LoginClient from './LoginClient';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function Page({ searchParams }: Props) {
  const nextRaw = searchParams?.next ?? '/spin';
  const next = Array.isArray(nextRaw) ? nextRaw[0] : nextRaw;
  // only allow internal paths
  const safeNext = typeof next === 'string' && next.startsWith('/') ? next : '/spin';

  return <LoginClient next={safeNext} />;
}
