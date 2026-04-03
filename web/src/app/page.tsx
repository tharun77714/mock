'use client';

import { useSession } from 'next-auth/react';
import { Navbar } from '@/components/Navbar';
import { LandingHero } from '@/components/LandingHero';
import DashboardContent from '@/components/DashboardContent';

export default function Home() {
  const { data: session, status } = useSession();

  if (status === 'loading') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950">
        <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <main className="flex min-h-screen flex-col bg-slate-950">
      <Navbar />
      {session ? (
        <DashboardContent user={session.user} />
      ) : (
        <>
          <LandingHero />
        </>
      )}
    </main>
  );
}
