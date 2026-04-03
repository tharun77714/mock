export type ResumeSectionId =
  | "basics"
  | "summary"
  | "experience"
  | "education"
  | "skills"
  | "projects";

export interface ResumeBasics {
  fullName: string;
  headline: string;
  email: string;
  phone: string;
  location: string;
  website: string;
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
  startDate: string;
  endDate: string;
}

export interface ProjectItem {
  id: string;
  name: string;
  link: string;
  highlights: string[];
}

export interface ResumeDocument {
  basics: ResumeBasics;
  summary: string;
  experience: ExperienceItem[];
  education: EducationItem[];
  skills: string[];
  projects: ProjectItem[];
}

export const sectionOrder: ResumeSectionId[] = [
  "basics",
  "summary",
  "experience",
  "education",
  "skills",
  "projects",
];

export const defaultResume: ResumeDocument = {
  basics: {
    fullName: "",
    headline: "",
    email: "",
    phone: "",
    location: "",
    website: "",
  },
  summary: "",
  experience: [],
  education: [],
  skills: [],
  projects: [],
};
