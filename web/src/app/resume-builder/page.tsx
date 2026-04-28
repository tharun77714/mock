'use client';

import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  Award,
  Briefcase,
  ChevronDown,
  ChevronUp,
  Eye,
  EyeOff,
  FileDown,
  FileText,
  FolderOpen,
  GraduationCap,
  Languages,
  Link2,
  Palette,
  Plus,
  Printer,
  RotateCcw,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Upload,
  User,
} from 'lucide-react';
import {
  defaultResume,
  ResumeDocument,
  ResumeSectionId,
  sectionLabels,
  sectionOrder,
} from '@/lib/resume-builder-schema';

type TemplateId = ResumeDocument['metadata']['template'];
type EnhanceStatus = 'idle' | 'loading' | 'success' | 'error';

const FONT_LINK_HREF =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Roboto:wght@400;500;700&family=Merriweather:wght@400;700&family=Lora:wght@400;500;700&family=Outfit:wght@400;500;600;700&family=Source+Sans+3:wght@400;600;700&family=Playfair+Display:wght@500;600;700&display=swap';

const TEMPLATES: Array<{ id: TemplateId; label: string; emoji: string }> = [
  { id: 'classic', label: 'Classic', emoji: 'CV' },
  { id: 'modern', label: 'Modern', emoji: 'MX' },
  { id: 'minimal', label: 'Minimal', emoji: 'MN' },
  { id: 'professional', label: 'Professional', emoji: 'PR' },
];

const ACCENT_COLORS = [
  '#6366f1',
  '#8b5cf6',
  '#ec4899',
  '#ef4444',
  '#f97316',
  '#eab308',
  '#22c55e',
  '#14b8a6',
  '#06b6d4',
  '#3b82f6',
  '#64748b',
  '#0f172a',
];

const FONTS = [
  'Inter',
  'Roboto',
  'Merriweather',
  'Lora',
  'Outfit',
  'Source Sans 3',
  'Playfair Display',
] as const;

const OPTION_STYLE: React.CSSProperties = {
  color: '#0f172a',
  backgroundColor: '#f8fafc',
};

const ICONS: Record<ResumeSectionId, React.ReactNode> = {
  basics: <User className="h-4 w-4" />,
  summary: <FileText className="h-4 w-4" />,
  profiles: <Link2 className="h-4 w-4" />,
  experience: <Briefcase className="h-4 w-4" />,
  education: <GraduationCap className="h-4 w-4" />,
  skills: <Settings2 className="h-4 w-4" />,
  projects: <FolderOpen className="h-4 w-4" />,
  certifications: <ShieldCheck className="h-4 w-4" />,
  languages: <Languages className="h-4 w-4" />,
  awards: <Award className="h-4 w-4" />,
};

const VALID_TEMPLATES = new Set<TemplateId>(TEMPLATES.map((template) => template.id));
const VALID_FONTS = new Set<string>(FONTS);
const VALID_ACCENTS = new Set<string>(ACCENT_COLORS);
const VALID_SECTIONS = new Set<ResumeSectionId>(sectionOrder);

const uid = (prefix: string) =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
const lines = (value: string) =>
  value
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean);

function clampFontSize(value: unknown, fallback = defaultResume.metadata.fontSize) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.min(13, Math.max(8, Math.round(numeric * 2) / 2));
}

function normalizeResume(resume: ResumeDocument): ResumeDocument {
  const metadata = resume?.metadata ?? defaultResume.metadata;
  return {
    ...resume,
    metadata: {
      ...defaultResume.metadata,
      ...metadata,
      template: VALID_TEMPLATES.has(metadata.template)
        ? metadata.template
        : defaultResume.metadata.template,
      fontFamily: VALID_FONTS.has(metadata.fontFamily)
        ? metadata.fontFamily
        : defaultResume.metadata.fontFamily,
      accentColor: VALID_ACCENTS.has(metadata.accentColor)
        ? metadata.accentColor
        : defaultResume.metadata.accentColor,
      fontSize: clampFontSize(metadata.fontSize),
    },
  };
}

function isSectionId(value: unknown): value is ResumeSectionId {
  return typeof value === 'string' && VALID_SECTIONS.has(value as ResumeSectionId);
}

