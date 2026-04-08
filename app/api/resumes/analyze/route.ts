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

    let analysis;

    try {
      analysis = await analyzeResumeWithAI(text);
    } catch (error) {
      return NextResponse.json(
        {
          error: `AI analysis failed: ${error instanceof Error ? error.message : "Unknown AI error."}`
        },
        { status: 500 }
      );
    }

    const supabase = getSupabaseAdmin();

    const { error: updateError } = await supabase
      .from("resumes")
      .update({ extracted_skills: analysis.skills })
      .eq("id", resumeId);

    if (updateError) {
      return NextResponse.json(
        {
          error: `Database update failed for table "resumes": ${updateError.message}`
        },
        { status: 500 }
      );
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
      return NextResponse.json(
        {
          error: `Database insert failed for table "resume_analyses": ${insertError.message}`
        },
        { status: 500 }
      );
    }

    return NextResponse.json(analysis);
  } catch (error) {
    return NextResponse.json(
      {
        error: `Unexpected analysis error: ${error instanceof Error ? error.message : "Unknown error."}`
      },
      { status: 500 }
    );
  }
}
