'use client';

import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Upload, FileText, CheckCircle2, Zap, Brain, Shield,
  Award, Briefcase, TrendingUp, Sparkles, Plus, AlertCircle, X
} from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function ResumeAnalyzerPage() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selectedFile = e.target.files[0];
      setFile(selectedFile);
      if (selectedFile.type.startsWith('image/')) {
        setPreview(URL.createObjectURL(selectedFile));
      } else {
        setPreview(null);
      }
      setResult(null);
      setError(null);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selectedFile = e.dataTransfer.files[0];
      setFile(selectedFile);
      if (selectedFile.type.startsWith('image/')) {
        setPreview(URL.createObjectURL(selectedFile));
      } else {
        setPreview(null);
      }
      setResult(null);
      setError(null);
    }
  };

  const clearFile = () => {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const analyzeResume = async () => {
    if (!file) return;
    setIsAnalyzing(true);
    setError(null);

    const formData = new FormData();
    formData.append('file', file);

    try {
      // Assuming FastAPI runs on 8000
      const response = await fetch('http://localhost:8000/api/analyze-resume', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        throw new Error('Analysis failed. Make sure the API is running on port 8000.');
      }

      const data = await response.json();
      if (data.error) throw new Error(data.error);

      setResult(data);
    } catch (err: any) {
      setError(err.message || 'Something went wrong during analysis.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  const staggerContainer = {
    hidden: { opacity: 0 },
    show: {
      opacity: 1,
      transition: { staggerChildren: 0.1 }
    }
  };

  const itemVariant = {
    hidden: { y: 20, opacity: 0 },
    show: { y: 0, opacity: 1 }
  };

  return (
    <div className="min-h-screen bg-slate-950 p-4 md:p-8 relative overflow-hidden text-slate-200">
      {/* Background Glows */}
      <div className="absolute top-1/4 -left-1/4 w-1/2 h-1/2 bg-indigo-600/10 blur-[120px] rounded-full pointer-events-none" />
      <div className="absolute bottom-1/4 -right-1/4 w-1/2 h-1/2 bg-fuchsia-600/10 blur-[120px] rounded-full pointer-events-none" />

      <div className="max-w-6xl mx-auto relative z-10 pt-16">
        <div className="text-center mb-12">
          <div className="w-16 h-16 bg-gradient-to-tr from-indigo-500 to-fuchsia-500 rounded-2xl mx-auto mb-6 flex items-center justify-center shadow-xl shadow-indigo-500/20 ring-1 ring-white/20">
            <Brain className="text-white w-8 h-8" />
          </div>
          <h1 className="text-4xl md:text-5xl font-extrabold text-white mb-4 tracking-tight drop-shadow-sm">
            AI Resume Analyzer
          </h1>
          <p className="text-slate-400 text-lg max-w-xl mx-auto leading-relaxed">
            Upload your resume and let our Deep Learning pipeline extract your technical skills, evaluate your career rank, and recommend your next big role.
          </p>
        </div>

        {!result && (
          <motion.div 
            initial={{ y: 20, opacity: 0 }} 
            animate={{ y: 0, opacity: 1 }}
            className="max-w-2xl mx-auto"
          >
            <div 
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              className={`relative border-2 border-dashed rounded-3xl p-10 text-center transition-all ${
                file ? 'border-indigo-500/50 bg-indigo-500/5' : 'border-slate-700 bg-slate-900/50 hover:bg-slate-800/80 hover:border-slate-500'
              }`}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*,application/pdf"
                className="hidden" 
              />
              
              {!file ? (
                <div className="flex flex-col items-center cursor-pointer" onClick={() => fileInputRef.current?.click()}>
                  <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6">
                    <Upload className="w-8 h-8 text-indigo-400" />
                  </div>
                  <h3 className="text-xl font-bold text-white mb-2">Drag & drop your resume</h3>
                  <p className="text-slate-400 text-sm">Supports images (JPG, PNG) and PDFs</p>
                </div>
              ) : (
                <div className="flex flex-col items-center">
                  {preview ? (
                    <img src={preview} alt="Resume Preview" className="w-32 h-40 object-cover rounded-xl shadow-lg mb-6 ring-2 ring-indigo-500/30" />
                  ) : (
                    <div className="w-20 h-20 bg-indigo-500/20 rounded-2xl flex items-center justify-center mb-6 ring-2 ring-indigo-500/30">
                      <FileText className="w-8 h-8 text-indigo-400" />
                    </div>
                  )}
                  <h3 className="text-xl font-bold text-white mb-2 truncate max-w-xs">{file.name}</h3>
                  <p className="text-slate-400 text-sm mb-6">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  
                  <div className="flex gap-4">
                    <Button variant="outline" onClick={clearFile} disabled={isAnalyzing}>
                      Cancel
                    </Button>
                    <Button 
                      onClick={analyzeResume} 
                      isLoading={isAnalyzing}
                      className="bg-gradient-to-r from-indigo-500 to-fuchsia-500 hover:from-indigo-400 hover:to-fuchsia-400 text-white shadow-lg shadow-indigo-500/25 border-0"
                    >
                      Analyze Resume
                    </Button>
                  </div>
                </div>
              )}
            </div>

            {error && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-6 p-4 rounded-2xl bg-rose-500/10 border border-rose-500/20 flex gap-3 text-rose-300">
                <AlertCircle className="w-5 h-5 shrink-0" />
                <p className="text-sm">{error}</p>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* RESULTS SECTION */}
        <AnimatePresence>
          {result && (
            <motion.div 
              variants={staggerContainer}
              initial="hidden"
              animate="show"
              className="grid grid-cols-1 lg:grid-cols-3 gap-6"
            >
              {/* Left Column: Overall Stats */}
              <div className="lg:col-span-1 space-y-6">
                <motion.div variants={itemVariant} className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl relative overflow-hidden">
                  <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 to-fuchsia-500" />
                  
                  <div className="text-center mb-6">
                    <div className="inline-flex items-center justify-center space-x-2 bg-slate-800/80 px-4 py-2 rounded-full mb-4 ring-1 ring-white/10">
                      <span className="text-xl">{result.rank?.icon || "🟢"}</span>
                      <span className="font-bold text-white uppercase tracking-wider text-sm">{result.rank?.name || "Ranked"}</span>
                    </div>
                    <div className="text-6xl font-black text-transparent bg-clip-text bg-gradient-to-br from-white to-slate-500 drop-shadow-sm">
                      {result.careerScore || 0}
                    </div>
                    <p className="text-slate-400 text-sm mt-2 font-medium">Global Career Score</p>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="bg-slate-800/50 rounded-2xl p-4 text-center border border-white/5">
                      <Briefcase className="w-5 h-5 text-indigo-400 mx-auto mb-2" />
                      <div className="text-xl font-bold text-white">{result.experience || 0}</div>
                      <div className="text-xs text-slate-400">Years Exp</div>
                    </div>
                    <div className="bg-slate-800/50 rounded-2xl p-4 text-center border border-white/5">
                      <TrendingUp className="w-5 h-5 text-fuchsia-400 mx-auto mb-2" />
                      <div className="text-xl font-bold text-white">{result.score || 0}%</div>
                      <div className="text-xs text-slate-400">Match Rate</div>
                    </div>
                  </div>
                </motion.div>

                {/* Badges */}
                <motion.div variants={itemVariant} className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Award className="w-5 h-5 text-amber-400" />
                    Achievements Unlock
                  </h3>
                  <div className="space-y-3">
                    {result.badges?.map((badge: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-3 bg-slate-800/40 rounded-xl border border-white/5">
                        <div className="text-2xl">{badge.icon}</div>
                        <span className="font-medium text-slate-200">{badge.label}</span>
                      </div>
                    ))}
                    {(!result.badges || result.badges.length === 0) && (
                      <p className="text-slate-500 text-sm text-center py-4">No badges unlocked yet.</p>
                    )}
                  </div>
                </motion.div>
                
                <motion.div variants={itemVariant}>
                  <Button onClick={clearFile} variant="outline" className="w-full justify-center h-12 rounded-2xl border-white/10 hover:bg-slate-800">
                    Analyze Another Resume
                  </Button>
                </motion.div>
              </div>

              {/* Right Column: Skills & Jobs */}
              <div className="lg:col-span-2 space-y-6">
                
                {/* Skills Section */}
                <motion.div variants={itemVariant} className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Zap className="w-5 h-5 text-indigo-400" />
                    Extracted Technical Skills
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {result.skills?.map((skill: string, i: number) => (
                      <span key={i} className="px-4 py-2 bg-indigo-500/10 text-indigo-300 font-medium rounded-full text-sm border border-indigo-500/20">
                        {skill}
                      </span>
                    ))}
                    {(!result.skills || result.skills.length === 0) && (
                      <p className="text-slate-500 text-sm px-2">No specific technical skills detected.</p>
                    )}
                  </div>
                </motion.div>

                {/* Job Matches */}
                <motion.div variants={itemVariant} className="bg-slate-900/60 backdrop-blur-xl border border-white/5 rounded-3xl p-6 shadow-2xl">
                  <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                    <Sparkles className="w-5 h-5 text-fuchsia-400" />
                    Top Recommended Roles
                  </h3>
                  <div className="space-y-4">
                    {result.jobs?.map((job: any, i: number) => (
                      <div key={i} className="group p-5 bg-slate-800/40 rounded-2xl border border-white/5 hover:bg-slate-800/60 hover:border-slate-600 transition-all cursor-default">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <h4 className="font-bold text-white text-lg group-hover:text-indigo-300 transition-colors">{job.title}</h4>
                            <span className="text-slate-400 text-sm flex items-center gap-2">
                              {job.company}
                            </span>
                          </div>
                          <div className="bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 px-3 py-1 rounded-lg text-sm font-bold flex items-center gap-1">
                            {job.score}% Match
                          </div>
                        </div>
                        <p className="text-slate-500 text-sm line-clamp-2 leading-relaxed">
                          {job.description || "Review this role to see if it aligns with your career trajectory."}
                        </p>
                      </div>
                    ))}
                    {(!result.jobs || result.jobs.length === 0) && (
                      <div className="text-center py-8">
                        <p className="text-slate-500">Could not find adequate matches for this profile.</p>
                      </div>
                    )}
                  </div>
                </motion.div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

      </div>
    </div>
  );
}
