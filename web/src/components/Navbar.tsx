'use client';

import React from 'react';
import Link from 'next/link';
import { useSession, signIn, signOut } from 'next-auth/react';
import { Button } from './ui/Button';
import { LayoutDashboard, LogOut, User as UserIcon, FileText } from 'lucide-react';
import { motion } from 'framer-motion';
import { StudentProfileModal } from './StudentProfileModal';

export const Navbar = () => {
  const { data: session } = useSession();
  const [isProfileModalOpen, setIsProfileModalOpen] = React.useState(false);

  return (
    <>
    <motion.nav
      initial={{ y: -20, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.4 }}
      className="sticky top-0 z-50 w-full border-b border-slate-700/40 bg-slate-950/65 backdrop-blur-2xl"
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center space-x-2 group">
          <motion.div
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.98 }}
            className="h-8 w-8 rounded-lg bg-gradient-to-br from-indigo-500 to-cyan-500 flex items-center justify-center shadow-lg shadow-indigo-500/20"
          >
            <span className="text-lg font-bold text-white">M</span>
          </motion.div>
          <span className="text-xl font-bold tracking-tight text-white transition-opacity group-hover:opacity-80">MockMate</span>
        </Link>

        <div className="flex items-center space-x-4">
          {session ? (
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <motion.div
                  whileHover={{ y: -1 }}
                  className="flex items-center space-x-2 text-sm font-medium text-slate-400 hover:text-cyan-100 transition-colors"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  <span>Dashboard</span>
                </motion.div>
              </Link>
              <Link href="/resume-builder">
                <motion.div
                  whileHover={{ y: -1 }}
                  className="flex items-center space-x-2 text-sm font-medium text-slate-400 hover:text-cyan-100 transition-colors"
                >
                  <FileText className="h-4 w-4" />
                  <span>Resume Builder</span>
                </motion.div>
              </Link>
              <div className="h-4 w-px bg-slate-800" />
              <div className="flex items-center space-x-3">
                {session.user?.image ? (
                  <motion.img
                    whileHover={{ scale: 1.1 }}
                    src={session.user.image} 
                    alt="User" 
                    onClick={() => setIsProfileModalOpen(true)}
                    className="h-8 w-8 rounded-full border border-white/10 shadow-lg cursor-pointer hover:border-indigo-500/50 transition-colors"
                  />
                ) : (
                  <div 
                    className="h-8 w-8 rounded-full bg-slate-800 flex items-center justify-center cursor-pointer hover:bg-slate-700 transition-colors"
                    onClick={() => setIsProfileModalOpen(true)}
                  >
                    <UserIcon className="h-4 w-4 text-slate-400" />
                  </div>
                )}
                <motion.div whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}>
                  <Button 
                    variant="ghost" size="sm" 
                    onClick={() => signOut()}
                    className="!p-1 text-slate-400 hover:text-red-400"
                  >
                    <LogOut className="h-4 w-4" />
                  </Button>
                </motion.div>
              </div>
            </div>
          ) : (
            <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
              <Button onClick={() => signIn()} size="sm" className="shadow-lg shadow-indigo-500/20">
                Sign In / Sign Up
              </Button>
            </motion.div>
          )}
        </div>
      </div>
    </motion.nav>
    <StudentProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        sessionEmail={session?.user?.email}
        sessionName={session?.user?.name}
    />
    </>
  );
};
