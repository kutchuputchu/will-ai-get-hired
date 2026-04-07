export type ResumeUploadResponse = {
  resumeId: string;
  fileName: string;
  text: string;
  storagePath: string;
};

export type ResumeAnalysis = {
  summary: string;
  skills: string[];
  experienceLevel: string;
  missingSkills: string[];
  resumeScore: number;
};

export type JobListing = {
  adzunaId: string;
  title: string;
  company: string;
  location: string;
  description: string;
  applyUrl: string;
  salaryMin: number | null;
  salaryMax: number | null;
  skills: string[];
};

export type MatchedJob = JobListing & {
  matchPercentage: number;
  missingSkills: string[];
};
