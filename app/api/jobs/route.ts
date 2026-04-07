import { NextResponse } from "next/server";
import { fetchJobsBySkills } from "@/lib/adzuna";

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const skillsParam = searchParams.get("skills");

    if (!skillsParam) {
      return NextResponse.json({ error: "skills query parameter is required." }, { status: 400 });
    }

    const skills = skillsParam
      .split(",")
      .map((skill) => skill.trim())
      .filter(Boolean);

    if (!skills.length) {
      return NextResponse.json({ error: "At least one skill is required." }, { status: 400 });
    }

    const jobs = await fetchJobsBySkills(skills);
    return NextResponse.json(jobs);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected job fetch error."
      },
      { status: 500 }
    );
  }
}
