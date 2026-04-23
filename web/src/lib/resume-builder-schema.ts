// ─── Resume Builder Schema (Reactive Resume Style) ────────────────────────

export type ResumeSectionId =
  | 'basics'
  | 'summary'
  | 'experience'
  | 'education'
  | 'skills'
  | 'projects'
  | 'certifications'
  | 'languages'
  | 'awards'
  | 'profiles';

export interface ResumeBasics {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  website: string;
}

export interface ProfileItem {
  id: string;
  network: string; // e.g. "GitHub", "LinkedIn"
  username: string;
  url: string;
}

export interface ExperienceItem {
  id: string;
  company: string;
  role: string;
  startDate: string;
  endDate: string;
  highlights: string[];
}

export interface EducationItem {
  id: string;
  institution: string;
  degree: string;
  field: string;
  startDate: string;
  endDate: string;
  gpa: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  link: string;
  description: string;
  highlights: string[];
}

export interface CertificationItem {
  id: string;
  name: string;
  issuer: string;
  date: string;
  url: string;
}

export interface LanguageItem {
  id: string;
  name: string;
  fluency: string; // e.g. "Native", "Fluent", "Intermediate"
}

export interface AwardItem {
  id: string;
  title: string;
  awarder: string;
  date: string;
  summary: string;
}

export interface ResumeMetadata {
  template: 'classic' | 'modern' | 'minimal' | 'professional';
  accentColor: string;
  fontFamily: string;
  fontSize: number; // base font size in pt
}

export interface ResumeDocument {
  basics: ResumeBasics;
  summary: string;
  profiles: ProfileItem[];
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: string[];
  projects: ProjectItem[];
  certifications: CertificationItem[];
  languages: LanguageItem[];
  awards: AwardItem[];
  metadata: ResumeMetadata;
}

export const sectionOrder: ResumeSectionId[] = [
  'basics',
  'summary',
  'profiles',
  'experience',
  'education',
  'skills',
  'projects',
  'certifications',
  'languages',
  'awards',
];

export const sectionLabels: Record<ResumeSectionId, string> = {
  basics: 'Personal Info',
  summary: 'Summary',
  profiles: 'Social Profiles',
  experience: 'Experience',
  education: 'Education',
  skills: 'Skills',
  projects: 'Projects',
  certifications: 'Certifications',
  languages: 'Languages',
  awards: 'Awards',
};

export const defaultResume: ResumeDocument = {
  basics: {
    fullName: '',
    headline: '',
    email: '',
    phone: '',
    location: '',
    website: '',
  },
  summary: '',
  profiles: [],
  experience: [],
  education: [],
  skills: [],
  projects: [],
  certifications: [],
  languages: [],
  awards: [],
  metadata: {
    template: 'modern',
    accentColor: '#6366f1',
    fontFamily: 'Inter',
    fontSize: 10,
  },
};
