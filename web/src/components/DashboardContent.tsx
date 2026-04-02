'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from './ui/Button';
import { Plus, History, Clock, FileText, TrendingUp, Zap, ArrowRight } from 'lucide-react';
import Link from 'next/link';

function GlassCard({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] }}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`relative overflow-hidden rounded-2xl bg-white/[0.03] border border-white/10 backdrop-blur-xl ${className}`}
    >
      <div className="absolute inset-0 bg-gradient-to-br from-white/[0.02] to-transparent pointer-events-none" />
      {children}
    </motion.div>
  );
}

export default function DashboardContent({ user }: { user: any }) {
  const [interviews, setInterviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchInterviews() {
      try {
        const resp = await fetch("/api/interviews/list");
        const data = await resp.json();
        setInterviews(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchInterviews();
  }, []);

  const avgConfidence = interviews.length > 0
    ? Math.round(interviews.reduce((acc, curr) => acc + (curr.analysis?.confidence || 0), 0) / interviews.length)
    : 0;

  const bestScore = interviews.length > 0
    ? Math.max(...interviews.map(i => i.analysis?.overallScore || i.analysis?.confidence || 0))
    : 0;

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <motion.header
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="mb-12 flex flex-col items-start justify-between gap-6 sm:flex-row sm:items-center"
      >
        <div>
          <h1 className="text-3xl font-bold text-white tracking-tight">
            Welcome back, <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-emerald-400">{user?.name?.split(' ')[0]}</span>
          </h1>
          <p className="mt-2 text-slate-400">
            You have completed {interviews.length} interview{interviews.length !== 1 ? 's' : ''}. Ready to practice?
          </p>
        </div>
        <Link href="/interview/new">
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button size="lg" className="gap-2 shrink-0 shadow-lg shadow-indigo-500/20">
              <Plus className="h-5 w-5" />
              New Interview Session
            </Button>
          </motion.div>
        </Link>
      </motion.header>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-8">
          {/* Stats */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-3">
            {[
              { label: 'Total Sessions', value: interviews.length.toString(), icon: History, color: 'from-blue-500 to-cyan-500', glow: 'shadow-blue-500/20' },
              { label: 'Avg. Confidence', value: `${avgConfidence}%`, icon: TrendingUp, color: 'from-emerald-500 to-green-500', glow: 'shadow-emerald-500/20' },
              { label: 'Best Score', value: `${bestScore}%`, icon: Zap, color: 'from-amber-500 to-orange-500', glow: 'shadow-amber-500/20' },
            ].map((stat, i) => (
              <GlassCard key={i} delay={i * 0.1} className={`p-6 group cursor-default shadow-lg ${stat.glow}`}>
                <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${stat.color} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-lg`}>
                  <stat.icon className="h-5 w-5 text-white" />
                </div>
                <p className="text-sm font-medium text-slate-400">{stat.label}</p>
                <motion.p
                  className="mt-1 text-3xl font-bold text-white"
                  initial={{ opacity: 0, scale: 0.5 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.3 + i * 0.1, type: "spring", stiffness: 200 }}
                >
                  {stat.value}
                </motion.p>
              </GlassCard>
            ))}
          </div>

          {/* Recent Interviews */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-white">Recent Interviews</h2>
            </div>
            
            {loading ? (
              <div className="space-y-4">
                {[1, 2, 3].map(i => (
                  <div key={i} className="h-20 rounded-2xl bg-white/5 border border-white/5 animate-pulse" />
                ))}
              </div>
            ) : interviews.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex flex-col items-center justify-center h-64 rounded-3xl bg-white/[0.02] border-2 border-dashed border-white/10 text-center p-8"
              >
                <motion.div
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 3, repeat: Infinity }}
                  className="h-16 w-16 rounded-2xl bg-gradient-to-br from-indigo-500/20 to-blue-500/20 flex items-center justify-center mb-4"
                >
                  <FileText className="h-8 w-8 text-indigo-400" />
                </motion.div>
                <h3 className="text-lg font-medium text-white">No interviews yet</h3>
                <p className="mt-2 text-sm text-slate-400 max-w-xs">
                  Start your first session to get AI-powered deep learning feedback.
                </p>
                <Link href="/interview/new">
                  <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                    <Button variant="outline" size="sm" className="mt-6 gap-2">
                      Start Your First Session <ArrowRight className="h-4 w-4" />
                    </Button>
                  </motion.div>
                </Link>
              </motion.div>
            ) : (
              <div className="space-y-3">
                <AnimatePresence>
                  {interviews.map((item, i) => (
                    <motion.div
                      key={item._id}
                      initial={{ opacity: 0, x: -30 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 30 }}
                      transition={{ delay: i * 0.05, duration: 0.4 }}
                      whileHover={{ x: 4, backgroundColor: 'rgba(255,255,255,0.05)' }}
                      className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/10 transition-colors group"
                    >
                      <div className="flex items-center gap-4">
                        <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${
                          item.status === 'completed' 
                            ? 'bg-gradient-to-br from-emerald-500/20 to-green-500/20 text-emerald-400' 
                            : 'bg-gradient-to-br from-amber-500/20 to-orange-500/20 text-amber-500'
                        } group-hover:scale-110 transition-transform`}>
                          {item.status === 'completed' ? <TrendingUp className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
                        </div>
                        <div>
                          <p className="text-sm font-bold text-white">Mock Interview #{interviews.length - i}</p>
                          <p className="text-xs text-slate-500">{new Date(item.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="hidden sm:block text-right">
                          <p className="text-[10px] text-slate-500 uppercase font-bold tracking-widest">Score</p>
                          <p className={`text-lg font-bold ${
                            (item.analysis?.overallScore || item.analysis?.confidence || 0) > 75 ? 'text-emerald-400' : 'text-indigo-400'
                          }`}>
                            {item.analysis?.overallScore || item.analysis?.confidence || 0}%
                          </p>
                        </div>
                        <Link href={`/interview/${item._id}`}>
                          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
                            <Button variant="secondary" size="sm" className="gap-1">
                              View <ArrowRight className="h-3 w-3" />
                            </Button>
                          </motion.div>
                        </Link>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </section>
        </div>

        {/* Sidebar */}
        <aside className="space-y-6">
          <GlassCard delay={0.3} className="p-8 bg-gradient-to-br from-indigo-500/10 to-blue-500/5">
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="text-3xl mb-4"
            >
              💡
            </motion.div>
            <h3 className="text-lg font-bold text-white">Interview Tip</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">
              Maintaining consistent eye contact with the camera significantly increases your perceived confidence score in our EfficientNet-B0 emotion analysis.
            </p>
          </GlassCard>

          <GlassCard delay={0.4} className="p-6">
            <h3 className="text-sm font-semibold text-white uppercase tracking-wider mb-4">System Status</h3>
            <ul className="space-y-4">
              {[
                { label: 'AI Voice Engine', status: true },
                { label: 'EfficientNet-B0 Emotion Model', status: true },
                { label: 'Video Recorder', status: true },
              ].map((item, i) => (
                <motion.li
                  key={i}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 + i * 0.1 }}
                  className="flex items-center gap-3 text-sm text-slate-400"
                >
                  <motion.div
                    animate={{ scale: [1, 1.3, 1] }}
                    transition={{ duration: 2, repeat: Infinity, delay: i * 0.3 }}
                    className="h-2 w-2 rounded-full bg-emerald-500 shadow-lg shadow-emerald-500/50"
                  />
                  {item.label}
                </motion.li>
              ))}
            </ul>
          </GlassCard>
        </aside>
      </div>
    </div>
  );
}
