'use client';

import { useState } from 'react';
import { Briefcase, FileText, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';

export default function ResumeMatcherPage() {
  const [fileName, setFileName] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [error, setError] = useState('');
  const [atsScore, setAtsScore] = useState<number | null>(null);
  const [jobs, setJobs] = useState<string[]>([]);

  const handleUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setIsAnalyzing(true);
    setError('');
    setAtsScore(null);
    setJobs([]);

    try {
      const formData = new FormData();
      formData.append('resume', file);
      const parseResponse = await fetch('/api/resume/parse', {
        method: 'POST',
        body: formData,
      });
      const parseData = await parseResponse.json();
      if (!parseResponse.ok || !parseData?.success || !parseData?.text) {
        throw new Error(parseData?.error || 'Failed to extract resume text.');
      }

      const analyzeResponse = await fetch('/api/resume/matcher/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resumeText: parseData.text }),
      });
      const analyzeData = await analyzeResponse.json();
      if (!analyzeResponse.ok || !analyzeData?.success) {
        throw new Error(analyzeData?.error || 'Failed to analyze resume.');
      }

      setAtsScore(typeof analyzeData.atsScore === 'number' ? analyzeData.atsScore : 0);
      setJobs(Array.isArray(analyzeData.jobs) ? analyzeData.jobs : []);
    } catch (error: any) {
      setError(error?.message || 'Unable to analyze resume.');
    } finally {
      setIsAnalyzing(false);
      event.target.value = '';
    }
  };

  return (
    <main className="min-h-screen bg-transparent px-4 py-8 text-slate-100">
      <div className="mx-auto max-w-7xl">
        <h1 className="text-3xl font-bold text-white">Resume Matcher</h1>
        <p className="mt-2 text-slate-400">Upload your resume PDF and get ATS score + likely job roles.</p>

        <div className="attention-card mt-6 rounded-3xl p-6">
          <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-800 px-4 py-2 text-sm text-slate-100 hover:bg-slate-700">
            <Upload className="h-4 w-4" />
            Upload Resume PDF
            <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={handleUpload} />
          </label>
          {fileName && (
            <p className="mt-3 flex items-center gap-2 text-sm text-slate-300">
              <FileText className="h-4 w-4 text-indigo-300" />
              {fileName}
            </p>
          )}
          {error && <p className="mt-3 text-sm text-red-400">{error}</p>}
        </div>

        <section className="attention-card mt-6 rounded-3xl p-6">
          {isAnalyzing ? (
            <div className="py-8 text-center">
              <Button isLoading className="pointer-events-none">
                Analyzing Resume...
              </Button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <div className="rounded-2xl bg-indigo-500/15 px-4 py-2">
                <p className="text-xs uppercase tracking-wider text-indigo-300">ATS Score</p>
                <p className="text-2xl font-bold text-white">{atsScore ?? '--'}%</p>
              </div>
            </div>
          )}

          {!isAnalyzing && (
            <div className="mt-5 rounded-2xl border border-white/10 bg-slate-900/80 p-4">
              <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-indigo-300">
                <Briefcase className="h-4 w-4" /> Jobs You May Get
              </p>
              <ul className="space-y-1 text-sm text-slate-200">
                {jobs.length ? jobs.map((role) => <li key={role}>- {role}</li>) : <li>- Upload resume to see job matches</li>}
              </ul>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
