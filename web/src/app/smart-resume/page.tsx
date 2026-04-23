'use client';

import React, { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

// ─── Types ──────────────────────────────────────────────────────────────────
interface ExperienceBullet {
  company: string;
  role: string;
  tailored_bullets: string[];
}

interface MatchAnalysis {
  score: number;
  rationale: string;
}

interface SmartResumeData {
  tailored_summary: string;
  top_skills: string[];
  experience: ExperienceBullet[];
  cover_letter: string;
  match_analysis: MatchAnalysis;
}

// ─── Loading Stages ─────────────────────────────────────────────────────────
const STAGES = [
  { id: 0, label: 'Extracting PDF Data…',     sub: 'Parsing your master resume' },
  { id: 1, label: 'Analyzing Job Description…', sub: 'Mapping direct skill overlaps' },
  { id: 2, label: 'Crafting Executive Summary…',  sub: 'Framing your professional brand' },
  { id: 3, label: 'Tailoring Experience…',  sub: 'Using STAR format optimizations' },
  { id: 4, label: 'Generating Cover Letter…',     sub: 'Drafting personalized outreach' },
];

function LoadingScreen({ stage }: { stage: number }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: '32px' }}>
      <div style={{ position: 'relative', width: 140, height: 140 }}>
        <svg viewBox="0 0 140 140" style={{ width: 140, height: 140, position: 'absolute' }}>
          {[60, 45, 30].map((r, i) => (
            <circle key={i} cx="70" cy="70" r={r} fill="none" stroke="rgba(52,211,153,0.15)" strokeWidth="1" />
          ))}
          <motion.line x1="70" y1="70" x2="70" y2="10"
            stroke="#34d399" strokeWidth="2" strokeLinecap="round"
            style={{ transformOrigin: '70px 70px' }}
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
          />
          <circle cx="70" cy="70" r="4" fill="#34d399" />
        </svg>
        <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 24 }}>✨</span>
        </div>
      </div>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {STAGES.map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }}
            style={{
              display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', borderRadius: 10, marginBottom: 8,
              background: i === stage ? 'rgba(52,211,153,0.12)' : i < stage ? 'rgba(99,102,241,0.06)' : 'rgba(255,255,255,0.02)',
              border: `1px solid ${i === stage ? 'rgba(52,211,153,0.35)' : i < stage ? 'rgba(99,102,241,0.2)' : 'rgba(255,255,255,0.05)'}`,
              transition: 'all 0.3s',
            }}>
            <span style={{ fontSize: 14, minWidth: 20, textAlign: 'center', color: i < stage ? '#818cf8' : i === stage ? '#34d399' : '#334155' }}>
              {i < stage ? '✓' : i === stage ? '⟳' : '○'}
            </span>
            <div>
              <div style={{ fontSize: 13, fontWeight: 600, color: i === stage ? '#6ee7b7' : i < stage ? '#818cf8' : '#475569' }}>{s.label}</div>
              {i === stage && <div style={{ fontSize: 11, color: '#34d399', marginTop: 2 }}>{s.sub}</div>}
            </div>
          </motion.div>
        ))}
      </div>
    </motion.div>
  );
}


