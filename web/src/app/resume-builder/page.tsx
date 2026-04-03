'use client';

import { useMemo, useState } from 'react';
import { FileDown, FileText, GripVertical, Sparkles, Plus, Trash2, RotateCcw, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import {
  defaultResume,
  EducationItem,
  ExperienceItem,
  ProjectItem,
  ResumeDocument,
  ResumeSectionId,
  sectionOrder,
} from '@/lib/resume-builder-schema';

const sectionLabels: Record<ResumeSectionId, string> = {
  basics: 'Basics',
  summary: 'Summary',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
};

const themes = {
  indigo: {
    name: 'Indigo',
    accent: 'text-indigo-600',
    badge: 'rounded bg-indigo-100 px-2 py-1 text-xs text-indigo-700',
    previewBorder: 'border-indigo-200',
  },
  emerald: {
    name: 'Emerald',
    accent: 'text-emerald-600',
    badge: 'rounded bg-emerald-100 px-2 py-1 text-xs text-emerald-700',
    previewBorder: 'border-emerald-200',
  },
  rose: {
    name: 'Rose',
    accent: 'text-rose-600',
    badge: 'rounded bg-rose-100 px-2 py-1 text-xs text-rose-700',
    previewBorder: 'border-rose-200',
  },
} as const;

type ThemeKey = keyof typeof themes;

export default function ResumeBuilderPage() {
  const [resume, setResume] = useState<ResumeDocument>(defaultResume);
  const [activeSection, setActiveSection] = useState<ResumeSectionId>('basics');
  const [orderedSections, setOrderedSections] = useState<ResumeSectionId[]>(sectionOrder);
  const [theme, setTheme] = useState<ThemeKey>('indigo');
  const [layoutMode, setLayoutMode] = useState<'single' | 'split'>('single');
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [enhanceError, setEnhanceError] = useState('');
  const selectedTheme = themes[theme];

  const previewSections = useMemo(
    () => orderedSections.filter((section) => section !== 'basics' || Boolean(resume.basics.fullName)),
    [orderedSections, resume.basics.fullName]
  );

  const moveSection = (section: ResumeSectionId, direction: 'up' | 'down') => {
    setOrderedSections((prev) => {
      const index = prev.indexOf(section);
      if (index === -1) return prev;
      const target = direction === 'up' ? index - 1 : index + 1;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const parseLines = (text: string) =>
    text
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);

  const makeId = (prefix: string) => `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

  const saveResume = () => {
    const payload = {
      resume,
      orderedSections,
      theme,
      updatedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'resume-builder-data.json';
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  const importResume = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (data?.resume) setResume(data.resume as ResumeDocument);
        if (Array.isArray(data?.orderedSections)) setOrderedSections(data.orderedSections as ResumeSectionId[]);
        if (data?.theme && themes[data.theme as ThemeKey]) setTheme(data.theme as ThemeKey);
      } catch {
        setEnhanceError('Invalid JSON file for import.');
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const enhanceWithGroq = async () => {
    setIsEnhancing(true);
    setEnhanceError('');
    try {
      const response = await fetch('/api/resume/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success || !data?.resume) {
        throw new Error(data?.error || 'Enhancement failed');
      }
      setResume(data.resume as ResumeDocument);
    } catch (error: any) {
      setEnhanceError(error?.message || 'Could not enhance resume.');
    } finally {
      setIsEnhancing(false);
    }
  };

  return (
    <main className="min-h-screen bg-transparent text-slate-100">
      <div className="mx-auto grid w-full max-w-7xl grid-cols-1 gap-6 px-4 py-8 lg:grid-cols-12">
        <aside className="attention-card rounded-3xl p-5 lg:col-span-3">
          <div className="mb-5 flex items-center gap-2">
            <div className="rounded-xl bg-indigo-500/20 p-2 text-indigo-300">
              <FileText className="h-4 w-4" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">Resume Builder</p>
              <p className="text-xs text-slate-400">Reactive architecture style</p>
            </div>
          </div>

          <div className="space-y-2">
            {orderedSections.map((section) => (
              <div
                key={section}
                className={`flex items-center justify-between rounded-xl border px-3 py-2 ${
                  activeSection === section
                    ? 'border-indigo-500/40 bg-indigo-500/15'
                    : 'border-white/10 bg-slate-900/80'
                }`}
              >
                <button
                  type="button"
                  className="flex items-center gap-2 text-sm text-left text-slate-200"
                  onClick={() => setActiveSection(section)}
                >
                  <GripVertical className="h-4 w-4 text-slate-500" />
                  {sectionLabels[section]}
                </button>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                    onClick={() => moveSection(section, 'up')}
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    className="rounded p-1 text-slate-400 hover:bg-white/10 hover:text-white"
                    onClick={() => moveSection(section, 'down')}
                  >
                    ↓
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-5 border-t border-white/10 pt-4">
            <p className="mb-2 text-xs uppercase tracking-wider text-slate-400">Color Theme</p>
            <div className="flex flex-wrap gap-2">
              {(Object.keys(themes) as ThemeKey[]).map((key) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setTheme(key)}
                  className={`rounded-lg border px-2 py-1 text-xs ${
                    theme === key ? 'border-white/40 bg-white/10 text-white' : 'border-white/10 text-slate-300'
                  }`}
                >
                  {themes[key].name}
                </button>
              ))}
            </div>
          </div>
          <div className="mt-4 border-t border-white/10 pt-4">
            <p className="mb-2 text-xs uppercase tracking-wider text-slate-400">Layout</p>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setLayoutMode('single')}
                className={`rounded-lg border px-2 py-1 text-xs ${
                  layoutMode === 'single' ? 'border-white/40 bg-white/10 text-white' : 'border-white/10 text-slate-300'
                }`}
              >
                Single Column
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('split')}
                className={`rounded-lg border px-2 py-1 text-xs ${
                  layoutMode === 'split' ? 'border-white/40 bg-white/10 text-white' : 'border-white/10 text-slate-300'
                }`}
              >
                Split Layout
              </button>
            </div>
          </div>
        </aside>

        <section className="attention-card rounded-3xl p-5 lg:col-span-4">
          <div className="mb-4 flex items-center justify-between gap-2">
            <div>
              <h1 className="mb-1 text-xl font-bold text-white">Editor</h1>
              <p className="text-sm text-slate-400">Update content and reorder sections.</p>
            </div>
            <div className="flex items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-100 hover:bg-slate-700">
                <Upload className="h-4 w-4" />
                Import
                <input type="file" accept=".json" className="hidden" onChange={importResume} />
              </label>
              <Button
                variant="outline"
                className="gap-2"
                onClick={() => {
                  setResume(defaultResume);
                  setOrderedSections(sectionOrder);
                  setEnhanceError('');
                }}
              >
                <RotateCcw className="h-4 w-4" />
                Reset
              </Button>
              <Button variant="secondary" className="gap-2" onClick={saveResume}>
                <FileDown className="h-4 w-4" />
                Save
              </Button>
              <Button className="gap-2" onClick={enhanceWithGroq} isLoading={isEnhancing}>
                <Sparkles className="h-4 w-4" />
                Enhance
              </Button>
            </div>
          </div>
          {enhanceError && <p className="mb-4 text-xs text-red-400">{enhanceError}</p>}

          {activeSection === 'basics' && (
            <div className="space-y-3">
              {(['fullName', 'headline', 'email', 'phone', 'location', 'website'] as const).map((field) => (
                <input
                  key={field}
                  value={resume.basics[field]}
                  onChange={(e) =>
                    setResume((prev) => ({
                      ...prev,
                      basics: { ...prev.basics, [field]: e.target.value },
                    }))
                  }
                  placeholder={field}
                  className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50"
                />
              ))}
            </div>
          )}

          {activeSection === 'summary' && (
            <textarea
              value={resume.summary}
              onChange={(e) => setResume((prev) => ({ ...prev, summary: e.target.value }))}
              rows={7}
              className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50"
            />
          )}

          {activeSection === 'skills' && (
            <div className="space-y-3">
              {resume.skills.map((skill, index) => (
                <div key={`${skill}-${index}`} className="flex gap-2">
                  <input
                    value={skill}
                    onChange={(e) =>
                      setResume((prev) => {
                        const nextSkills = [...prev.skills];
                        nextSkills[index] = e.target.value;
                        return { ...prev, skills: nextSkills };
                      })
                    }
                    className="w-full rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-sm text-white outline-none focus:border-indigo-500/50"
                  />
                  <Button
                    variant="ghost"
                    onClick={() =>
                      setResume((prev) => ({
                        ...prev,
                        skills: prev.skills.filter((_, i) => i !== index),
                      }))
                    }
                    className="!px-2"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="secondary"
                onClick={() => setResume((prev) => ({ ...prev, skills: [...prev.skills, 'New Skill'] }))}
                className="gap-2"
              >
                <Plus className="h-4 w-4" />
                Add Skill
              </Button>
            </div>
          )}

          {activeSection === 'experience' && (
            <div className="space-y-4">
              {resume.experience.map((item, index) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={item.role}
                      placeholder="Role"
                      onChange={(e) =>
                        setResume((prev) => {
                          const next = [...prev.experience];
                          next[index] = { ...next[index], role: e.target.value };
                          return { ...prev, experience: next };
                        })
                      }
                      className="rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-sm text-white"
                    />
                    <input
                      value={item.company}
                      placeholder="Company"
                      onChange={(e) =>
                        setResume((prev) => {
                          const next = [...prev.experience];
                          next[index] = { ...next[index], company: e.target.value };
                          return { ...prev, experience: next };
                        })
                      }
                      className="rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-sm text-white"
                    />
                    <input
                      value={item.startDate}
                      placeholder="Start"
                      onChange={(e) =>
                        setResume((prev) => {
                          const next = [...prev.experience];
                          next[index] = { ...next[index], startDate: e.target.value };
                          return { ...prev, experience: next };
                        })
                      }
                      className="rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-sm text-white"
                    />
                    <input
                      value={item.endDate}
                      placeholder="End"
                      onChange={(e) =>
                        setResume((prev) => {
                          const next = [...prev.experience];
                          next[index] = { ...next[index], endDate: e.target.value };
                          return { ...prev, experience: next };
                        })
                      }
                      className="rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <textarea
                    value={item.highlights.join('\n')}
                    rows={4}
                    placeholder="One bullet per line"
                    onChange={(e) =>
                      setResume((prev) => {
                        const next = [...prev.experience];
                        next[index] = { ...next[index], highlights: parseLines(e.target.value) };
                        return { ...prev, experience: next };
                      })
                    }
                    className="mt-2 w-full rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-sm text-white"
                  />
                  <Button
                    variant="ghost"
                    className="mt-2 !px-2 text-red-400"
                    onClick={() =>
                      setResume((prev) => ({
                        ...prev,
                        experience: prev.experience.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="secondary"
                className="gap-2"
                onClick={() =>
                  setResume((prev) => ({
                    ...prev,
                    experience: [
                      ...prev.experience,
                      {
                        id: makeId('exp'),
                        role: 'New Role',
                        company: 'New Company',
                        startDate: '2024',
                        endDate: 'Present',
                        highlights: ['Describe your impact in one line.'],
                      } as ExperienceItem,
                    ],
                  }))
                }
              >
                <Plus className="h-4 w-4" />
                Add Experience
              </Button>
            </div>
          )}

          {activeSection === 'education' && (
            <div className="space-y-4">
              {resume.education.map((item, index) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={item.degree}
                      placeholder="Degree"
                      onChange={(e) =>
                        setResume((prev) => {
                          const next = [...prev.education];
                          next[index] = { ...next[index], degree: e.target.value };
                          return { ...prev, education: next };
                        })
                      }
                      className="rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-sm text-white"
                    />
                    <input
                      value={item.institution}
                      placeholder="Institution"
                      onChange={(e) =>
                        setResume((prev) => {
                          const next = [...prev.education];
                          next[index] = { ...next[index], institution: e.target.value };
                          return { ...prev, education: next };
                        })
                      }
                      className="rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-sm text-white"
                    />
                    <input
                      value={item.startDate}
                      placeholder="Start"
                      onChange={(e) =>
                        setResume((prev) => {
                          const next = [...prev.education];
                          next[index] = { ...next[index], startDate: e.target.value };
                          return { ...prev, education: next };
                        })
                      }
                      className="rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-sm text-white"
                    />
                    <input
                      value={item.endDate}
                      placeholder="End"
                      onChange={(e) =>
                        setResume((prev) => {
                          const next = [...prev.education];
                          next[index] = { ...next[index], endDate: e.target.value };
                          return { ...prev, education: next };
                        })
                      }
                      className="rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    className="mt-2 !px-2 text-red-400"
                    onClick={() =>
                      setResume((prev) => ({
                        ...prev,
                        education: prev.education.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="secondary"
                className="gap-2"
                onClick={() =>
                  setResume((prev) => ({
                    ...prev,
                    education: [
                      ...prev.education,
                      {
                        id: makeId('edu'),
                        degree: 'Degree',
                        institution: 'Institution',
                        startDate: '2020',
                        endDate: '2024',
                      } as EducationItem,
                    ],
                  }))
                }
              >
                <Plus className="h-4 w-4" />
                Add Education
              </Button>
            </div>
          )}

          {activeSection === 'projects' && (
            <div className="space-y-4">
              {resume.projects.map((item, index) => (
                <div key={item.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-3">
                  <div className="grid grid-cols-1 gap-2">
                    <input
                      value={item.name}
                      placeholder="Project name"
                      onChange={(e) =>
                        setResume((prev) => {
                          const next = [...prev.projects];
                          next[index] = { ...next[index], name: e.target.value };
                          return { ...prev, projects: next };
                        })
                      }
                      className="rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-sm text-white"
                    />
                    <input
                      value={item.link}
                      placeholder="Project link"
                      onChange={(e) =>
                        setResume((prev) => {
                          const next = [...prev.projects];
                          next[index] = { ...next[index], link: e.target.value };
                          return { ...prev, projects: next };
                        })
                      }
                      className="rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-sm text-white"
                    />
                    <textarea
                      rows={4}
                      value={item.highlights.join('\n')}
                      onChange={(e) =>
                        setResume((prev) => {
                          const next = [...prev.projects];
                          next[index] = { ...next[index], highlights: parseLines(e.target.value) };
                          return { ...prev, projects: next };
                        })
                      }
                      className="rounded-xl border border-white/10 bg-slate-800/80 px-3 py-2 text-sm text-white"
                    />
                  </div>
                  <Button
                    variant="ghost"
                    className="mt-2 !px-2 text-red-400"
                    onClick={() =>
                      setResume((prev) => ({
                        ...prev,
                        projects: prev.projects.filter((_, i) => i !== index),
                      }))
                    }
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button
                variant="secondary"
                className="gap-2"
                onClick={() =>
                  setResume((prev) => ({
                    ...prev,
                    projects: [
                      ...prev.projects,
                      {
                        id: makeId('proj'),
                        name: 'New Project',
                        link: 'https://',
                        highlights: ['Add project impact and metrics.'],
                      } as ProjectItem,
                    ],
                  }))
                }
              >
                <Plus className="h-4 w-4" />
                Add Project
              </Button>
            </div>
          )}
        </section>

        <section className={`rounded-3xl border ${selectedTheme.previewBorder} bg-white p-6 text-slate-900 lg:col-span-5`}>
          <header className="border-b border-slate-200 pb-4">
            <h2 className="text-2xl font-bold">{resume.basics.fullName}</h2>
            <p className={`font-medium ${selectedTheme.accent}`}>{resume.basics.headline}</p>
            <p className="mt-1 text-sm text-slate-500">
              {[resume.basics.email, resume.basics.phone, resume.basics.location].filter(Boolean).join(' • ')}
            </p>
          </header>

          <div className={`mt-5 ${layoutMode === 'split' ? 'grid grid-cols-1 gap-5 md:grid-cols-2' : 'space-y-4'}`}>
            {previewSections.map((section) => {
              if (section === 'summary' && resume.summary) {
                return (
                  <section key={section}>
                    <h3 className={`mb-1 text-sm font-bold uppercase tracking-wider ${selectedTheme.accent}`}>Summary</h3>
                    <p className="text-sm text-slate-700">{resume.summary}</p>
                  </section>
                );
              }

              if (section === 'skills' && resume.skills.length) {
                return (
                  <section key={section}>
                    <h3 className={`mb-2 text-sm font-bold uppercase tracking-wider ${selectedTheme.accent}`}>Skills</h3>
                    <div className="flex flex-wrap gap-2">
                      {resume.skills.map((skill) => (
                        <span key={skill} className={selectedTheme.badge}>
                          {skill}
                        </span>
                      ))}
                    </div>
                  </section>
                );
              }

              if (section === 'experience' && resume.experience.length) {
                return (
                  <section key={section}>
                    <h3 className={`mb-2 text-sm font-bold uppercase tracking-wider ${selectedTheme.accent}`}>Experience</h3>
                    {resume.experience.map((item) => (
                      <div key={item.id} className="mb-3">
                        <p className="text-sm font-semibold">
                          {item.role} — {item.company}
                        </p>
                        <p className="text-xs text-slate-500">
                          {item.startDate} - {item.endDate}
                        </p>
                        <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
                          {item.highlights.map((line, idx) => (
                            <li key={idx}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </section>
                );
              }

              if (section === 'education' && resume.education.length) {
                return (
                  <section key={section}>
                    <h3 className={`mb-2 text-sm font-bold uppercase tracking-wider ${selectedTheme.accent}`}>Education</h3>
                    {resume.education.map((item) => (
                      <p key={item.id} className="text-sm text-slate-700">
                        <span className="font-semibold">{item.degree}</span> — {item.institution} ({item.startDate}-{item.endDate})
                      </p>
                    ))}
                  </section>
                );
              }

              if (section === 'projects' && resume.projects.length) {
                return (
                  <section key={section}>
                    <h3 className={`mb-2 text-sm font-bold uppercase tracking-wider ${selectedTheme.accent}`}>Projects</h3>
                    {resume.projects.map((item) => (
                      <div key={item.id} className="mb-3">
                        <p className="text-sm font-semibold">{item.name}</p>
                        <p className="text-xs text-slate-500">{item.link}</p>
                        <ul className="mt-1 list-disc pl-5 text-sm text-slate-700">
                          {item.highlights.map((line, idx) => (
                            <li key={idx}>{line}</li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </section>
                );
              }

              return null;
            })}
          </div>
        </section>
      </div>
    </main>
  );
}
