'use client';

import { useSession } from 'next-auth/react';
import { Navbar } from '@/components/Navbar';
import DashboardContent from '@/components/DashboardContent';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export default function DashboardPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === 'unauthenticated') router.push('/');
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  if (!session) return null;

  return (
    <main className="flex min-h-screen flex-col bg-slate-950">
      <Navbar />
      <DashboardContent user={session.user} />
    </main>
  );
}
