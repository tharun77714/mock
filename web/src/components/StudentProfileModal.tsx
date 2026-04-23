'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, User as UserIcon, Mail, BookOpen, Loader2, CheckCircle2, Code, Briefcase, Upload, FileText, Trash2, ExternalLink } from 'lucide-react';
import { Button } from './ui/Button';

interface StudentProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionEmail?: string | null;
  sessionName?: string | null;
}

export function StudentProfileModal({ isOpen, onClose, sessionEmail, sessionName }: StudentProfileModalProps) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [successStatus, setSuccessStatus] = useState(false);
  
  const [profile, setProfile] = useState({
    firstName: '',
    lastName: '',
    githubLink: '',
    linkedinLink: '',
    resumeUrl: ''
  });
  const [resumeFile, setResumeFile] = useState<File | null>(null);

  useEffect(() => {
    if (isOpen) {
      if (sessionName && !profile.firstName) {
        const parts = sessionName.split(' ');
        setProfile(p => ({
          ...p,
          firstName: parts[0] || '',
          lastName: parts.slice(1).join(' ') || ''
        }));
      }
      fetchProfile();
    }
  }, [isOpen, sessionName]);

  const fetchProfile = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/user/profile', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setProfile({
          firstName: data.firstName || '',
          lastName: data.lastName || '',
          githubLink: data.githubLink || '',
          linkedinLink: data.linkedinLink || '',
          resumeUrl: data.resumeUrl || ''
        });
      }
    } catch (err) {
      console.error('Failed to fetch profile', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      let finalResumeUrl = profile.resumeUrl;
      
      if (resumeFile) {
        const formData = new FormData();
        formData.append('file', resumeFile);
        const uploadRes = await fetch('/api/user/resume', {
          method: 'POST',
          body: formData
        });
        if (uploadRes.ok) {
           const d = await uploadRes.json();
           finalResumeUrl = d.resumeUrl;
        } else {
           console.error("Resume upload failed");
        }
      }

      const res = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...profile, resumeUrl: finalResumeUrl })
      });
      if (res.ok) {
        setSuccessStatus(true);
        setTimeout(() => {
          setSuccessStatus(false);
          setResumeFile(null);
          onClose();
        }, 1500);
      }
    } catch (err) {
      console.error('Failed to update profile', err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-slate-950/70 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", damping: 25, stiffness: 300 }}
            className="fixed left-1/2 top-1/2 z-[70] w-full max-w-md -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/95 p-6 shadow-2xl backdrop-blur-xl"
          >
            <button
              onClick={onClose}
              className="absolute right-4 top-4 rounded-full p-2 text-slate-400 opacity-70 transition-opacity hover:bg-white/10 hover:opacity-100"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="mb-6">

              <h2 className="text-2xl font-bold text-white tracking-tight">Student AI Profile</h2>
              <p className="mt-1 text-sm text-slate-400">
                Tell us about your background so our Deep Learning models can personalize your coaching.
              </p>
            </div>

            {loading ? (
              <div className="flex h-40 items-center justify-center">
                <Loader2 className="h-8 w-8 animate-spin text-indigo-500" />
              </div>
            ) : (
              <form onSubmit={handleSave} className="space-y-4">
                <div className="space-y-4 rounded-2xl bg-white/[0.02] p-4 border border-white/[0.05]">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                        <UserIcon className="h-3 w-3" /> First Name
                      </label>
                      <input
                        type="text"
                        value={profile.firstName}
                        onChange={e => setProfile({ ...profile, firstName: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                        placeholder="John"
                        required
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-transparent select-none">Last</label>
                      <input
                        type="text"
                        value={profile.lastName}
                        onChange={e => setProfile({ ...profile, lastName: e.target.value })}
                        className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                        placeholder="Doe"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                      <Mail className="h-3 w-3" /> Email
                    </label>
                    <input
                      type="email"
                      value={sessionEmail || ''}
                      disabled
                      className="w-full rounded-xl border border-white/5 bg-white/5 px-3 py-2 text-sm text-slate-400 opacity-70 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="space-y-4 rounded-2xl bg-white/[0.02] p-4 border border-white/[0.05]">
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                      <Upload className="h-3 w-3" /> Resume (PDF)
                    </label>
                    {profile.resumeUrl && !resumeFile ? (
                      <div className="flex w-full items-center justify-between rounded-xl border border-white/10 bg-indigo-500/10 px-4 py-3">
                        <div 
                           className="flex items-center gap-2 cursor-pointer hover:text-indigo-400 transition-colors"
                           onClick={() => window.open(profile.resumeUrl, "_blank")}
                        >
                           <FileText className="h-5 w-5 text-indigo-400" />
                           <span className="text-sm font-medium text-white truncate max-w-[200px]">View Uploaded Resume</span>
                           <ExternalLink className="h-3 w-3 text-slate-400" />
                        </div>
                        <button 
                          type="button"
                          onClick={() => setProfile({...profile, resumeUrl: ''})}
                          className="rounded-lg p-1.5 hover:bg-white/10 text-slate-400 hover:text-rose-400 transition-colors"
                        >
                           <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <label className="flex w-full cursor-pointer flex-col items-center justify-center rounded-xl border border-dashed border-white/20 bg-black/20 py-4 hover:border-indigo-500/50 hover:bg-indigo-500/5 transition-colors">
                        <div className="flex flex-col items-center justify-center relative w-full px-4">
                          {resumeFile ? (
                              <>
                                <FileText className="mb-2 h-5 w-5 text-indigo-400" />
                                <p className="text-sm font-medium text-white truncate max-w-full">{resumeFile.name}</p>
                                <button type="button" onClick={(e) => { e.preventDefault(); setResumeFile(null); }} className="absolute right-0 top-1/2 -translate-y-1/2 p-2 hover:text-rose-400 text-slate-400">
                                   <X className="h-4 w-4" />
                                </button>
                              </>
                          ) : (
                              <>
                                <Upload className="mb-2 h-5 w-5 text-indigo-400" />
                                <p className="text-xs text-slate-400">Click to select or drag and drop</p>
                              </>
                          )}
                        </div>
                        <input
                          type="file"
                          className="hidden"
                          accept=".pdf,.doc,.docx"
                          onChange={(e) => {
                            if (e.target.files && e.target.files.length > 0) {
                              setResumeFile(e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                      <Code className="h-3 w-3" /> GitHub Link
                    </label>
                    <input
                      type="url"
                      value={profile.githubLink}
                      onChange={e => setProfile({ ...profile, githubLink: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                      placeholder="https://github.com/username"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
                      <Briefcase className="h-3 w-3" /> LinkedIn Link
                    </label>
                    <input
                      type="url"
                      value={profile.linkedinLink}
                      onChange={e => setProfile({ ...profile, linkedinLink: e.target.value })}
                      className="w-full rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 transition-colors"
                      placeholder="https://linkedin.com/in/username"
                    />
                  </div>
                </div>

                <div className="mt-6">
                  <Button
                    type="submit"
                    disabled={submitting || successStatus}
                    className="w-full shadow-lg shadow-indigo-500/20 py-5"
                  >
                    {successStatus ? (
                      <span className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 text-emerald-400" /> Saved!</span>
                    ) : submitting ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      "Update Profile Attributes"
                    )}
                  </Button>
                </div>
              </form>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
