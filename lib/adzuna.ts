import { JobListing } from "@/types";

type AdzunaJob = {
  id: string;
  title: string;
  description: string;
  redirect_url: string;
  location?: { display_name?: string };
  company?: { display_name?: string };
  salary_min?: number;
  salary_max?: number;
};

type AdzunaResponse = {
  results?: AdzunaJob[];
};

export async function fetchJobsBySkills(skills: string[]) {
  const appId = process.env.ADZUNA_APP_ID;
  const appKey = process.env.ADZUNA_APP_KEY;
  const country = process.env.ADZUNA_COUNTRY ?? "gb";

  if (!appId || !appKey) {
    throw new Error("Adzuna credentials are missing.");
  }

  const query = encodeURIComponent(skills.slice(0, 5).join(" "));
  const url = `https://api.adzuna.com/v1/api/jobs/${country}/search/1?app_id=${appId}&app_key=${appKey}&results_per_page=10&what=${query}&content-type=application/json`;

  const response = await fetch(url, {
    method: "GET",
    next: { revalidate: 3600 }
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Adzuna request failed: ${errorText}`);
  }

  const data = (await response.json()) as AdzunaResponse;

  return (data.results ?? []).map(normalizeJob);
}

function normalizeJob(job: AdzunaJob): JobListing {
  const extractedSkills = extractSkillsFromJobText(`${job.title} ${job.description}`);

  return {
    adzunaId: job.id,
    title: job.title,
    company: job.company?.display_name ?? "Unknown company",
    location: job.location?.display_name ?? "Remote / Flexible",
    description: job.description,
    applyUrl: job.redirect_url,
    salaryMin: job.salary_min ?? null,
    salaryMax: job.salary_max ?? null,
    skills: extractedSkills
  };
}

function extractSkillsFromJobText(text: string) {
  const skillDictionary = [
    "javascript",
    "typescript",
    "react",
    "next.js",
    "node.js",
    "python",
    "sql",
    "postgresql",
    "aws",
    "docker",
    "tailwind",
    "supabase",
    "rest api",
    "graphql",
    "git"
  ];

  const lower = text.toLowerCase();
  return skillDictionary.filter((skill) => lower.includes(skill));
}
