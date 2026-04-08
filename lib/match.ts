import { JobListing, MatchedJob } from "@/types";

export function matchJobs(
  resumeSkills: string[],
  jobs: JobListing[],
  suggestedRoles: string[] = []
): MatchedJob[] {
  const normalizedResumeSkills = resumeSkills.map(normalize);
  const normalizedRoles = suggestedRoles.map(normalize);

  return jobs
    .map((job) => {
      const requiredSkills = job.skills.map(normalize);

      const matchedSkills = requiredSkills.filter((skill) =>
        normalizedResumeSkills.includes(skill)
      );

      const missingSkills = requiredSkills.filter(
        (skill) => !normalizedResumeSkills.includes(skill)
      );

      const matchedCount = matchedSkills.length;
      const total = requiredSkills.length || 1;

      const haystack = `${job.title} ${job.description}`.toLowerCase();

      const roleBonus = normalizedRoles.some((role) =>
        haystack.includes(role)
      )
        ? 20
        : 0;

      const baseScore = Math.round((matchedCount / total) * 100);

      return {
        ...job,
        matchPercentage: Math.min(100, Math.max(baseScore, baseScore + roleBonus)),
        matchedSkills,
        missingSkills,
        strengths: [],
        gaps: [],
        explanation: ""
      };
    })
    .sort((a, b) => b.matchPercentage - a.matchPercentage);
}

function normalize(value: string) {
  return value.trim().toLowerCase();
}