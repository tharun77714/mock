'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Navbar } from '@/components/Navbar';
import { Button } from '@/components/ui/Button';
import { 
  FileText, TrendingUp, CheckCircle2, AlertCircle, ArrowLeft,
  Download, Share2, Play, Eye, User, Activity, Brain, MessageCircle,
  Gauge, Mic2, Mic, Sparkles, BookOpen, ChevronRight
} from 'lucide-react';
import { motion } from 'framer-motion';

function ScoreRing({ score, size = 120, label, color = "indigo" }: { score: number; size?: number; label: string; color?: string }) {
  const colors: Record<string, string> = {
    indigo: "text-indigo-500",
    emerald: "text-emerald-500",
    amber: "text-amber-500",
    rose: "text-rose-500",
    blue: "text-blue-500",
  };
  return (
    <div className="relative flex flex-col items-center gap-2">
      <div className="relative" style={{ width: size, height: size }}>
        <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
          <path className="text-slate-800 stroke-current" strokeWidth="3" fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
          <path className={`${colors[color] || colors.indigo} stroke-current`} strokeWidth="3"
            strokeDasharray={`${score}, 100`} strokeLinecap="round" fill="none"
            d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center flex-col">
          <span className="text-2xl font-bold text-white">{score}%</span>
        </div>
      </div>
      <span className="text-[10px] text-slate-400 uppercase font-bold tracking-widest">{label}</span>
    </div>
  );
}

