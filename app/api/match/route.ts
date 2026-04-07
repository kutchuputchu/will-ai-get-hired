import { NextResponse } from "next/server";
import { matchJobs } from "@/lib/match";
import { getSupabaseAdmin } from "@/lib/supabase/server";
import { JobListing } from "@/types";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const resumeId = body.resumeId as string | undefined;
    const resumeSkills = body.resumeSkills as string[] | undefined;
    const jobs = body.jobs as JobListing[] | undefined;

    if (!resumeId || !Array.isArray(resumeSkills) || !Array.isArray(jobs)) {
      return NextResponse.json({ error: "resumeId, resumeSkills, and jobs are required." }, { status: 400 });
    }

    const matches = matchJobs(resumeSkills, jobs);
    const supabase = getSupabaseAdmin();

    const rows = matches.map((job) => ({
      resume_id: resumeId,
      adzuna_id: job.adzunaId,
      title: job.title,
      company: job.company,
      location: job.location,
      description: job.description,
      apply_url: job.applyUrl,
      required_skills: job.skills,
      missing_skills: job.missingSkills,
      match_percentage: job.matchPercentage
    }));

    const { error } = await supabase.from("job_matches").insert(rows);

    if (error) {
      throw error;
    }

    return NextResponse.json(matches);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected matching error."
      },
      { status: 500 }
    );
  }
}
