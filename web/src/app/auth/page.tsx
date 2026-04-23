'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail,
  Lock,
  User,
  ArrowRight,
  Loader2,
  CheckCircle2,
  XCircle,
  Eye,
  EyeOff,
  UserCircle,
  LogIn,
  UserPlus,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

type LoadingKey = 'login' | 'signup' | 'google' | 'github' | 'guest' | null;
type MessageState = { type: 'success' | 'error'; text: string } | null;

function AuthPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams?.get('callbackUrl') || '/dashboard';
  const errorParam = searchParams?.get('error');

  const [isLoading, setIsLoading] = useState<LoadingKey>(null);
  const [showPassword, setShowPassword] = useState({ login: false, signup: false });
  const [messages, setMessages] = useState<{ login: MessageState; signup: MessageState }>({
    login: null,
    signup: null,
  });

  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [signupData, setSignupData] = useState({ name: '', email: '', password: '' });

  useEffect(() => {
    if (errorParam) {
      const errorMsg =
        errorParam === 'CredentialsSignin'
          ? 'Invalid email or password'
          : errorParam === 'DatabaseError'
            ? 'A server error occurred. Please try again.'
            : 'An error occurred during authentication';
      setMessages((prev) => ({ ...prev, login: { type: 'error', text: errorMsg } }));
    }
  }, [errorParam]);

  // ─── Login ───────────────────────────────────────────────────────────────────
  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessages((prev) => ({ ...prev, login: null }));

    // Client-side validation
    if (!loginData.email.trim() || !loginData.password.trim()) {
      setMessages((prev) => ({ ...prev, login: { type: 'error', text: 'Email and password are required' } }));
      return;
    }

    setIsLoading('login');
    try {
      const res = await signIn('credentials', {
        email: loginData.email,
        password: loginData.password,
        redirect: false,
      });

      if (res?.error) {
        throw new Error(
          res.error === 'CredentialsSignin' ? 'Invalid email or password' : res.error
        );
      }

      router.push(callbackUrl);
    } catch (err: any) {
      setMessages((prev) => ({ ...prev, login: { type: 'error', text: err.message } }));
    } finally {
      setIsLoading(null);
    }
  };

  // ─── Signup ──────────────────────────────────────────────────────────────────
  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setMessages((prev) => ({ ...prev, signup: null }));

    // Client-side validation — catch bad input before hitting the API
    if (!signupData.name.trim()) {
      setMessages((prev) => ({ ...prev, signup: { type: 'error', text: 'Full name is required' } }));
      return;
    }
    if (!signupData.email.trim()) {
      setMessages((prev) => ({ ...prev, signup: { type: 'error', text: 'Email is required' } }));
      return;
    }
    if (signupData.password.length < 8) {
      setMessages((prev) => ({
        ...prev,
        signup: { type: 'error', text: 'Password must be at least 8 characters' },
      }));
      return;
    }

    setIsLoading('signup');
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupData),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      setMessages((prev) => ({
        ...prev,
        signup: { type: 'success', text: 'Account created! Logging you in...' },
      }));

      // Auto-login after successful registration
      const loginRes = await signIn('credentials', {
        email: signupData.email,
        password: signupData.password,
        redirect: false,
      });

      if (loginRes?.error) {
        // Registration worked but auto-login failed — tell user to sign in manually
        throw new Error('Account created! Please sign in with your new credentials.');
      }

      router.push(callbackUrl);
    } catch (err: any) {
      setMessages((prev) => ({ ...prev, signup: { type: 'error', text: err.message } }));
    } finally {
      setIsLoading(null);
    }
  };

  // ─── Social Login ─────────────────────────────────────────────────────────────
  const handleSocialLogin = (provider: 'google' | 'github') => {
    setIsLoading(provider);
    // No try/catch needed — NextAuth handles redirect on failure for OAuth
    signIn(provider, { callbackUrl });
  };

  // ─── Guest Login ──────────────────────────────────────────────────────────────
  const handleGuestLogin = async () => {
    setIsLoading('guest');
    try {
      const res = await signIn('credentials', {
        // Pass the server secret — NOT a plain "true" string
        isGuest: process.env.NEXT_PUBLIC_GUEST_SECRET,
        redirect: false,
      });

      if (res?.error) {
        throw new Error('Guest login failed. Please try again.');
      }

      router.push(callbackUrl);
    } catch (err: any) {
      setMessages((prev) => ({
        ...prev,
        login: { type: 'error', text: err.message },
      }));
    } finally {
      setIsLoading(null);
    }
  };

  // ─── UI ───────────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-start p-4 md:p-8 relative overflow-hidden">
      {/* Background Glows */}
      <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 bg-indigo-600/10 blur-[120px] rounded-full" />
      <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-blue-600/10 blur-[120px] rounded-full" />

      {/* Header */}
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className="text-center mt-8 mb-12 relative z-10"
      >
        <div className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-blue-500 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-2xl shadow-indigo-500/20 ring-1 ring-white/20">
          <Lock className="text-white w-8 h-8" />
        </div>
        <h1 className="text-4xl font-extrabold text-white mb-3 tracking-tight">
          Get Started with MockMate
        </h1>
        <p className="text-slate-400 text-lg max-w-md mx-auto">
          One-click access or traditional account creation
        </p>
      </motion.div>

      {/* Social & Guest Section */}
      <motion.div
        initial={{ y: 20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="w-full max-w-4xl mb-12 space-y-6 relative z-10"
      >
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Google */}
          <button
            onClick={() => handleSocialLogin('google')}
            disabled={isLoading !== null}
            className="flex items-center justify-center gap-3 py-4 border border-white/5 rounded-2xl hover:bg-white/5 hover:border-indigo-500/30 transition-all text-slate-300 font-semibold bg-slate-900/50 shadow-xl group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading === 'google' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <svg className="w-6 h-6 group-hover:scale-110 transition-transform" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            )}
            <span className="text-lg">Continue with Google</span>
          </button>

          {/* GitHub */}
          <button
            onClick={() => handleSocialLogin('github')}
            disabled={isLoading !== null}
            className="flex items-center justify-center gap-3 py-4 border border-white/5 rounded-2xl hover:bg-white/5 hover:border-blue-500/30 transition-all text-slate-300 font-semibold bg-slate-900/50 shadow-xl group disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading === 'github' ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <svg className="w-6 h-6 group-hover:scale-110 transition-transform" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 .297c-6.63 0-12 5.373-12 12 0 5.303 3.438 9.8 8.205 11.385.6.113.82-.258.82-.577 0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61C4.422 18.07 3.633 17.7 3.633 17.7c-1.087-.744.084-.729.084-.729 1.205.084 1.838 1.236 1.838 1.236 1.07 1.835 2.809 1.305 3.495.998.108-.776.417-1.305.76-1.605-2.665-.3-5.466-1.332-5.466-5.93 0-1.31.465-2.38 1.235-3.22-.135-.303-.54-1.523.105-3.176 0 0 1.005-.322 3.3 1.23.96-.267 1.98-.399 3-.405 1.02.006 2.04.138 3 .405 2.28-1.552 3.285-1.23 3.285-1.23.645 1.653.24 2.873.12 3.176.765.84 1.23 1.91 1.23 3.22 0 4.61-2.805 5.625-5.475 5.92.43.372.823 1.102.823 2.222 0 1.606-.015 2.896-.015 3.286 0 .315.21.69.825.57C20.565 22.092 24 17.592 24 12.297c0-6.627-5.373-12-12-12" />
              </svg>
            )}
            <span className="text-lg">Continue with GitHub</span>
          </button>
        </div>

        {/* Guest */}
        <button
          onClick={handleGuestLogin}
          disabled={isLoading !== null}
          className="w-full flex items-center justify-center gap-3 py-4 text-slate-400 hover:text-indigo-400 border border-dashed border-white/10 hover:border-indigo-500/40 rounded-2xl transition-all group bg-slate-900/30 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isLoading === 'guest' ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              <UserCircle size={24} className="group-hover:scale-110 transition-transform" />
              <span className="text-lg font-medium">Continue as Guest Session</span>
              <ArrowRight size={20} className="opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
            </>
          )}
        </button>

        <div className="flex items-center gap-4">
          <div className="flex-1 h-px bg-white/5" />
          <span className="text-slate-600 text-sm font-bold uppercase tracking-widest px-4">
            OR USE EMAIL
          </span>
          <div className="flex-1 h-px bg-white/5" />
        </div>
      </motion.div>

      {/* Login + Signup Cards */}
      <div className="w-full max-w-6xl grid grid-cols-1 lg:grid-cols-2 gap-8 relative z-10 mb-12">

        {/* ── Login Card ── */}
        <motion.div
          initial={{ x: -30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="group bg-slate-900/40 backdrop-blur-xl border border-white/5 hover:border-indigo-500/20 p-8 rounded-[2.5rem] shadow-2xl transition-all"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-indigo-500/10 rounded-2xl">
              <LogIn className="w-6 h-6 text-indigo-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Returning User</h2>
              <p className="text-sm text-slate-500">Sign in to your account</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-400 ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type="email"
                  value={loginData.email}
                  onChange={(e) => setLoginData({ ...loginData, email: e.target.value })}
                  placeholder="you@email.com"
                  required
                  className="w-full bg-slate-800/30 border border-white/5 text-white rounded-2xl py-3.5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:bg-slate-800/60 transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <div className="flex justify-between items-center ml-1">
                <label className="text-sm font-medium text-slate-400">Password</label>
                <button type="button" className="text-xs text-indigo-400 hover:text-indigo-300">
                  Forgot password?
                </button>
              </div>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 group-focus-within:text-indigo-400 transition-colors" />
                <input
                  type={showPassword.login ? 'text' : 'password'}
                  value={loginData.password}
                  onChange={(e) => setLoginData({ ...loginData, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  className="w-full bg-slate-800/30 border border-white/5 text-white rounded-2xl py-3.5 pl-12 pr-12 focus:outline-none focus:ring-2 focus:ring-indigo-500/40 focus:bg-slate-800/60 transition-all placeholder:text-slate-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword({ ...showPassword, login: !showPassword.login })}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  {showPassword.login ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Login Message */}
            <AnimatePresence>
              {messages.login && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`p-4 rounded-xl text-sm flex gap-3 items-start ${messages.login.type === 'error'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}
                >
                  {messages.login.type === 'error' ? (
                    <XCircle size={18} className="shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                  )}
                  {messages.login.text}
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-500 shadow-xl shadow-indigo-500/20 text-lg font-bold"
              isLoading={isLoading === 'login'}
              disabled={isLoading !== null}
            >
              Sign In
            </Button>
          </form>
        </motion.div>

        {/* ── Signup Card ── */}
        <motion.div
          initial={{ x: 30, opacity: 0 }}
          animate={{ x: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
          className="group bg-slate-900/40 backdrop-blur-xl border border-white/5 hover:border-blue-500/20 p-8 rounded-[2.5rem] shadow-2xl transition-all"
        >
          <div className="flex items-center gap-3 mb-8">
            <div className="p-3 bg-blue-500/10 rounded-2xl">
              <UserPlus className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white">Create Account</h2>
              <p className="text-sm text-slate-500">Get your unique profile</p>
            </div>
          </div>

          <form onSubmit={handleSignup} className="space-y-4">
            {/* Name */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-400 ml-1">Full Name</label>
              <div className="relative">
                <User className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 group-focus-within:text-blue-400 transition-colors" />
                <input
                  type="text"
                  value={signupData.name}
                  onChange={(e) => setSignupData({ ...signupData, name: e.target.value })}
                  placeholder="John Doe"
                  required
                  className="w-full bg-slate-800/30 border border-white/5 text-white rounded-2xl py-3.5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:bg-slate-800/60 transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* Email */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-400 ml-1">Email</label>
              <div className="relative">
                <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 group-focus-within:text-blue-400 transition-colors" />
                <input
                  type="email"
                  value={signupData.email}
                  onChange={(e) => setSignupData({ ...signupData, email: e.target.value })}
                  placeholder="you@email.com"
                  required
                  className="w-full bg-slate-800/30 border border-white/5 text-white rounded-2xl py-3.5 pl-12 pr-4 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:bg-slate-800/60 transition-all placeholder:text-slate-600"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-slate-400 ml-1">
                Password
                <span className="text-slate-600 font-normal ml-2">(min. 8 characters)</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 w-5 h-5 group-focus-within:text-blue-400 transition-colors" />
                <input
                  type={showPassword.signup ? 'text' : 'password'}
                  value={signupData.password}
                  onChange={(e) => setSignupData({ ...signupData, password: e.target.value })}
                  placeholder="••••••••"
                  required
                  minLength={8}
                  className="w-full bg-slate-800/30 border border-white/5 text-white rounded-2xl py-3.5 pl-12 pr-12 focus:outline-none focus:ring-2 focus:ring-blue-500/40 focus:bg-slate-800/60 transition-all placeholder:text-slate-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword({ ...showPassword, signup: !showPassword.signup })}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                >
                  {showPassword.signup ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>

            {/* Signup Message */}
            <AnimatePresence>
              {messages.signup && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  className={`p-4 rounded-xl text-sm flex gap-3 items-start ${messages.signup.type === 'error'
                    ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20'
                    : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                    }`}
                >
                  {messages.signup.type === 'error' ? (
                    <XCircle size={18} className="shrink-0 mt-0.5" />
                  ) : (
                    <CheckCircle2 size={18} className="shrink-0 mt-0.5" />
                  )}
                  {messages.signup.text}
                </motion.div>
              )}
            </AnimatePresence>

            <Button
              type="submit"
              className="w-full h-14 rounded-2xl bg-blue-600 hover:bg-blue-500 shadow-xl shadow-blue-500/20 text-lg font-bold"
              isLoading={isLoading === 'signup'}
              disabled={isLoading !== null}
            >
              Sign Up
            </Button>
          </form>
        </motion.div>
      </div>

      {/* Footer */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
        className="text-center text-xs text-slate-600 relative z-10 pb-12"
      >
        By continuing, you implicitly agree to MockMate's{' '}
        <span className="text-slate-500 hover:text-white cursor-pointer px-1 transition-colors underline decoration-slate-800">
          Terms of Service
        </span>{' '}
        and{' '}
        <span className="text-slate-500 hover:text-white cursor-pointer px-1 transition-colors underline decoration-slate-800">
          Privacy Policy
        </span>
      </motion.p>
    </div>
  );
}

export default function AuthPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-slate-950" />}>
      <AuthPageContent />
    </Suspense>
  );
}