function MetricCard({ 
  icon: Icon, title, value, subtitle, color = "indigo", onClick, children 
}: { 
  icon: any; title: string; value: string; subtitle?: string; color?: string; onClick?: () => void; children?: React.ReactNode 
}) {
  const colors: Record<string, string> = {
    indigo: "text-indigo-400 bg-indigo-500/10 border-indigo-500/20",
    emerald: "text-emerald-400 bg-emerald-500/10 border-emerald-500/20",
    amber: "text-amber-400 bg-amber-500/10 border-amber-500/20",
    rose: "text-rose-400 bg-rose-500/10 border-rose-500/20",
    blue: "text-blue-400 bg-blue-500/10 border-blue-500/20",
  };
  const [textColor] = (colors[color] || colors.indigo).split(" ");
  return (
    <div 
      onClick={onClick}
      className={`p-5 rounded-2xl border ${colors[color] || colors.indigo} ${onClick ? 'cursor-pointer hover:bg-opacity-80 hover:border-opacity-50 transition-all duration-200' : ''}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <Icon className={`h-5 w-5 ${textColor}`} />
        <h4 className="text-sm font-bold text-white">{title}</h4>
      </div>
      <p className={`text-2xl font-bold ${textColor}`}>{value}</p>
      {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
      {children}
    </div>
  );
}

export default function SummaryPage() {
  const { id } = useParams();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showEmotions, setShowEmotions] = useState(false);

  useEffect(() => {
    async function fetchInterview() {
      try {
        const resp = await fetch(`/api/interviews/${id}`);
        const result = await resp.json();
        setData(result);
      } catch (err) {
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchInterview();
  }, [id]);

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="h-12 w-12 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent" />
    </div>
  );

  if (!data) return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950">
      <div className="text-center">
        <h1 className="text-2xl font-bold text-white">Interview not found</h1>
        <Button className="mt-4" onClick={() => router.push('/dashboard')}>Back to Dashboard</Button>
      </div>
    </div>
  );

  const a = data.analysis || {};
  const looksLikePlaceholderVoice =
    a?.voiceAnalysis &&
    [a.voiceAnalysis.confidence_score, a.voiceAnalysis.pitch_score, a.voiceAnalysis.fluency_score, a.voiceAnalysis.energy_score]
      .every((v: any) => typeof v === 'number' && Math.abs(v - 0.5) < 0.0001);
  const transcriptMessages = (() => {
    try { return JSON.parse(data.transcript); } catch { return null; }
  })();

  return (
    <main className="flex min-h-screen flex-col bg-slate-950">
      <Navbar />
      
      <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <button 
          onClick={() => router.push('/dashboard')}
          className="flex items-center gap-2 text-slate-400 hover:text-white transition-colors mb-8 group"
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-1 transition-transform" />
          Back to Dashboard
        </button>

        {/* Header */}
        <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-4xl font-bold text-white tracking-tight">Interview Analysis</h1>
            <p className="mt-2 text-slate-400">Conducted on {new Date(data.createdAt).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}</p>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" className="gap-2" onClick={() => router.push('/interview/new')}>
              Start Another Session
            </Button>
          </div>
        </header>

        {/* Overall Score Banner */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          className="p-8 rounded-3xl bg-gradient-to-br from-indigo-500/10 to-blue-500/10 border border-white/10 mb-8"
        >
          <div className="flex flex-col sm:flex-row items-center gap-8">
            <ScoreRing score={a.overallScore || a.confidence || 0} size={140} label="Overall Score" color="indigo" />
            <div className="flex-1">
              <h3 className="text-2xl font-bold text-white mb-2">{a.emotion || "Analysis Pending"}</h3>
              <p className="text-slate-400 leading-relaxed">{a.communication || "Complete an interview to get your analysis."}</p>
            </div>
            <div className="flex gap-6">
              <ScoreRing score={a.confidence || 0} size={90} label="Confidence" color="emerald" />
              <ScoreRing score={a.eyeContact?.score || 0} size={90} label="Eye Contact" color="blue" />
              <ScoreRing score={a.headStability?.score || 0} size={90} label="Stability" color="amber" />
            </div>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Metric Cards */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <MetricCard icon={Eye} title="Eye contact (gaze)" value={a.eyeContact?.label || "N/A"} subtitle={`${a.eyeContact?.score ?? 0}% toward camera`} color="blue" />
              {a.faceInFrame != null && (
                <MetricCard icon={User} title="Face in frame" value={a.faceInFrame.label || "—"} subtitle={`${a.faceInFrame.score ?? 0}% of sampled frames`} color="emerald" />
              )}
              <MetricCard icon={Activity} title="Head Stability" value={a.headStability?.label || "N/A"} subtitle={`${a.headStability?.score || 0}% (movement)`} color="amber" />
              <MetricCard 
                icon={Brain} 
                title="Facial Expression" 
                value={a.facialExpression?.dominant || "N/A"} 
                subtitle={showEmotions ? "Hide percentage breakdown" : "Click to view breakdown"} 
                color="indigo"
                onClick={() => setShowEmotions(!showEmotions)}
              >
                <div 
                  className={`overflow-hidden transition-all duration-300 ease-in-out ${showEmotions ? 'max-h-64 opacity-100 mt-4' : 'max-h-0 opacity-0 mt-0'}`}
                >
                  <div className="space-y-2 border-t border-indigo-500/20 pt-4 pb-1">
                    {a.facialExpression?.breakdown && Object.entries(a.facialExpression.breakdown)
                      .sort(([, a]: any, [, b]: any) => b - a)
                      .map(([emotion, percentage]: [string, any]) => (
                        <div key={emotion} className="flex items-center gap-2">
                          <span className="w-16 text-[10px] text-indigo-300 capitalize font-bold tracking-wider">{emotion}</span>
                          <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-indigo-500 rounded-full transition-all duration-500"
                              style={{ width: `${percentage}%` }}
                            />
                          </div>
                          <span className="text-[10px] font-bold text-slate-300 w-8 text-right">{percentage}%</span>
                        </div>
                      ))}
                  </div>
                </div>
              </MetricCard>
              <MetricCard icon={MessageCircle} title="Filler Words" value={`${a.fillerWords?.count || 0}`} subtitle={`${a.fillerWords?.perMinute || 0}/min`} color="rose" />
              <MetricCard icon={Gauge} title="Speaking Pace" value={`${a.speakingPace?.wpm || 0} wpm`} subtitle={a.speakingPace?.label || ""} color="emerald" />
              <MetricCard icon={TrendingUp} title="Posture" value={a.posture?.label || "N/A"} subtitle={a.posture?.details || ""} color="blue" />
            </div>

            {/* Voice Analysis — CNN+BiLSTM */}
            {a.voiceAnalysis && !looksLikePlaceholderVoice && (
              <section className="p-6 rounded-3xl bg-gradient-to-br from-purple-500/10 to-indigo-500/10 border border-purple-500/20">
                <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                  <Mic className="h-5 w-5 text-purple-400" />
                  Voice Confidence Analysis
                  <span className="ml-auto text-[10px] font-bold text-purple-400 uppercase tracking-widest px-2 py-1 rounded-full bg-purple-500/10 border border-purple-500/20">
                    CNN+BiLSTM Model
                  </span>
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-4">
                  {[
                    { label: 'Voice Confidence', value: Math.round(a.voiceAnalysis.confidence_score * 100), color: 'purple' },
                    { label: 'Pitch Stability',  value: Math.round(a.voiceAnalysis.pitch_score * 100),      color: 'blue' },
                    { label: 'Fluency',          value: Math.round(a.voiceAnalysis.fluency_score * 100),    color: 'emerald' },
                    { label: 'Energy Level',     value: Math.round(a.voiceAnalysis.energy_score * 100),     color: 'amber' },
                  ].map(({ label, value, color }) => (
                    <div key={label} className={`p-4 rounded-2xl bg-${color}-500/10 border border-${color}-500/20 text-center`}>
                      <p className={`text-2xl font-bold text-${color}-400`}>{value}%</p>
                      <p className="text-xs text-slate-400 mt-1">{label}</p>
                      <div className="mt-2 h-1.5 bg-slate-800 rounded-full overflow-hidden">
                        <div className={`h-full bg-${color}-500 rounded-full`} style={{ width: `${value}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 text-sm text-slate-400">
                  <span className="px-2 py-1 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 font-bold text-xs capitalize">
                    {a.voiceAnalysis.voice_emotion}
                  </span>
                  <span>voice emotion detected</span>
                </div>
              </section>
            )}

            {/* Filler Words Detail */}
            {a.fillerWords?.details && Object.keys(a.fillerWords.details).length > 0 && (
              <section className="p-6 rounded-3xl bg-white/5 border border-white/10">
                <h3 className="text-lg font-bold text-white mb-5 flex items-center gap-2">
                  <Mic2 className="h-5 w-5 text-rose-400" />
                  Filler Words Detected
                </h3>
                <div className="flex flex-wrap gap-3">
                  {Object.entries(a.fillerWords.details)
                    .sort(([, a]: any, [, b]: any) => b - a)
                    .map(([word, count]: [string, any]) => (
                      <div key={word} className="px-4 py-2 rounded-full bg-rose-500/10 border border-rose-500/20">
                        <span className="text-rose-400 font-bold">"{word}"</span>
                        <span className="text-slate-400 ml-2">{count}x</span>
                      </div>
                    ))}
                </div>
              </section>
            )}

            {/* Suggestions */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <section className="p-6 rounded-3xl bg-white/5 border border-white/10">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-emerald-400" />
                  Strengths
                </h3>
                <ul className="space-y-3">
                  {(a.confidence || 0) > 60 && (
                    <li className="text-sm text-slate-400 flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      Maintained {a.confidence}% confidence throughout the session.
                    </li>
                  )}
                  {(a.eyeContact?.score || 0) > 70 && (
                    <li className="text-sm text-slate-400 flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      {a.eyeContact.label} eye contact with {a.eyeContact.score}% face visibility.
                    </li>
                  )}
                  {(a.headStability?.score || 0) > 60 && (
                    <li className="text-sm text-slate-400 flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      {a.headStability.label} head position — shows composure.
                    </li>
                  )}
                  {(a.fillerWords?.count || 0) < 5 && (
                    <li className="text-sm text-slate-400 flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-emerald-500 mt-1.5 shrink-0" />
                      Minimal filler words — clear and articulate speech.
                    </li>
                  )}
                </ul>
              </section>

              <section className="p-6 rounded-3xl bg-white/5 border border-white/10">
                <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-indigo-400" />
                  AI Coaching Suggestions
                  <span className="ml-auto text-[10px] font-bold text-indigo-400 uppercase tracking-widest">AI (Groq / OpenAI / Gemini)</span>
                </h3>
                <ul className="space-y-3">
                  {a.suggestions?.map((s: string, i: number) => (
                    <li key={i} className="text-sm text-slate-400 flex items-start gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 mt-1.5 shrink-0" />
                      {s}
                    </li>
                  ))}
                </ul>
              </section>
            </div>

            {/* English Coaching (Gemini) */}
            {a.englishCoaching && (
              <section className="p-8 rounded-3xl bg-emerald-500/10 border border-emerald-500/20">
                <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-emerald-400" />
                  English & Communication Coaching
                  <span className="ml-auto text-[10px] font-bold text-emerald-400 uppercase tracking-widest px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
                    AI (Groq / OpenAI / Gemini)
                  </span>
                </h3>
                
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                    <p className="text-sm font-bold text-emerald-400">{a.englishCoaching.english_level}</p>
                    <p className="text-xs text-slate-400 mt-1">Level</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                    <p className="text-2xl font-bold text-white">{a.englishCoaching.overall_language_score}%</p>
                    <p className="text-xs text-slate-400 mt-1">Overall Score</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                    <p className="text-2xl font-bold text-white">{a.englishCoaching.communication_score?.clarity || 0}%</p>
                    <p className="text-xs text-slate-400 mt-1">Clarity</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/5 border border-white/10 text-center">
                    <p className="text-2xl font-bold text-white">{a.englishCoaching.communication_score?.professionalism || 0}%</p>
                    <p className="text-xs text-slate-400 mt-1">Professionalism</p>
                  </div>
                </div>

                {a.englishCoaching.improvements && a.englishCoaching.improvements.length > 0 && (
                  <div className="space-y-4 mb-6">
                    <h4 className="text-sm font-bold text-white uppercase tracking-widest">Areas for Improvement</h4>
                    {a.englishCoaching.improvements.map((imp: any, i: number) => (
                      <div key={i} className="p-4 rounded-2xl bg-white/5 border border-white/10">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="px-2 py-0.5 rounded-full bg-rose-500/20 text-rose-400 text-[10px] font-bold uppercase tracking-widest">
                            {imp.area}
                          </span>
                        </div>
                        <p className="text-sm text-slate-300 mb-1"><span className="text-slate-500">Observed:</span> "{imp.issue}"</p>
                        <p className="text-sm text-emerald-400 font-medium"><span className="text-slate-500">Tip:</span> {imp.tip}</p>
                      </div>
                    ))}
                  </div>
                )}

                {a.englishCoaching.vocabulary_tips && a.englishCoaching.vocabulary_tips.length > 0 && (
                  <div>
                    <h4 className="text-sm font-bold text-white uppercase tracking-widest mb-3">Vocabulary Upgrades</h4>
                    <div className="flex flex-wrap gap-2">
                      {a.englishCoaching.vocabulary_tips.map((tip: string, i: number) => (
                        <span key={i} className="px-3 py-1.5 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-300 text-sm">
                          {tip}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            )}

            {/* Transcript */}
            <section className="p-8 rounded-3xl bg-slate-900/50 border border-white/10 backdrop-blur-xl">
              <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                <FileText className="h-5 w-5 text-indigo-400" />
                Full Transcript
              </h3>
              <div className="max-h-96 overflow-y-auto pr-4 space-y-3">
                {transcriptMessages ? (
                  transcriptMessages.map((msg: any, i: number) => (
                    <div key={i} className={`flex flex-col gap-1 ${msg.role === 'you' ? 'items-end' : 'items-start'}`}>
                      <span className={`text-[10px] font-bold uppercase tracking-widest ${
                        msg.role === 'interviewer' ? 'text-indigo-400' : 'text-emerald-400'
                      }`}>
                        {msg.role === 'interviewer' ? 'Interviewer' : 'You'}
                      </span>
                      <p className={`px-3 py-2 rounded-2xl max-w-[80%] text-sm ${
                        msg.role === 'interviewer'
                          ? 'bg-slate-800/80 text-slate-300'
                          : 'bg-indigo-600/20 text-slate-300'
                      }`}>
                        {msg.text}
                      </p>
                    </div>
                  ))
                ) : (
                  <p className="text-sm leading-8 text-slate-400 italic">{data.transcript}</p>
                )}
              </div>
            </section>
          </div>

          {/* Right Sidebar */}
          <aside className="space-y-6">
            <div className="relative aspect-video rounded-3xl bg-slate-800 border border-white/10 overflow-hidden">
              {data.videoUrl ? (
                <video src={data.videoUrl} className="h-full w-full object-cover" controls />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center flex-col gap-4">
                  <Play className="h-12 w-12 text-slate-600" />
                  <span className="text-xs text-slate-500">Video replay not available</span>
                </div>
              )}
            </div>
            {data.audioUrl ? (
              <div className="rounded-2xl bg-white/5 border border-white/10 p-4">
                <p className="text-xs text-slate-400 mb-2 uppercase tracking-wider">Interview audio</p>
                <audio src={data.audioUrl} className="w-full" controls preload="metadata" />
              </div>
            ) : null}

            {/* Quick Stats */}
            <div className="p-6 rounded-3xl bg-white/5 border border-white/10">
              <h3 className="text-sm font-bold text-white mb-6 uppercase tracking-widest">Performance Summary</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Overall Score</span>
                  <span className={`font-bold ${(a.overallScore || 0) > 70 ? 'text-emerald-400' : (a.overallScore || 0) > 50 ? 'text-amber-400' : 'text-rose-400'}`}>
                    {a.overallScore || 0}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Confidence</span>
                  <span className={`font-bold ${(a.confidence || 0) > 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {a.confidence || 0}%
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Eye Contact</span>
                  <span className={`font-bold ${(a.eyeContact?.score || 0) > 70 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {a.eyeContact?.label || "N/A"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Head Stability</span>
                  <span className={`font-bold ${(a.headStability?.score || 0) > 60 ? 'text-emerald-400' : 'text-amber-400'}`}>
                    {a.headStability?.label || "N/A"}
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Filler Words</span>
                  <span className={`font-bold ${(a.fillerWords?.count || 0) < 5 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {a.fillerWords?.count || 0} detected
                  </span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-400">Speaking Pace</span>
                  <span className="font-bold text-blue-400">
                    {a.speakingPace?.wpm || 0} wpm
                  </span>
                </div>
              </div>
            </div>

            <Button className="w-full h-14 font-bold" onClick={() => router.push('/interview/new')}>
              Start Another Session
            </Button>
          </aside>
        </div>
      </div>
    </main>
  );
}
