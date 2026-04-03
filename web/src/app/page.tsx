'use client';

import { useSession } from 'next-auth/react';
import { Navbar } from '@/components/Navbar';
import { LandingHero } from '@/components/LandingHero';
import DashboardContent from '@/components/DashboardContent';
import { motion } from 'framer-motion';

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
    <motion.main
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: 'easeOut' }}
      className="relative flex min-h-screen flex-col bg-transparent"
    >
      <Navbar />
      {session ? (
        <DashboardContent user={session.user} />
      ) : (
        <>
          <LandingHero />
        </>
      )}
    </motion.main>
  );
}
