import { JobListing, MatchedJob } from "@/types";

export function matchJobs(resumeSkills: string[], jobs: JobListing[]): MatchedJob[] {
  const normalizedResumeSkills = resumeSkills.map(normalize);

  return jobs
    .map((job) => {
      const requiredSkills = job.skills.map(normalize);
      const matchedCount = requiredSkills.filter((skill) => normalizedResumeSkills.includes(skill)).length;
      const total = requiredSkills.length || 1;
      const missingSkills = requiredSkills.filter((skill) => !normalizedResumeSkills.includes(skill));

      return {
        ...job,
        matchPercentage: Math.round((matchedCount / total) * 100),
        missingSkills
      };
    })
    .sort((a, b) => b.matchPercentage - a.matchPercentage);
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}