export default function ResumeBuilderPage() {
  const [resume, setResume] = useState<ResumeDocument>(() =>
    normalizeResume(defaultResume)
  );
  const [active, setActive] = useState<ResumeSectionId>('basics');
  const [sections, setSections] = useState<ResumeSectionId[]>([...sectionOrder]);
  const [hidden, setHidden] = useState<Set<ResumeSectionId>>(new Set());
  const [designOpen, setDesignOpen] = useState(false);
  const [enhanceState, setEnhanceState] = useState<{
    status: EnhanceStatus;
    message: string;
  }>({ status: 'idle', message: '' });
  const previewRef = useRef<HTMLDivElement>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const metadata = resume.metadata;
  const visibleSections = useMemo(
    () => sections.filter((section) => !hidden.has(section)),
    [sections, hidden]
  );

  const setMetadata = useCallback((patch: Partial<ResumeDocument['metadata']>) => {
    setResume((current) =>
      normalizeResume({
        ...current,
        metadata: {
          ...current.metadata,
          ...patch,
        },
      })
    );
  }, []);

  const hasEnhanceableContent = useMemo(() => {
    return Boolean(
      resume.basics.fullName ||
        resume.basics.headline ||
        resume.summary.trim() ||
        resume.skills.some(Boolean) ||
        resume.experience.some(
          (item) =>
            item.role.trim() ||
            item.company.trim() ||
            item.highlights.some(Boolean)
        ) ||
        resume.projects.some(
          (item) =>
            item.name.trim() ||
            item.description.trim() ||
            item.highlights.some(Boolean)
        )
    );
  }, [resume]);

  const moveSection = (section: ResumeSectionId, direction: 'up' | 'down') => {
    setSections((current) => {
      const index = current.indexOf(section);
      const nextIndex = direction === 'up' ? index - 1 : index + 1;
      if (index < 0 || nextIndex < 0 || nextIndex >= current.length) return current;
      const next = [...current];
      [next[index], next[nextIndex]] = [next[nextIndex], next[index]];
      return next;
    });
  };

  const toggleSection = (section: ResumeSectionId) => {
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const resetBuilder = () => {
    setResume(normalizeResume(defaultResume));
    setSections([...sectionOrder]);
    setHidden(new Set());
    setEnhanceState({ status: 'idle', message: '' });
  };

  const saveSnapshot = () => {
    const payload = { resume, sections, hidden: [...hidden] };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `resume-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const loadSnapshot = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (data?.resume) setResume(normalizeResume(data.resume as ResumeDocument));
        if (Array.isArray(data?.sections)) {
          const nextSections = data.sections.filter(isSectionId);
          if (nextSections.length) setSections(nextSections);
        }
        if (Array.isArray(data?.hidden)) {
          setHidden(new Set(data.hidden.filter(isSectionId)));
        }
        setEnhanceState({ status: 'idle', message: '' });
      } catch {
        setEnhanceState({
          status: 'error',
          message: 'Could not load that file. Please import a valid resume JSON export.',
        });
      }
    };
    reader.readAsText(file);
    event.target.value = '';
  };

  const printPDF = () => {
    const preview = previewRef.current;
    if (!preview) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(
      `<!DOCTYPE html><html><head><title>Resume</title><link href="${FONT_LINK_HREF}" rel="stylesheet"><style>@page{size:A4;margin:0}*{margin:0;padding:0;box-sizing:border-box}body{font-family:'${metadata.fontFamily}',sans-serif;-webkit-print-color-adjust:exact;print-color-adjust:exact;background:#fff}</style></head><body>${preview.innerHTML}</body></html>`
    );
    printWindow.document.close();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const enhanceWithAI = async () => {
    if (!hasEnhanceableContent) {
      setEnhanceState({
        status: 'error',
        message: 'Add some resume content first, then AI Enhance can restyle the full PDF from the same input.',
      });
      return;
    }

    setEnhanceState({
      status: 'loading',
      message:
        'Groq is improving the writing and selecting a better template, font, and accent from the same resume input.',
    });

    try {
      const response = await fetch('/api/resume/enhance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resume }),
      });
      const data = await response.json();
      if (!response.ok || !data?.success || !data?.resume) {
        throw new Error(data?.error || 'AI enhancement failed.');
      }

      setResume(normalizeResume(data.resume as ResumeDocument));
      setDesignOpen(true);
      setEnhanceState({
        status: 'success',
        message:
          data.designNotes ||
          'AI refreshed the content and restyled the exported PDF without changing your original input flow.',
      });
    } catch (error) {
      setEnhanceState({
        status: 'error',
        message:
          error instanceof Error
            ? error.message
            : 'Something went wrong while enhancing the resume.',
      });
    }
  };

  const inputClassName =
    'w-full rounded-lg border border-white/[0.08] bg-white/[0.04] px-3 py-2.5 text-[13px] text-white outline-none transition-all placeholder:text-slate-600 focus:border-indigo-500/50 focus:bg-white/[0.06]';
  const selectClassName = `${inputClassName} resume-select appearance-none`;
  const labelClassName =
    'mb-1 block text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500';

  const statusCardClassName =
    enhanceState.status === 'loading'
      ? 'border-sky-500/25 bg-sky-500/10 text-sky-100'
      : enhanceState.status === 'success'
        ? 'border-emerald-500/25 bg-emerald-500/10 text-emerald-100'
        : enhanceState.status === 'error'
          ? 'border-rose-500/25 bg-rose-500/10 text-rose-100'
          : '';

  const renderEditor = () => {
    switch (active) {
      case 'basics':
        return (
          <div className="space-y-4">
            {(
              [
                ['fullName', 'Full Name', 'John Doe'],
                ['headline', 'Headline', 'Full-Stack Developer'],
                ['email', 'Email', 'john@example.com'],
                ['phone', 'Phone', '+1 234 567 890'],
                ['location', 'Location', 'San Francisco, CA'],
                ['website', 'Website', 'https://johndoe.dev'],
              ] as const
            ).map(([key, label, placeholder]) => (
              <div key={key}>
                <label className={labelClassName}>{label}</label>
                <input
                  value={resume.basics[key]}
                  placeholder={placeholder}
                  className={inputClassName}
                  onChange={(event) =>
                    setResume((current) => ({
                      ...current,
                      basics: { ...current.basics, [key]: event.target.value },
                    }))
                  }
                />
              </div>
            ))}
          </div>
        );

      case 'summary':
        return (
          <div>
            <label className={labelClassName}>Professional Summary</label>
            <textarea
              value={resume.summary}
              rows={6}
              placeholder="A compelling 2-3 sentence summary of your professional profile..."
              className={`${inputClassName} resize-y`}
              onChange={(event) =>
                setResume((current) => ({ ...current, summary: event.target.value }))
              }
            />
          </div>
        );

      case 'profiles':
        return (
          <div className="space-y-3">
            {resume.profiles.map((item, index) => (
              <div
                key={item.id}
                className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-3"
              >
                <div className="grid grid-cols-2 gap-2">
                  <input
                    value={item.network}
                    placeholder="Network (GitHub)"
                    className={inputClassName}
                    onChange={(event) =>
                      setResume((current) => {
                        const profiles = [...current.profiles];
                        profiles[index] = { ...profiles[index], network: event.target.value };
                        return { ...current, profiles };
                      })
                    }
                  />
                  <input
                    value={item.username}
                    placeholder="Username"
                    className={inputClassName}
                    onChange={(event) =>
                      setResume((current) => {
                        const profiles = [...current.profiles];
                        profiles[index] = { ...profiles[index], username: event.target.value };
                        return { ...current, profiles };
                      })
                    }
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    value={item.url}
                    placeholder="https://github.com/username"
                    className={inputClassName}
                    onChange={(event) =>
                      setResume((current) => {
                        const profiles = [...current.profiles];
                        profiles[index] = { ...profiles[index], url: event.target.value };
                        return { ...current, profiles };
                      })
                    }
                  />
                  <button
                    onClick={() =>
                      setResume((current) => ({
                        ...current,
                        profiles: current.profiles.filter((_, itemIndex) => itemIndex !== index),
                      }))
                    }
                    className="shrink-0 rounded-lg p-2 text-red-400/60 transition hover:bg-red-500/10 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={() =>
                setResume((current) => ({
                  ...current,
                  profiles: [
                    ...current.profiles,
                    { id: uid('profile'), network: '', username: '', url: '' },
                  ],
                }))
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-2.5 text-xs text-slate-400 transition hover:border-indigo-500/30 hover:text-indigo-300"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Profile
            </button>
          </div>
        );

      case 'experience':
        return (
          <div className="space-y-4">
            {resume.experience.map((item, index) => (
              <div
                key={item.id}
                className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
              >
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelClassName}>Job Title</label>
                    <input
                      value={item.role}
                      placeholder="Software Engineer"
                      className={inputClassName}
                      onChange={(event) =>
                        setResume((current) => {
                          const experience = [...current.experience];
                          experience[index] = { ...experience[index], role: event.target.value };
                          return { ...current, experience };
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClassName}>Company</label>
                    <input
                      value={item.company}
                      placeholder="Google"
                      className={inputClassName}
                      onChange={(event) =>
                        setResume((current) => {
                          const experience = [...current.experience];
                          experience[index] = {
                            ...experience[index],
                            company: event.target.value,
                          };
                          return { ...current, experience };
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClassName}>Start Date</label>
                    <input
                      value={item.startDate}
                      placeholder="Jan 2022"
                      className={inputClassName}
                      onChange={(event) =>
                        setResume((current) => {
                          const experience = [...current.experience];
                          experience[index] = {
                            ...experience[index],
                            startDate: event.target.value,
                          };
                          return { ...current, experience };
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClassName}>End Date</label>
                    <input
                      value={item.endDate}
                      placeholder="Present"
                      className={inputClassName}
                      onChange={(event) =>
                        setResume((current) => {
                          const experience = [...current.experience];
                          experience[index] = {
                            ...experience[index],
                            endDate: event.target.value,
                          };
                          return { ...current, experience };
                        })
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClassName}>Highlights (one per line)</label>
                  <textarea
                    value={item.highlights.join('\n')}
                    rows={3}
                    placeholder="- Led migration to microservices&#10;- Reduced latency by 40%"
                    className={`${inputClassName} resize-y`}
                    onChange={(event) =>
                      setResume((current) => {
                        const experience = [...current.experience];
                        experience[index] = {
                          ...experience[index],
                          highlights: lines(event.target.value),
                        };
                        return { ...current, experience };
                      })
                    }
                  />
                </div>
                <button
                  onClick={() =>
                    setResume((current) => ({
                      ...current,
                      experience: current.experience.filter(
                        (_, itemIndex) => itemIndex !== index
                      ),
                    }))
                  }
                  className="flex items-center gap-1 text-xs text-red-400/60 transition hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                setResume((current) => ({
                  ...current,
                  experience: [
                    ...current.experience,
                    {
                      id: uid('experience'),
                      role: '',
                      company: '',
                      startDate: '',
                      endDate: '',
                      highlights: [],
                    },
                  ],
                }))
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-3 text-xs text-slate-400 transition hover:border-indigo-500/30 hover:text-indigo-300"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Experience
            </button>
          </div>
        );

      case 'education':
        return (
          <div className="space-y-4">
            {resume.education.map((item, index) => (
              <div
                key={item.id}
                className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
              >
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['degree', 'Degree', 'B.S. Computer Science'],
                      ['institution', 'Institution', 'MIT'],
                      ['field', 'Field', 'Computer Science'],
                      ['gpa', 'GPA', '3.8'],
                      ['startDate', 'Start', '2018'],
                      ['endDate', 'End', '2022'],
                    ] as const
                  ).map(([key, label, placeholder]) => (
                    <div key={key}>
                      <label className={labelClassName}>{label}</label>
                      <input
                        value={item[key] || ''}
                        placeholder={placeholder}
                        className={inputClassName}
                        onChange={(event) =>
                          setResume((current) => {
                            const education = [...current.education];
                            education[index] = { ...education[index], [key]: event.target.value };
                            return { ...current, education };
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() =>
                    setResume((current) => ({
                      ...current,
                      education: current.education.filter(
                        (_, itemIndex) => itemIndex !== index
                      ),
                    }))
                  }
                  className="flex items-center gap-1 text-xs text-red-400/60 transition hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                setResume((current) => ({
                  ...current,
                  education: [
                    ...current.education,
                    {
                      id: uid('education'),
                      degree: '',
                      institution: '',
                      field: '',
                      startDate: '',
                      endDate: '',
                      gpa: '',
                    },
                  ],
                }))
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-3 text-xs text-slate-400 transition hover:border-indigo-500/30 hover:text-indigo-300"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Education
            </button>
          </div>
        );

      case 'skills':
        return (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {resume.skills.map((skill, index) => (
                <div
                  key={`${skill}-${index}`}
                  className="flex items-center gap-1 rounded-lg border border-white/[0.08] bg-white/[0.04] px-2.5 py-1.5"
                >
                  <input
                    value={skill}
                    placeholder="Skill"
                    className="w-24 bg-transparent text-xs text-white outline-none"
                    onChange={(event) =>
                      setResume((current) => {
                        const skills = [...current.skills];
                        skills[index] = event.target.value;
                        return { ...current, skills };
                      })
                    }
                  />
                  <button
                    onClick={() =>
                      setResume((current) => ({
                        ...current,
                        skills: current.skills.filter((_, itemIndex) => itemIndex !== index),
                      }))
                    }
                    className="text-slate-600 transition hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={() =>
                setResume((current) => ({
                  ...current,
                  skills: [...current.skills, ''],
                }))
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-2.5 text-xs text-slate-400 transition hover:border-indigo-500/30 hover:text-indigo-300"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Skill
            </button>
          </div>
        );

      case 'projects':
        return (
          <div className="space-y-4">
            {resume.projects.map((item, index) => (
              <div
                key={item.id}
                className="space-y-3 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
              >
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className={labelClassName}>Name</label>
                    <input
                      value={item.name}
                      placeholder="Project Name"
                      className={inputClassName}
                      onChange={(event) =>
                        setResume((current) => {
                          const projects = [...current.projects];
                          projects[index] = { ...projects[index], name: event.target.value };
                          return { ...current, projects };
                        })
                      }
                    />
                  </div>
                  <div>
                    <label className={labelClassName}>Link</label>
                    <input
                      value={item.link}
                      placeholder="https://..."
                      className={inputClassName}
                      onChange={(event) =>
                        setResume((current) => {
                          const projects = [...current.projects];
                          projects[index] = { ...projects[index], link: event.target.value };
                          return { ...current, projects };
                        })
                      }
                    />
                  </div>
                </div>
                <div>
                  <label className={labelClassName}>Description</label>
                  <input
                    value={item.description}
                    placeholder="Brief description"
                    className={inputClassName}
                    onChange={(event) =>
                      setResume((current) => {
                        const projects = [...current.projects];
                        projects[index] = {
                          ...projects[index],
                          description: event.target.value,
                        };
                        return { ...current, projects };
                      })
                    }
                  />
                </div>
                <div>
                  <label className={labelClassName}>Highlights</label>
                  <textarea
                    value={item.highlights.join('\n')}
                    rows={2}
                    placeholder="Key highlights"
                    className={`${inputClassName} resize-y`}
                    onChange={(event) =>
                      setResume((current) => {
                        const projects = [...current.projects];
                        projects[index] = {
                          ...projects[index],
                          highlights: lines(event.target.value),
                        };
                        return { ...current, projects };
                      })
                    }
                  />
                </div>
                <button
                  onClick={() =>
                    setResume((current) => ({
                      ...current,
                      projects: current.projects.filter((_, itemIndex) => itemIndex !== index),
                    }))
                  }
                  className="flex items-center gap-1 text-xs text-red-400/60 transition hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                setResume((current) => ({
                  ...current,
                  projects: [
                    ...current.projects,
                    {
                      id: uid('project'),
                      name: '',
                      link: '',
                      description: '',
                      highlights: [],
                    },
                  ],
                }))
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-3 text-xs text-slate-400 transition hover:border-indigo-500/30 hover:text-indigo-300"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Project
            </button>
          </div>
        );

      case 'certifications':
        return (
          <div className="space-y-4">
            {resume.certifications.map((item, index) => (
              <div
                key={item.id}
                className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
              >
                <div className="grid grid-cols-2 gap-2">
                  {(
                    [
                      ['name', 'Name', 'AWS Solutions Architect'],
                      ['issuer', 'Issuer', 'Amazon'],
                      ['date', 'Date', '2023'],
                      ['url', 'URL', 'https://...'],
                    ] as const
                  ).map(([key, label, placeholder]) => (
                    <div key={key}>
                      <label className={labelClassName}>{label}</label>
                      <input
                        value={item[key] || ''}
                        placeholder={placeholder}
                        className={inputClassName}
                        onChange={(event) =>
                          setResume((current) => {
                            const certifications = [...current.certifications];
                            certifications[index] = {
                              ...certifications[index],
                              [key]: event.target.value,
                            };
                            return { ...current, certifications };
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
                <button
                  onClick={() =>
                    setResume((current) => ({
                      ...current,
                      certifications: current.certifications.filter(
                        (_, itemIndex) => itemIndex !== index
                      ),
                    }))
                  }
                  className="flex items-center gap-1 text-xs text-red-400/60 transition hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                setResume((current) => ({
                  ...current,
                  certifications: [
                    ...current.certifications,
                    {
                      id: uid('certification'),
                      name: '',
                      issuer: '',
                      date: '',
                      url: '',
                    },
                  ],
                }))
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-3 text-xs text-slate-400 transition hover:border-indigo-500/30 hover:text-indigo-300"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Certification
            </button>
          </div>
        );

      case 'languages':
        return (
          <div className="space-y-3">
            {resume.languages.map((item, index) => (
              <div key={item.id} className="flex items-center gap-2">
                <input
                  value={item.name}
                  placeholder="Language"
                  className={inputClassName}
                  onChange={(event) =>
                    setResume((current) => {
                      const languages = [...current.languages];
                      languages[index] = { ...languages[index], name: event.target.value };
                      return { ...current, languages };
                    })
                  }
                />
                <select
                  value={item.fluency}
                  className={`${selectClassName} max-w-[130px]`}
                  onChange={(event) =>
                    setResume((current) => {
                      const languages = [...current.languages];
                      languages[index] = {
                        ...languages[index],
                        fluency: event.target.value,
                      };
                      return { ...current, languages };
                    })
                  }
                >
                  <option value="" style={OPTION_STYLE}>
                    Level
                  </option>
                  {['Native', 'Fluent', 'Advanced', 'Intermediate', 'Basic'].map(
                    (level) => (
                      <option key={level} value={level} style={OPTION_STYLE}>
                        {level}
                      </option>
                    )
                  )}
                </select>
                <button
                  onClick={() =>
                    setResume((current) => ({
                      ...current,
                      languages: current.languages.filter(
                        (_, itemIndex) => itemIndex !== index
                      ),
                    }))
                  }
                  className="shrink-0 text-slate-600 transition hover:text-red-400"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                setResume((current) => ({
                  ...current,
                  languages: [
                    ...current.languages,
                    { id: uid('language'), name: '', fluency: '' },
                  ],
                }))
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-2.5 text-xs text-slate-400 transition hover:border-indigo-500/30 hover:text-indigo-300"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Language
            </button>
          </div>
        );

      case 'awards':
        return (
          <div className="space-y-4">
            {resume.awards.map((item, index) => (
              <div
                key={item.id}
                className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4"
              >
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      ['title', 'Title', 'Best Innovation'],
                      ['awarder', 'Awarder', 'IEEE'],
                      ['date', 'Date', '2023'],
                    ] as const
                  ).map(([key, label, placeholder]) => (
                    <div key={key}>
                      <label className={labelClassName}>{label}</label>
                      <input
                        value={item[key] || ''}
                        placeholder={placeholder}
                        className={inputClassName}
                        onChange={(event) =>
                          setResume((current) => {
                            const awards = [...current.awards];
                            awards[index] = { ...awards[index], [key]: event.target.value };
                            return { ...current, awards };
                          })
                        }
                      />
                    </div>
                  ))}
                </div>
                <div>
                  <label className={labelClassName}>Description</label>
                  <textarea
                    value={item.summary}
                    rows={2}
                    placeholder="Details"
                    className={`${inputClassName} resize-y`}
                    onChange={(event) =>
                      setResume((current) => {
                        const awards = [...current.awards];
                        awards[index] = { ...awards[index], summary: event.target.value };
                        return { ...current, awards };
                      })
                    }
                  />
                </div>
                <button
                  onClick={() =>
                    setResume((current) => ({
                      ...current,
                      awards: current.awards.filter((_, itemIndex) => itemIndex !== index),
                    }))
                  }
                  className="flex items-center gap-1 text-xs text-red-400/60 transition hover:text-red-400"
                >
                  <Trash2 className="h-3 w-3" />
                  Remove
                </button>
              </div>
            ))}
            <button
              onClick={() =>
                setResume((current) => ({
                  ...current,
                  awards: [
                    ...current.awards,
                    {
                      id: uid('award'),
                      title: '',
                      awarder: '',
                      date: '',
                      summary: '',
                    },
                  ],
                }))
              }
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/10 py-3 text-xs text-slate-400 transition hover:border-indigo-500/30 hover:text-indigo-300"
            >
              <Plus className="h-3.5 w-3.5" />
              Add Award
            </button>
          </div>
        );

      default:
        return null;
    }
  };

  const accent = metadata.accentColor;
  const fontSize = metadata.fontSize;

  const pageStyle: React.CSSProperties = (() => {
    const base: React.CSSProperties = {
      width: '210mm',
      minHeight: '297mm',
      background: '#ffffff',
      color: '#1f2937',
      fontFamily: `'${metadata.fontFamily}', sans-serif`,
      fontSize,
      lineHeight: 1.55,
      padding: '22mm 20mm',
    };

    switch (metadata.template) {
      case 'classic':
        return { ...base, boxShadow: 'inset 0 0 0 1px rgba(148, 163, 184, 0.18)' };
      case 'minimal':
        return { ...base, color: '#334155', padding: '24mm 22mm' };
      case 'professional':
        return {
          ...base,
          padding: '18mm 18mm 20mm',
          boxShadow: 'inset 0 0 0 1px rgba(15, 23, 42, 0.05)',
        };
      default:
        return { ...base, padding: '20mm' };
    }
  })();

  const sectionTitleStyle: React.CSSProperties = (() => {
    switch (metadata.template) {
      case 'classic':
        return {
          fontSize: fontSize * 1.05,
          fontWeight: 800,
          letterSpacing: 1.2,
          textTransform: 'uppercase',
          color: accent,
          borderBottom: `1px solid ${accent}`,
          paddingBottom: 5,
          margin: '16px 0 8px',
        };
      case 'minimal':
        return {
          fontSize,
          fontWeight: 700,
          letterSpacing: 2.2,
          textTransform: 'uppercase',
          color: '#475569',
          margin: '18px 0 10px',
        };
      case 'professional':
        return {
          fontSize: fontSize * 0.95,
          fontWeight: 800,
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          color: '#0f172a',
          background: `linear-gradient(90deg, ${accent}18, transparent)`,
          borderLeft: `4px solid ${accent}`,
          padding: '6px 0 6px 10px',
          margin: '16px 0 10px',
        };
      default:
        return {
          fontSize: fontSize * 1.12,
          fontWeight: 800,
          letterSpacing: 1.8,
          textTransform: 'uppercase',
          color: accent,
          borderBottom: `2px solid ${accent}`,
          paddingBottom: 4,
          margin: '14px 0 8px',
        };
    }
  })();

  const itemTitleStyle: React.CSSProperties = {
    fontSize: fontSize * 1.05,
    fontWeight: metadata.template === 'professional' ? 800 : 700,
    color: metadata.template === 'minimal' ? '#1e293b' : '#0f172a',
  };

  const dateStyle: React.CSSProperties = {
    fontSize: fontSize * 0.82,
    color: metadata.template === 'professional' ? '#64748b' : '#94a3b8',
    whiteSpace: 'nowrap',
  };

  const skillChipStyle: React.CSSProperties =
    metadata.template === 'classic'
      ? {
          padding: '2px 8px',
          borderRadius: 999,
          border: `1px solid ${accent}55`,
          color: '#1e293b',
          background: `${accent}10`,
          fontSize: fontSize * 0.84,
          fontWeight: 600,
        }
      : metadata.template === 'professional'
        ? {
            padding: '4px 10px',
            borderRadius: 6,
            border: '1px solid rgba(15, 23, 42, 0.08)',
            color: '#0f172a',
            background: `linear-gradient(135deg, ${accent}14, rgba(255,255,255,0.7))`,
            fontSize: fontSize * 0.85,
            fontWeight: 700,
          }
        : {
            padding: '3px 10px',
            borderRadius: 5,
            border: `1px solid ${accent}30`,
            color: accent,
            background: `${accent}15`,
            fontSize: fontSize * 0.88,
            fontWeight: 600,
          };

  const renderHeader = () => {
    if (!resume.basics.fullName) return null;
    const contactItems = [
      resume.basics.email,
      resume.basics.phone,
      resume.basics.location,
      resume.basics.website,
    ].filter(Boolean);
    const profileItems =
      !hidden.has('profiles') && resume.profiles.length
        ? resume.profiles
            .filter((profile) => profile.network || profile.url)
            .map((profile) =>
              `${profile.network}${profile.username ? `: ${profile.username}` : ''}`
            )
        : [];

    if (metadata.template === 'classic') {
      return (
        <div style={{ marginBottom: 18, paddingBottom: 14, borderBottom: `2px solid ${accent}` }}>
          <h1 style={{ margin: 0, fontSize: fontSize * 2.25, fontWeight: 800, color: '#0f172a' }}>
            {resume.basics.fullName}
          </h1>
          {resume.basics.headline && (
            <div style={{ marginTop: 4, fontSize: fontSize * 1.08, color: '#334155' }}>
              {resume.basics.headline}
            </div>
          )}
          {contactItems.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px 14px',
                marginTop: 8,
                color: '#64748b',
                fontSize: fontSize * 0.86,
              }}
            >
              {contactItems.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          )}
          {profileItems.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px 12px',
                marginTop: 6,
                color: accent,
                fontSize: fontSize * 0.82,
              }}
            >
              {profileItems.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (metadata.template === 'minimal') {
      return (
        <div style={{ marginBottom: 22, textAlign: 'center' }}>
          <div style={{ height: 1, background: '#e2e8f0', marginBottom: 16 }} />
          <h1
            style={{
              margin: 0,
              fontSize: fontSize * 2.35,
              fontWeight: 700,
              letterSpacing: -0.3,
              color: '#0f172a',
            }}
          >
            {resume.basics.fullName}
          </h1>
          {resume.basics.headline && (
            <div style={{ marginTop: 6, fontSize: fontSize * 1.02, color: accent }}>
              {resume.basics.headline}
            </div>
          )}
          {contactItems.length > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: '4px 12px',
                marginTop: 10,
                color: '#64748b',
                fontSize: fontSize * 0.84,
              }}
            >
              {contactItems.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          )}
          {profileItems.length > 0 && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'center',
                flexWrap: 'wrap',
                gap: '4px 12px',
                marginTop: 6,
                color: '#475569',
                fontSize: fontSize * 0.8,
              }}
            >
              {profileItems.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (metadata.template === 'professional') {
      return (
        <div
          style={{
            marginBottom: 18,
            padding: '16px 18px',
            borderRadius: 16,
            background: `linear-gradient(135deg, ${accent}, #0f172a)`,
            color: '#ffffff',
          }}
        >
          <h1 style={{ margin: 0, fontSize: fontSize * 2.3, fontWeight: 800, letterSpacing: -0.5 }}>
            {resume.basics.fullName}
          </h1>
          {resume.basics.headline && (
            <div
              style={{
                marginTop: 4,
                fontSize: fontSize * 1.05,
                fontWeight: 500,
                color: 'rgba(255,255,255,0.92)',
              }}
            >
              {resume.basics.headline}
            </div>
          )}
          {contactItems.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px 14px',
                marginTop: 10,
                color: 'rgba(255,255,255,0.82)',
                fontSize: fontSize * 0.84,
              }}
            >
              {contactItems.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          )}
          {profileItems.length > 0 && (
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '4px 12px',
                marginTop: 6,
                color: 'rgba(255,255,255,0.72)',
                fontSize: fontSize * 0.8,
              }}
            >
              {profileItems.map((item) => (
                <span key={item}>{item}</span>
              ))}
            </div>
          )}
        </div>
      );
    }

    return (
      <div style={{ marginBottom: 18, paddingLeft: 14, borderLeft: `4px solid ${accent}` }}>
        <h1
          style={{
            margin: 0,
            fontSize: fontSize * 2.4,
            fontWeight: 800,
            letterSpacing: -0.5,
            color: '#0f172a',
          }}
        >
          {resume.basics.fullName}
        </h1>
        {resume.basics.headline && (
          <div style={{ marginTop: 2, fontSize: fontSize * 1.2, fontWeight: 500, color: accent }}>
            {resume.basics.headline}
          </div>
        )}
        {contactItems.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px 16px',
              marginTop: 6,
              color: '#64748b',
              fontSize: fontSize * 0.88,
            }}
          >
            {contactItems.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        )}
        {profileItems.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px 16px',
              marginTop: 4,
              color: '#94a3b8',
              fontSize: fontSize * 0.85,
            }}
          >
            {profileItems.map((item) => (
              <span key={item}>{item}</span>
            ))}
          </div>
        )}
      </div>
    );
  };

  const renderTemplateLead = () =>
    metadata.template === 'modern' ? (
      <div
        style={{
          height: 6,
          borderRadius: 999,
          background: `linear-gradient(90deg, ${accent}, #0f172a)`,
          marginBottom: 18,
        }}
      />
    ) : null;

  const renderPreview = () => {
    const skills = resume.skills.filter(Boolean);
    return (
      <div ref={previewRef} style={pageStyle}>
        {renderTemplateLead()}
        {renderHeader()}
        {visibleSections.map((section) => {
          if (section === 'basics' || section === 'profiles') return null;
          if (section === 'summary' && resume.summary) {
            return (
              <div key={section}>
                <h2 style={sectionTitleStyle}>Summary</h2>
                <p style={{ lineHeight: metadata.template === 'minimal' ? 1.72 : 1.65 }}>
                  {resume.summary}
                </p>
              </div>
            );
          }
          if (section === 'experience' && resume.experience.length > 0) {
            return (
              <div key={section}>
                <h2 style={sectionTitleStyle}>Experience</h2>
                {resume.experience.map((item) => (
                  <div key={item.id} style={{ marginBottom: 12 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        gap: 12,
                      }}
                    >
                      <span style={itemTitleStyle}>
                        {item.role}
                        {item.company ? ` - ${item.company}` : ''}
                      </span>
                      <span style={dateStyle}>
                        {item.startDate}
                        {item.endDate ? ` - ${item.endDate}` : ''}
                      </span>
                    </div>
                    {item.highlights.length > 0 && (
                      <ul style={{ marginTop: 4, paddingLeft: 18 }}>
                        {item.highlights.map((highlight, index) => (
                          <li key={`${item.id}-${index}`} style={{ marginBottom: 3 }}>
                            {highlight}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            );
          }
          if (section === 'education' && resume.education.length > 0) {
            return (
              <div key={section}>
                <h2 style={sectionTitleStyle}>Education</h2>
                {resume.education.map((item) => (
                  <div key={item.id} style={{ marginBottom: 8 }}>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'baseline',
                        gap: 12,
                      }}
                    >
                      <span>
                        <strong>{item.degree}</strong>
                        {item.field ? ` in ${item.field}` : ''}
                        {item.institution ? ` - ${item.institution}` : ''}
                      </span>
                      <span style={dateStyle}>
                        {item.startDate}
                        {item.endDate ? ` - ${item.endDate}` : ''}
                      </span>
                    </div>
                    {item.gpa && (
                      <div style={{ color: '#64748b', fontSize: fontSize * 0.85 }}>
                        GPA: {item.gpa}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          }
          if (section === 'skills' && skills.length > 0) {
            return (
              <div key={section}>
                <h2 style={sectionTitleStyle}>Skills</h2>
                {metadata.template === 'minimal' ? (
                  <p style={{ color: '#475569', lineHeight: 1.8 }}>{skills.join(' • ')}</p>
                ) : (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                    {skills.map((skill) => (
                      <span key={skill} style={skillChipStyle}>
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          }
          if (section === 'projects' && resume.projects.length > 0) {
            return (
              <div key={section}>
                <h2 style={sectionTitleStyle}>Projects</h2>
                {resume.projects.map((item) => (
                  <div key={item.id} style={{ marginBottom: 10 }}>
                    <div style={itemTitleStyle}>{item.name}</div>
                    {item.link && (
                      <div style={{ color: accent, fontSize: fontSize * 0.8 }}>{item.link}</div>
                    )}
                    {item.description && (
                      <div style={{ marginTop: 2, fontSize: fontSize * 0.92 }}>
                        {item.description}
                      </div>
                    )}
                    {item.highlights.length > 0 && (
                      <ul style={{ marginTop: 4, paddingLeft: 18 }}>
                        {item.highlights.map((highlight, index) => (
                          <li key={`${item.id}-${index}`}>{highlight}</li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            );
          }
          if (section === 'certifications' && resume.certifications.length > 0) {
            return (
              <div key={section}>
                <h2 style={sectionTitleStyle}>Certifications</h2>
                {resume.certifications.map((item) => (
                  <div key={item.id} style={{ marginBottom: 5 }}>
                    <strong>{item.name}</strong>
                    {item.issuer ? ` - ${item.issuer}` : ''}
                    {item.date ? ` (${item.date})` : ''}
                  </div>
                ))}
              </div>
            );
          }
          if (section === 'languages' && resume.languages.length > 0) {
            return (
              <div key={section}>
                <h2 style={sectionTitleStyle}>Languages</h2>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px' }}>
                  {resume.languages.map((item) => (
                    <span key={item.id}>
                      <strong>{item.name}</strong>
                      {item.fluency ? ` - ${item.fluency}` : ''}
                    </span>
                  ))}
                </div>
              </div>
            );
          }
          if (section === 'awards' && resume.awards.length > 0) {
            return (
              <div key={section}>
                <h2 style={sectionTitleStyle}>Awards</h2>
                {resume.awards.map((item) => (
                  <div key={item.id} style={{ marginBottom: 5 }}>
                    <strong>{item.title}</strong>
                    {item.awarder ? ` - ${item.awarder}` : ''}
                    {item.date ? ` (${item.date})` : ''}
                    {item.summary && (
                      <div style={{ color: '#64748b', fontSize: fontSize * 0.85 }}>
                        {item.summary}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            );
          }
          return null;
        })}
        {!resume.basics.fullName && (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '250mm',
              textAlign: 'center',
              color: '#cbd5e1',
            }}
          >
            <div style={{ marginBottom: 16, fontSize: 42 }}>Resume</div>
            <div style={{ fontSize: 18, fontWeight: 700 }}>Start Building Your Resume</div>
            <div
              style={{
                marginTop: 8,
                maxWidth: 320,
                color: '#94a3b8',
                fontSize: 13,
              }}
            >
              Fill in the sections on the left to see your resume update in real time.
            </div>
          </div>
        )}
      </div>
    );
  };

  const topActions = [
    {
      label: 'Design',
      icon: <Palette className="h-3.5 w-3.5" />,
      onClick: () => setDesignOpen((current) => !current),
      active: designOpen,
    },
    {
      label: enhanceState.status === 'loading' ? 'Enhancing...' : 'AI Enhance',
      icon: <Sparkles className="h-3.5 w-3.5" />,
      onClick: enhanceWithAI,
      tone: 'ai' as const,
      disabled: enhanceState.status === 'loading' || !hasEnhanceableContent,
    },
    {
      label: 'Import',
      icon: <Upload className="h-3.5 w-3.5" />,
      onClick: () => importRef.current?.click(),
    },
    {
      label: 'Reset',
      icon: <RotateCcw className="h-3.5 w-3.5" />,
      onClick: resetBuilder,
    },
    {
      label: 'Save',
      icon: <FileDown className="h-3.5 w-3.5" />,
      onClick: saveSnapshot,
    },
    {
      label: 'PDF',
      icon: <Printer className="h-3.5 w-3.5" />,
      onClick: printPDF,
      tone: 'pdf' as const,
    },
  ];

  return (
    <div
      className="min-h-screen bg-[#0a0a0f] text-slate-100"
      style={{ fontFamily: "'Inter', -apple-system, sans-serif" }}
    >
      <link href={FONT_LINK_HREF} rel="stylesheet" />
      <input
        ref={importRef}
        type="file"
        accept=".json"
        className="hidden"
        onChange={loadSnapshot}
      />

      <div className="sticky top-0 z-40 flex items-center justify-between border-b border-white/[0.06] bg-[#0e0e16]/90 px-4 py-2 backdrop-blur-xl">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-sky-600 to-cyan-500 text-white shadow-lg shadow-sky-500/20">
            <FileText className="h-4 w-4" />
          </div>
          <div>
            <h1 className="text-sm font-bold leading-tight text-white">Resume Builder</h1>
            <p className="text-[10px] text-slate-500">
              Live preview, template switching, and Groq-powered AI styling
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {topActions.map((action) => (
            <button
              key={action.label}
              onClick={action.onClick}
              disabled={action.disabled}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[11px] font-semibold transition-all ${
                action.active
                  ? 'border-indigo-500/30 bg-indigo-500/20 text-indigo-300'
                  : action.tone === 'pdf'
                    ? 'border-emerald-500/50 bg-emerald-600 text-white shadow-lg shadow-emerald-500/10 hover:bg-emerald-500'
                    : action.tone === 'ai'
                      ? 'border-sky-500/50 bg-sky-600 text-white shadow-lg shadow-sky-500/10 hover:bg-sky-500 disabled:border-sky-500/20 disabled:bg-sky-800/40'
                      : 'border-transparent text-slate-400 hover:bg-white/[0.06] hover:text-white'
              } ${action.disabled ? 'cursor-not-allowed opacity-60' : ''}`}
            >
              {action.icon}
              {action.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex" style={{ height: 'calc(100vh - 60px)' }}>
        <aside
          className="flex w-[240px] shrink-0 flex-col overflow-y-auto border-r border-white/[0.06] bg-[#0c0c14]"
          style={{ scrollbarWidth: 'thin' }}
        >
          <div className="flex-1 p-3">
            {enhanceState.status !== 'idle' && (
              <div className={`mb-3 rounded-xl border p-3 ${statusCardClassName}`}>
                <p className="text-[9px] font-bold uppercase tracking-[0.15em]">
                  {enhanceState.status === 'loading'
                    ? 'AI Enhancer'
                    : enhanceState.status === 'success'
                      ? 'AI Applied'
                      : 'Enhancer Error'}
                </p>
                <p className="mt-1 text-[11px] leading-5 text-current/90">
                  {enhanceState.message}
                </p>
              </div>
            )}

            <p className="mb-2 px-1 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600">
              Sections
            </p>
            <div className="space-y-0.5">
              {sections.map((section) => (
                <button
                  key={section}
                  onClick={() => setActive(section)}
                  className={`group flex w-full items-center justify-between rounded-lg px-2.5 py-2 text-left transition-all ${
                    active === section
                      ? 'bg-indigo-500/15 text-indigo-200 shadow-sm shadow-indigo-500/5'
                      : hidden.has(section)
                        ? 'text-slate-700 hover:text-slate-500'
                        : 'text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                  }`}
                >
                  <span className="flex items-center gap-2.5 text-[12px] font-medium">
                    <span
                      className={
                        active === section
                          ? 'text-indigo-400'
                          : hidden.has(section)
                            ? 'text-slate-700'
                            : 'text-slate-500'
                      }
                    >
                      {ICONS[section]}
                    </span>
                    {sectionLabels[section]}
                  </span>
                  <span className="flex items-center gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
                    <span
                      className="cursor-pointer rounded p-0.5 hover:bg-white/10"
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleSection(section);
                      }}
                    >
                      {hidden.has(section) ? (
                        <EyeOff className="h-3 w-3" />
                      ) : (
                        <Eye className="h-3 w-3" />
                      )}
                    </span>
                    <span
                      className="cursor-pointer rounded p-0.5 hover:bg-white/10"
                      onClick={(event) => {
                        event.stopPropagation();
                        moveSection(section, 'up');
                      }}
                    >
                      <ChevronUp className="h-3 w-3" />
                    </span>
                    <span
                      className="cursor-pointer rounded p-0.5 hover:bg-white/10"
                      onClick={(event) => {
                        event.stopPropagation();
                        moveSection(section, 'down');
                      }}
                    >
                      <ChevronDown className="h-3 w-3" />
                    </span>
                  </span>
                </button>
              ))}
            </div>
          </div>

          {designOpen && (
            <div className="space-y-4 border-t border-white/[0.06] bg-[#08080e] p-3">
              <div className="rounded-xl border border-sky-500/20 bg-sky-500/8 p-3">
                <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-sky-200">
                  Full PDF Style
                </p>
                <p className="mt-1 text-[11px] leading-5 text-sky-100/80">
                  AI Enhance keeps the same resume input, improves wording, and can
                  restyle the full exported PDF through template, font, size, and accent
                  updates.
                </p>
              </div>

              <div>
                <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600">
                  Template
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {TEMPLATES.map((template) => (
                    <button
                      key={template.id}
                      onClick={() => setMetadata({ template: template.id })}
                      className={`rounded-lg border px-2 py-2 text-left text-[10px] font-semibold transition ${
                        metadata.template === template.id
                          ? 'border-indigo-500/30 bg-indigo-500/20 text-indigo-300'
                          : 'border-transparent text-slate-400 hover:bg-white/[0.04] hover:text-slate-200'
                      }`}
                    >
                      <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-slate-500">
                        {template.emoji}
                      </div>
                      <div className="mt-1">{template.label}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-2 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600">
                  Accent
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ACCENT_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setMetadata({ accentColor: color })}
                      className={`h-5 w-5 rounded-full transition-transform hover:scale-125 ${
                        metadata.accentColor === color
                          ? 'scale-110 ring-2 ring-white ring-offset-1 ring-offset-[#0c0c14]'
                          : ''
                      }`}
                      style={{ background: color }}
                    />
                  ))}
                </div>
              </div>

              <div>
                <p className="mb-1.5 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600">
                  Font
                </p>
                <select
                  value={metadata.fontFamily}
                  onChange={(event) => setMetadata({ fontFamily: event.target.value })}
                  className={`${selectClassName} !py-1.5 !text-[11px]`}
                  style={{ fontFamily: `'${metadata.fontFamily}', sans-serif` }}
                >
                  {FONTS.map((font) => (
                    <option
                      key={font}
                      value={font}
                      className="bg-slate-900 text-white"
                      style={{ fontFamily: `'${font}', sans-serif` }}
                    >
                      {font}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <p className="mb-1 text-[9px] font-bold uppercase tracking-[0.15em] text-slate-600">
                  Size <span className="text-indigo-400">{metadata.fontSize}pt</span>
                </p>
                <input
                  type="range"
                  min="8"
                  max="13"
                  step="0.5"
                  value={metadata.fontSize}
                  onChange={(event) => setMetadata({ fontSize: Number(event.target.value) })}
                  className="h-1 w-full accent-indigo-500"
                />
              </div>
            </div>
          )}
        </aside>

        <section
          className="w-[390px] shrink-0 overflow-y-auto border-r border-white/[0.06] bg-[#0d0d15] p-5"
          style={{ scrollbarWidth: 'thin' }}
        >
          <div className="mb-5 flex items-center gap-2">
            <span className="text-indigo-400">{ICONS[active]}</span>
            <h2 className="text-base font-bold text-white">{sectionLabels[active]}</h2>
          </div>
          {renderEditor()}
        </section>

        <section
          className="flex-1 overflow-y-auto bg-[#12121c]"
          style={{ scrollbarWidth: 'thin' }}
        >
          <div className="flex min-h-full items-start justify-center px-6 py-8">
            <div
              className="rounded ring-1 ring-white/[0.05]"
              style={{
                transform: 'scale(0.55)',
                transformOrigin: 'top center',
                boxShadow: '0 8px 60px rgba(0, 0, 0, 0.6)',
              }}
            >
              {renderPreview()}
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
