import { NextResponse } from "next/server";
import { analyzeResumeWithAI } from "@/lib/ai";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const resumeId = body.resumeId as string | undefined;
    const text = body.text as string | undefined;

    if (!resumeId || !text) {
      return NextResponse.json({ error: "resumeId and text are required." }, { status: 400 });
    }

    const analysis = await analyzeResumeWithAI(text);
    const supabase = getSupabaseAdmin();

    const { error: updateError } = await supabase
      .from("resumes")
      .update({ extracted_skills: analysis.skills })
      .eq("id", resumeId);

    if (updateError) {
      throw updateError;
    }

    const { error: insertError } = await supabase.from("resume_analyses").insert({
      resume_id: resumeId,
      summary: analysis.summary,
      skills: analysis.skills,
      experience_level: analysis.experienceLevel,
      missing_skills: analysis.missingSkills,
      resume_score: analysis.resumeScore
    });

    if (insertError) {
      throw insertError;
    }

    return NextResponse.json(analysis);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected analysis error."
      },
      { status: 500 }
    );
  }
}
