import { ResumeAnalysis, SuggestedRole } from "@/types";

type ClaudeResponse = {
  content?: Array<{ type: string; text?: string }>;
};

export async function analyzeResumeWithAI(resumeText: string): Promise<ResumeAnalysis> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  const groqApiKey = process.env.GROQ_API_KEY;

  if (apiKey) {
    return analyzeWithClaude(apiKey, resumeText);
  }

  if (groqApiKey) {
    return analyzeWithGroq(groqApiKey, resumeText);
  }

  if (!apiKey && !groqApiKey) {
    return buildMockAnalysis(resumeText);
  }

  return buildMockAnalysis(resumeText);
}

async function analyzeWithClaude(apiKey: string, resumeText: string): Promise<ResumeAnalysis> {
  const prompt = buildAnalysisPrompt(resumeText);
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
  return normalizeAnalysis(parsed, resumeText);
}

async function analyzeWithGroq(apiKey: string, resumeText: string): Promise<ResumeAnalysis> {
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-20b",
      temperature: 0.2,
      response_format: {
        type: "json_object"
      },
      messages: [
        {
          role: "system",
          content:
            "You are an expert recruiter and career analyst. Always return valid JSON only, with no markdown."
        },
        {
          role: "user",
          content: buildAnalysisPrompt(resumeText)
        }
      ]
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq request failed: ${errorText}`);
  }

  const data = (await response.json()) as {
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };
  const text = data.choices?.[0]?.message?.content;

  if (!text) {
    throw new Error("Groq returned an empty response.");
  }

  const parsed = safeJsonParse(text);
  return normalizeAnalysis(parsed, resumeText);
}

function buildAnalysisPrompt(resumeText: string) {
  const prompt = `
You are an expert career analyst, recruiter, and ATS evaluator.

You MUST analyze resumes across ANY domain using structured reasoning.

-----------------------
DOMAIN DETECTION RULES
-----------------------
Determine the domain using weighted signals:

HIGH weight:
- Education (degree, specialization)
- Job titles
- Certifications

MEDIUM weight:
- Tools and technologies
- Industry keywords

LOW weight:
- Generic skills (communication, teamwork)

IMPORTANT:
- If education and experience strongly align with a non-tech field (e.g. BPharma, Nursing), you MUST classify it as that domain
- DO NOT override domain based on a few tech keywords
- If multiple domains exist, choose the dominant one based on consistency

-----------------------
STEP 1: Detect Domain
-----------------------
- Identify 1 primary domain
- Provide a confidence score (0-100)
- Suggest 2-3 realistic roles ONLY within that domain

-----------------------
STEP 2: Extract Structured Data
-----------------------
- skills
- experience
- education
- tools
- soft skills

-----------------------
STEP 3: Evaluate Role Fit
-----------------------
For each role:
- role
- score (0-100)
- strengths
- weaknesses
- improvements

SCORING RULES:
- Evaluate relative to domain expectations
- DO NOT penalize non-tech resumes for lack of coding skills
- Be realistic and critical

-----------------------
OUTPUT FORMAT (STRICT JSON)
-----------------------
{
  "domain": "",
  "domain_confidence": 0,
  "suggested_roles": [
    {
      "role": "",
      "score": 0,
      "strengths": [],
      "weaknesses": [],
      "improvements": []
    }
  ],
  "extracted_information": {
    "skills": [],
    "experience": [],
    "education": [],
    "tools": [],
    "soft_skills": []
  }
}

Rules:
- Return valid JSON only.
- Do not wrap JSON in markdown.
- Keep arrays concise, specific, and deduplicated.

Resume:
${resumeText}
  `.trim();
  return prompt;
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
  const detected = detectDomainProfile(lowerText);
  const skills = detected.skills;
  const yearsOfExperience = detectExperienceYears(lowerText);
  const experienceLevel =
    yearsOfExperience >= 6 ? "Senior" : yearsOfExperience >= 2 ? "Mid-level" : "Junior";
  const suggestedRoles = detected.roles.map((role, index) => {
    const strengths = detected.strengths.slice(0, 3);
    const weaknesses = detected.gaps.slice(index, index + 2).length
      ? detected.gaps.slice(index, index + 2)
      : detected.gaps.slice(0, 2);
    const score = Math.max(
      48,
      Math.min(92, 56 + skills.length * 3 + (yearsOfExperience >= 2 ? 8 : 0) - weaknesses.length * 2 - index * 4)
    );

    return {
      role,
      score,
      strengths,
      weaknesses,
      improvements: detected.improvements.slice(0, 3)
    };
  });

  const experience = extractExperienceHighlights(lowerText, detected.domain);
  const education = extractEducationHighlights(lowerText);
  const tools = detected.tools;
  const softSkills = detected.softSkills;
  const missingSkills = Array.from(
    new Set(suggestedRoles.flatMap((role: SuggestedRole) => role.weaknesses).filter(Boolean))
  ).slice(0, 5);
  const resumeScore = suggestedRoles.length
    ? Math.round(suggestedRoles.reduce((total, role) => total + role.score, 0) / suggestedRoles.length)
    : 55;

  return {
    domain: detected.domain,
    suggestedRoles,
    experience,
    education,
    tools,
    softSkills,
    summary: `Detected ${detected.domain.toLowerCase()} resume signals with strongest fit for ${suggestedRoles.map((role) => role.role).slice(0, 2).join(" and ")}.`,
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

function normalizeAnalysis(parsed: any, resumeText: string): ResumeAnalysis {
  const fallback = buildMockAnalysis(resumeText);
  const extracted = parsed?.extracted_information ?? {};
  const suggestedRoles: SuggestedRole[] = Array.isArray(parsed?.suggested_roles)
    ? parsed.suggested_roles
        .map((role: any) => ({
          role: String(role?.role ?? "").trim(),
          score: toClampedScore(role?.score),
          strengths: normalizeStringArray(role?.strengths),
          weaknesses: normalizeStringArray(role?.weaknesses),
          improvements: normalizeStringArray(role?.improvements)
        }))
        .filter((role: SuggestedRole) => role.role)
    : fallback.suggestedRoles;

  const skills = normalizeStringArray(extracted.skills);
  const experience = normalizeStringArray(extracted.experience);
  const education = normalizeStringArray(extracted.education);
  const tools = normalizeStringArray(extracted.tools);
  const softSkills = normalizeStringArray(extracted.soft_skills);
  const missingSkills = Array.from(new Set(suggestedRoles.flatMap((role) => role.weaknesses))).slice(0, 6);
  const resumeScore = suggestedRoles.length
    ? Math.round(suggestedRoles.reduce((sum, role) => sum + role.score, 0) / suggestedRoles.length)
    : fallback.resumeScore;

  return {
    domain: typeof parsed?.domain === "string" && parsed.domain.trim() ? parsed.domain.trim() : fallback.domain,
    suggestedRoles: suggestedRoles.length ? suggestedRoles : fallback.suggestedRoles,
    experience: experience.length ? experience : fallback.experience,
    education: education.length ? education : fallback.education,
    tools: tools.length ? tools : fallback.tools,
    softSkills: softSkills.length ? softSkills : fallback.softSkills,
    summary:
      buildSummary(
        typeof parsed?.domain === "string" ? parsed.domain : fallback.domain,
        suggestedRoles.length ? suggestedRoles : fallback.suggestedRoles
      ) || fallback.summary,
    skills: skills.length ? skills : fallback.skills,
    experienceLevel: inferExperienceLevel(experience.length ? experience : fallback.experience, resumeText),
    missingSkills: missingSkills.length ? missingSkills : fallback.missingSkills,
    resumeScore
  };
}

function normalizeStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return Array.from(
    new Set(
      value
        .map((item) => (typeof item === "string" ? item.trim() : ""))
        .filter(Boolean)
    )
  );
}

function toClampedScore(value: unknown) {
  const score = Number(value);

  if (!Number.isFinite(score)) {
    return 50;
  }

  return Math.max(0, Math.min(100, Math.round(score)));
}

function buildSummary(domain: string, suggestedRoles: SuggestedRole[]) {
  if (!suggestedRoles.length) {
    return "";
  }

  const topRoles = suggestedRoles.slice(0, 2).map((role) => role.role).join(" and ");
  return `Best aligned with ${domain || "general"} roles, especially ${topRoles}.`;
}

function inferExperienceLevel(experience: string[], resumeText: string) {
  const years = detectExperienceYears(resumeText.toLowerCase());
  const count = experience.length;

  if (years >= 6 || count >= 4) {
    return "Senior";
  }

  if (years >= 2 || count >= 2) {
    return "Mid-level";
  }

  return "Junior";
}

function detectDomainProfile(text: string) {
  const profiles = [
    {
      domain: "Technology",
      keywords: ["javascript", "typescript", "react", "node", "python", "sql", "developer", "software", "api", "cloud"],
      skills: ["javascript", "typescript", "react", "node.js", "python", "sql", "git", "rest api"],
      tools: ["Git", "PostgreSQL", "Docker", "AWS"],
      softSkills: ["problem solving", "collaboration", "communication"],
      roles: ["Software Engineer", "Frontend Developer", "Full Stack Developer"],
      strengths: ["Technical stack alignment", "Hands-on product development", "Engineering problem solving"],
      gaps: ["Stronger quantified project impact", "Cloud or deployment depth", "Testing or system design evidence"],
      improvements: ["Add measurable project outcomes", "Highlight architecture or deployment ownership", "List testing and code quality practices"]
    },
    {
      domain: "Healthcare",
      keywords: ["patient", "clinical", "hospital", "nurse", "medical", "care", "ehr", "healthcare"],
      skills: ["patient care", "clinical documentation", "care coordination", "medical terminology", "compliance"],
      tools: ["EHR", "EMR", "Microsoft Office"],
      softSkills: ["empathy", "communication", "attention to detail"],
      roles: ["Clinical Coordinator", "Healthcare Administrator", "Patient Care Specialist"],
      strengths: ["Patient-facing experience", "Healthcare workflow exposure", "Documentation discipline"],
      gaps: ["More certifications or licenses", "Clearer patient volume metrics", "Specialty-specific experience"],
      improvements: ["Add patient or case-load metrics", "List certifications clearly", "Highlight compliance and safety outcomes"]
    },
    {
      domain: "Pharmaceuticals",
      keywords: ["pharma", "gmp", "qa", "qc", "regulatory", "validation", "formulation", "laboratory"],
      skills: ["gmp", "quality assurance", "quality control", "documentation", "regulatory compliance", "validation"],
      tools: ["HPLC", "LIMS", "Excel", "SAP"],
      softSkills: ["accuracy", "documentation", "cross-functional communication"],
      roles: ["QA Executive", "QC Analyst", "Regulatory Affairs Associate"],
      strengths: ["Quality and compliance awareness", "Documentation rigor", "Laboratory or manufacturing exposure"],
      gaps: ["More instrument-specific depth", "Stronger audit outcomes", "Clearer regulatory ownership"],
      improvements: ["Add GMP or audit examples", "Quantify batch, sample, or validation volume", "Highlight instrument and SOP expertise"]
    },
    {
      domain: "Customer Support",
      keywords: ["customer", "support", "ticket", "crm", "escalation", "call center", "client", "helpdesk"],
      skills: ["customer support", "ticket handling", "issue resolution", "crm", "communication", "service recovery"],
      tools: ["Zendesk", "Freshdesk", "Salesforce", "Intercom"],
      softSkills: ["active listening", "empathy", "conflict resolution"],
      roles: ["Customer Support Specialist", "Customer Success Associate", "Helpdesk Executive"],
      strengths: ["Customer communication", "Issue ownership", "Service responsiveness"],
      gaps: ["More resolution metrics", "Product expertise detail", "Escalation or retention impact"],
      improvements: ["Add CSAT or ticket metrics", "Highlight retention or SLA outcomes", "Show product or process expertise"]
    },
    {
      domain: "Business Operations",
      keywords: ["operations", "business", "sales", "analysis", "reporting", "excel", "stakeholder", "process"],
      skills: ["operations", "reporting", "analysis", "stakeholder management", "process improvement", "excel"],
      tools: ["Excel", "Power BI", "CRM", "Google Workspace"],
      softSkills: ["organization", "communication", "problem solving"],
      roles: ["Business Analyst", "Operations Executive", "Sales Operations Associate"],
      strengths: ["Business process awareness", "Reporting capability", "Cross-team coordination"],
      gaps: ["Stronger metrics and business outcomes", "Advanced analytics tooling", "Ownership of initiatives"],
      improvements: ["Add business impact metrics", "Highlight dashboards or reporting automation", "Show process improvement outcomes"]
    }
  ];

  const scoredProfiles = profiles.map((profile) => ({
    ...profile,
    score: profile.keywords.reduce((total, keyword) => total + (text.includes(keyword) ? 1 : 0), 0)
  }));
  const best = scoredProfiles.sort((a, b) => b.score - a.score)[0];

  if (!best || best.score === 0) {
    return {
      domain: "General Professional",
      skills: ["communication", "teamwork", "organization"],
      tools: ["Microsoft Office"],
      softSkills: ["communication", "adaptability", "teamwork"],
      roles: ["Operations Associate", "Administrative Executive", "Customer Support Associate"],
      strengths: ["Transferable professional experience", "General workplace readiness", "Adaptability"],
      gaps: ["Role-specific specialization", "Stronger quantified outcomes", "Clearer domain positioning"],
      improvements: ["Tailor the resume to one target role", "Add measurable achievements", "Clarify responsibilities and outcomes"]
    };
  }

  return {
    domain: best.domain,
    skills: best.skills.filter((skill) => text.includes(skill.toLowerCase()) || best.score > 0).slice(0, 10),
    tools: best.tools.filter((tool) => text.includes(tool.toLowerCase()) || tool === "Microsoft Office").slice(0, 6),
    softSkills: best.softSkills,
    roles: best.roles,
    strengths: best.strengths,
    gaps: best.gaps,
    improvements: best.improvements
  };
}

function extractExperienceHighlights(text: string, domain: string) {
  const highlights: string[] = [];

  if (text.includes("intern")) highlights.push("Internship experience");
  if (text.includes("manager")) highlights.push("Team or process management exposure");
  if (text.includes("analyst")) highlights.push("Analyst-style responsibilities");
  if (text.includes("project")) highlights.push("Project-based delivery experience");
  if (text.includes("customer")) highlights.push("Customer-facing experience");
  if (text.includes("clinical")) highlights.push("Clinical environment experience");
  if (text.includes("quality")) highlights.push("Quality or compliance-related work");

  return highlights.length ? highlights.slice(0, 4) : [`Relevant ${domain.toLowerCase()} experience detected`];
}

function extractEducationHighlights(text: string) {
  const educationTerms = ["bachelor", "master", "mba", "pharm", "b.sc", "m.sc", "degree", "university", "college"];
  const matches = educationTerms.filter((term) => text.includes(term));

  return matches.length ? Array.from(new Set(matches)).slice(0, 4) : ["Education details present in resume"];
}
