// web/app/admin/login/page.tsx
import AdminLoginClient from './AdminLoginClient';

export const dynamic = 'force-dynamic';

type Props = {
  searchParams?: Record<string, string | string[] | undefined>;
};

export default function Page({ searchParams }: Props) {
  const nextRaw = searchParams?.next ?? '/admin';
  const next = Array.isArray(nextRaw) ? nextRaw[0] : nextRaw;
  const safeNext = typeof next === 'string' && next.startsWith('/') ? next : '/admin';

  return <AdminLoginClient next={safeNext} />;
}
