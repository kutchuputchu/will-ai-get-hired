import { ResumeAnalysis } from "@/types";

type ClaudeResponse = {
  content?: Array<{ type: string; text?: string }>;
};

export async function analyzeResumeWithAI(resumeText: string): Promise<ResumeAnalysis> {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  if (!apiKey) {
    return buildMockAnalysis(resumeText);
  }

  const prompt = `
You are an expert recruiting assistant.
Analyze the resume text below and respond with valid JSON only.

Return this exact shape:
{
  "summary": "short summary",
  "skills": ["skill one", "skill two"],
  "experienceLevel": "Junior | Mid-level | Senior",
  "missingSkills": ["skill gap one", "skill gap two"],
  "resumeScore": 0
}

Rules:
- resumeScore must be an integer from 0 to 100.
- skills must be concise and deduplicated.
- missingSkills should mention high-value missing skills for common software jobs.
- Do not wrap JSON in markdown.

Resume:
${resumeText}
  `.trim();

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01"
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 800,
      messages: [{ role: "user", content: prompt }]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Claude request failed: ${errorText}`);
  }

  const data = (await response.json()) as ClaudeResponse;
  const text = data.content?.find((item) => item.type === "text")?.text;

  if (!text) {
    throw new Error("Claude returned an empty response.");
  }

  const parsed = safeJsonParse(text);

  return {
    summary: parsed.summary ?? "No summary generated.",
    skills: Array.isArray(parsed.skills) ? parsed.skills : [],
    experienceLevel: parsed.experienceLevel ?? "Mid-level",
    missingSkills: Array.isArray(parsed.missingSkills) ? parsed.missingSkills : [],
    resumeScore: Number.isFinite(parsed.resumeScore) ? parsed.resumeScore : 50
  };
}

function safeJsonParse(raw: string) {
  try {
    return JSON.parse(raw);
  } catch {
    const match = raw.match(/\{[\s\S]*\}/);

    if (!match) {
      throw new Error("Could not parse AI JSON response.");
    }

    return JSON.parse(match[0]);
  }
}

function buildMockAnalysis(resumeText: string): ResumeAnalysis {
  const lowerText = resumeText.toLowerCase();
  const knownSkills = [
    "javascript",
    "typescript",
    "react",
    "next.js",
    "node.js",
    "express",
    "python",
    "sql",
    "postgresql",
    "supabase",
    "tailwind",
    "docker",
    "aws",
    "git",
    "rest api",
    "graphql",
    "html",
    "css"
  ];

  const skills = knownSkills.filter((skill) => lowerText.includes(skill)).slice(0, 12);
  const recommendedSkills = ["typescript", "react", "next.js", "node.js", "sql", "docker", "aws"];
  const missingSkills = recommendedSkills.filter((skill) => !skills.includes(skill)).slice(0, 5);
  const yearsOfExperience = detectExperienceYears(lowerText);
  const experienceLevel =
    yearsOfExperience >= 6 ? "Senior" : yearsOfExperience >= 2 ? "Mid-level" : "Junior";
  const resumeScore = Math.min(
    95,
    45 +
      skills.length * 4 +
      (yearsOfExperience >= 2 ? 8 : 0) +
      (lowerText.includes("project") ? 6 : 0) +
      (lowerText.includes("achievement") || lowerText.includes("improved") ? 6 : 0)
  );

  return {
    summary: `Demo analysis: detected ${skills.length || 1} likely skill areas and estimated ${experienceLevel.toLowerCase()} experience based on the resume text.`,
    skills: skills.length ? skills : ["communication"],
    experienceLevel,
    missingSkills,
    resumeScore
  };
}

function detectExperienceYears(text: string) {
  const match = text.match(/(\d+)\+?\s+years?/);

  if (!match) {
    return 0;
  }

  return Number.parseInt(match[1], 10) || 0;
}