export default function SmartResumePage() {
  const [file, setFile] = useState<File | null>(null);
  const [targetRole, setTargetRole] = useState('');
  const [targetCompany, setTargetCompany] = useState('');
  const [jobDescription, setJobDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState(0);
  const [result, setResult] = useState<SmartResumeData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [activeTab, setActiveTab] = useState<'resume' | 'cover_letter'>('resume');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped?.type === 'application/pdf') setFile(dropped);
    else setError('Only PDF files are supported.');
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !targetRole || !targetCompany || !jobDescription) return;
    setError(null); setResult(null); setLoading(true); setLoadingStage(0);
    const stageTimer = setInterval(() => setLoadingStage(prev => Math.min(prev + 1, STAGES.length - 1)), 3500);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('target_role', targetRole);
      form.append('target_company', targetCompany);
      form.append('job_description', jobDescription);

      const res = await fetch('http://localhost:8000/api/smart-resume/generate', { method: 'POST', body: form });
      const data = await res.json();
      
      if (!res.ok || !data.success) { 
        throw new Error(data.error || data.detail || `Server error ${res.status}`); 
      }
      setResult(data.data);
    } catch (err: any) {
      setError(err instanceof Error ? err.message : 'Generation failed. Check server status.');
    } finally {
      clearInterval(stageTimer); setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    alert('Copied to clipboard!');
  };

  const inputStyle: React.CSSProperties = {
    width: '100%', background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)',
    borderRadius: 12, padding: '12px 16px', color: '#e2e8f0', fontSize: 14, outline: 'none',
    boxSizing: 'border-box', fontFamily: 'inherit',
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'radial-gradient(ellipse at 80% 20%, rgba(52,211,153,0.08) 0%, transparent 50%), radial-gradient(ellipse at 20% 80%, rgba(14,165,233,0.06) 0%, transparent 50%), #09090b',
      color: '#e2e8f0', fontFamily: "'Inter', -apple-system, sans-serif",
    }}>
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 20px' }}>
        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 40 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 8 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: 'linear-gradient(135deg, #10b981, #0ea5e9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, boxShadow: '0 0 30px rgba(16,185,129,0.3)' }}>
              ✨
            </div>
            <div>
              <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900, background: 'linear-gradient(to right, #34d399, #38bdf8)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Smart Resume Tailor
              </h1>
              <div style={{ fontSize: 13, color: '#475569', marginTop: 2 }}>
                Transform your master resume into a job-winning application instantly.
              </div>
            </div>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: 'rgba(16,185,129,0.12)', color: '#34d399', border: '1px solid rgba(16,185,129,0.2)' }}>LLAMA 3.3</span>
              <span style={{ fontSize: 10, fontWeight: 700, padding: '4px 10px', borderRadius: 99, background: 'rgba(56,189,248,0.12)', color: '#38bdf8', border: '1px solid rgba(56,189,248,0.2)' }}>GROQ-POWERED</span>
            </div>
          </div>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 400px) 1fr', gap: 24, alignItems: 'start' }}>
          {/* ── Left: Form Input ── */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            style={{ background: 'rgba(15,15,20,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 18, padding: '28px', backdropFilter: 'blur(20px)', position: 'sticky', top: 24, maxHeight: 'calc(100vh - 48px)', overflowY: 'auto' }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#e2e8f0', marginBottom: 20 }}>Tailor Configuration</div>
            <form onSubmit={handleSubmit}>
              <div
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragging ? '#10b981' : file ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  borderRadius: 14, padding: '24px 16px', textAlign: 'center', cursor: 'pointer', marginBottom: 20,
                  background: isDragging ? 'rgba(16,185,129,0.08)' : file ? 'rgba(52,211,153,0.04)' : 'rgba(255,255,255,0.02)',
                  transition: 'all 0.2s',
                }}>
                <input ref={fileInputRef} type="file" accept=".pdf" style={{ display: 'none' }}
                  onChange={e => { const f = e.target.files?.[0]; if (f) { setFile(f); setError(null); } }} />
                <div style={{ fontSize: 24, marginBottom: 10 }}>{file ? '✅' : '📄'}</div>
                {file ? (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#34d399' }}>{file.name}</div>
                    <div style={{ fontSize: 11, color: '#475569', marginTop: 4 }}>Master Resume Loaded</div>
                  </>
                ) : (
                  <>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#94a3b8' }}>Upload Master Resume PDF</div>
                  </>
                )}
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: '#475569', fontWeight: 600, letterSpacing: 1, display: 'block', marginBottom: 8 }}>TARGET ROLE</label>
                <input value={targetRole} onChange={e => setTargetRole(e.target.value)} placeholder="e.g. Senior Backend Engineer" required style={inputStyle} />
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ fontSize: 11, color: '#475569', fontWeight: 600, letterSpacing: 1, display: 'block', marginBottom: 8 }}>TARGET COMPANY</label>
                <input value={targetCompany} onChange={e => setTargetCompany(e.target.value)} placeholder="e.g. Acme Corp" required style={inputStyle} />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ fontSize: 11, color: '#475569', fontWeight: 600, letterSpacing: 1, display: 'block', marginBottom: 8 }}>JOB DESCRIPTION</label>
                <textarea rows={8} value={jobDescription} onChange={e => setJobDescription(e.target.value)} placeholder="Paste the job requirements here..." required style={{ ...inputStyle, resize: 'vertical' }} />
              </div>

              {error && (
                <div style={{ marginBottom: 16, padding: '10px 14px', borderRadius: 10, background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.25)', fontSize: 12, color: '#f87171', lineHeight: 1.5 }}>
                  ⚠ {error}
                </div>
              )}

              <button type="submit" disabled={loading || !file || !targetRole || !targetCompany || !jobDescription}
                style={{
                  width: '100%', padding: '14px', borderRadius: 12, border: 'none',
                  background: (loading || !file || !targetRole || !jobDescription) ? 'rgba(52,211,153,0.3)' : 'linear-gradient(135deg, #10b981, #0ea5e9)',
                  color: 'white', fontSize: 14, fontWeight: 700,
                  cursor: (loading || !file || !targetRole || !jobDescription) ? 'not-allowed' : 'pointer',
                  boxShadow: loading ? 'none' : '0 0 30px rgba(16,185,129,0.3)',
                  transition: 'all 0.2s',
                }}>
                {loading ? '⟳ Crafting Your Resume…' : '✨ Generate Tailored Resume'}
              </button>
            </form>
          </motion.div>

          {/* ── Right: Results ── */}
          <div>
            <AnimatePresence mode="wait">
              {loading && (
                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <LoadingScreen stage={loadingStage} />
                </motion.div>
              )}
              {!loading && !result && (
                <motion.div key="idle" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', gap: 16, textAlign: 'center' }}>
                  <div style={{ fontSize: 64 }}>📝</div>
                  <div style={{ fontSize: 18, fontWeight: 700, color: '#475569' }}>Awaiting Job Description</div>
                  <div style={{ fontSize: 13, color: '#334155', maxWidth: 300 }}>Upload a master resume and a target job to craft a winning application perfectly tuned for the ATS and hiring managers.</div>
                </motion.div>
              )}
              {!loading && result && (
                <motion.div key="results" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                  
                  <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
                    <button onClick={() => setActiveTab('resume')} style={{ 
                      padding: '10px 24px', borderRadius: 99, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
                      background: activeTab === 'resume' ? 'rgba(52,211,153,0.15)' : 'rgba(255,255,255,0.05)',
                      color: activeTab === 'resume' ? '#34d399' : '#94a3b8',
                      transition: 'all 0.2s'
                    }}>
                      📝 Tailored Resume
                    </button>
                    <button onClick={() => setActiveTab('cover_letter')} style={{ 
                      padding: '10px 24px', borderRadius: 99, fontSize: 13, fontWeight: 700, border: 'none', cursor: 'pointer',
                      background: activeTab === 'cover_letter' ? 'rgba(14,165,233,0.15)' : 'rgba(255,255,255,0.05)',
                      color: activeTab === 'cover_letter' ? '#38bdf8' : '#94a3b8',
                      transition: 'all 0.2s'
                    }}>
                      💌 Cover Letter
                    </button>
                  </div>

                  {activeTab === 'resume' ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      
                      {/* Match Analysis */}
                      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.1 }}
                        style={{ padding: '24px', borderRadius: 16, background: 'rgba(15,15,20,0.9)', border: '1px solid rgba(52,211,153,0.2)', backdropFilter: 'blur(10px)', display: 'flex', alignItems: 'center', gap: 20 }}>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontSize: 12, fontWeight: 700, color: '#34d399', letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: 6 }}>Resume Match Score</div>
                          <div style={{ fontSize: 14, color: '#cbd5e1', lineHeight: 1.5 }}>{result.match_analysis.rationale}</div>
                        </div>
                        <div style={{ fontSize: 36, fontWeight: 900, color: '#34d399', background: 'rgba(52,211,153,0.1)', padding: '16px', borderRadius: 16 }}>
                          {result.match_analysis.score}%
                        </div>
                      </motion.div>

                      {/* Summary */}
                      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
                        style={{ padding: '28px', borderRadius: 16, background: 'rgba(15,15,20,0.9)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                          <h3 style={{ margin: 0, fontSize: 16, color: '#e2e8f0' }}>Professional Summary</h3>
                          <button onClick={() => copyToClipboard(result.tailored_summary)} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Copy</button>
                        </div>
                        <p style={{ fontSize: 14, lineHeight: 1.6, color: '#cbd5e1', margin: 0 }}>{result.tailored_summary}</p>
                      </motion.div>

                      {/* Skills */}
                      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.3 }}
                        style={{ padding: '28px', borderRadius: 16, background: 'rgba(15,15,20,0.9)', border: '1px solid rgba(255,255,255,0.07)' }}>
                         <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                          <h3 style={{ margin: 0, fontSize: 16, color: '#e2e8f0' }}>Targeted Skills</h3>
                          <button onClick={() => copyToClipboard(result.top_skills.join(', '))} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Copy</button>
                        </div>
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                          {result.top_skills.map((skill, i) => (
                            <span key={i} style={{ padding: '6px 14px', borderRadius: 99, background: 'rgba(52,211,153,0.1)', border: '1px solid rgba(52,211,153,0.2)', color: '#34d399', fontSize: 13, fontWeight: 600 }}>
                              {skill}
                            </span>
                          ))}
                        </div>
                      </motion.div>

                      {/* Experience */}
                      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.4 }}
                        style={{ padding: '28px', borderRadius: 16, background: 'rgba(15,15,20,0.9)', border: '1px solid rgba(255,255,255,0.07)' }}>
                        <h3 style={{ margin: '0 0 24px 0', fontSize: 16, color: '#e2e8f0' }}>Tailored Experience</h3>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                          {result.experience.map((exp, i) => (
                            <div key={i} style={{ paddingBottom: 24, borderBottom: i !== result.experience.length -1 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                               <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                                  <div>
                                    <div style={{ fontSize: 15, fontWeight: 700, color: '#e2e8f0' }}>{exp.role}</div>
                                    <div style={{ fontSize: 13, color: '#94a3b8' }}>{exp.company}</div>
                                  </div>
                                  <button onClick={() => copyToClipboard(exp.tailored_bullets.map(b => '• ' + b).join('\n'))} style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', color: '#94a3b8', padding: '4px 10px', borderRadius: 6, fontSize: 12, cursor: 'pointer' }}>Copy Bullets</button>
                               </div>
                               <ul style={{ margin: 0, paddingLeft: 20, color: '#cbd5e1', fontSize: 14 }}>
                                 {exp.tailored_bullets.map((bullet, j) => (
                                   <li key={j} style={{ marginBottom: 10, lineHeight: 1.6 }}>{bullet}</li>
                                 ))}
                               </ul>
                            </div>
                          ))}
                        </div>
                      </motion.div>

                    </div>
                  ) : (
                    /* Cover Letter View */
                    <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
                      style={{ padding: '32px', borderRadius: 16, background: 'rgba(15,15,20,0.9)', border: '1px solid rgba(14,165,233,0.2)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
                        <h3 style={{ margin: 0, fontSize: 18, color: '#e2e8f0', display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ color: '#38bdf8' }}>💌</span> Personalized Cover Letter
                        </h3>
                        <button onClick={() => copyToClipboard(result.cover_letter)} style={{ background: 'rgba(14,165,233,0.15)', border: '1px solid rgba(14,165,233,0.3)', color: '#38bdf8', padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', transition: 'all 0.2s' }}>
                          Copy Letter
                        </button>
                      </div>
                      <div style={{ 
                        fontSize: 15, lineHeight: 1.8, color: '#cbd5e1', whiteSpace: 'pre-wrap', 
                        background: 'rgba(255,255,255,0.02)', padding: '24px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.05)'
                      }}>
                        {result.cover_letter}
                      </div>
                    </motion.div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}
