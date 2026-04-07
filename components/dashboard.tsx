"use client";

import { useState } from "react";
import { JobListing, MatchedJob, ResumeAnalysis, ResumeUploadResponse } from "@/types";

type Status = {
  loading: boolean;
  error: string;
};

export function Dashboard() {
  const [file, setFile] = useState<File | null>(null);
  const [uploadData, setUploadData] = useState<ResumeUploadResponse | null>(null);
  const [analysis, setAnalysis] = useState<ResumeAnalysis | null>(null);
  const [jobs, setJobs] = useState<JobListing[]>([]);
  const [matches, setMatches] = useState<MatchedJob[]>([]);
  const [status, setStatus] = useState<Status>({ loading: false, error: "" });

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!file) {
      setStatus({ loading: false, error: "Please choose a PDF or DOCX file." });
      return;
    }

    setStatus({ loading: true, error: "" });
    setUploadData(null);
    setAnalysis(null);
    setJobs([]);
    setMatches([]);

    try {
      const formData = new FormData();
      formData.append("resume", file);

      const uploadResponse = await fetch("/api/resumes/upload", {
        method: "POST",
        body: formData
      });

      if (!uploadResponse.ok) {
        const error = await uploadResponse.json();
        throw new Error(error.error ?? "Upload failed.");
      }

      const uploaded: ResumeUploadResponse = await uploadResponse.json();
      setUploadData(uploaded);

      const analysisResponse = await fetch("/api/resumes/analyze", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          resumeId: uploaded.resumeId,
          text: uploaded.text
        })
      });

      if (!analysisResponse.ok) {
        const error = await analysisResponse.json();
        throw new Error(error.error ?? "Resume analysis failed.");
      }

      const analyzed: ResumeAnalysis = await analysisResponse.json();
      setAnalysis(analyzed);

      const jobsResponse = await fetch(`/api/jobs?skills=${encodeURIComponent(analyzed.skills.join(","))}`);

      if (!jobsResponse.ok) {
        const error = await jobsResponse.json();
        throw new Error(error.error ?? "Job fetching failed.");
      }

      const fetchedJobs: JobListing[] = await jobsResponse.json();
      setJobs(fetchedJobs);

      const matchResponse = await fetch("/api/match", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          resumeId: uploaded.resumeId,
          resumeSkills: analyzed.skills,
          jobs: fetchedJobs
        })
      });

      if (!matchResponse.ok) {
        const error = await matchResponse.json();
        throw new Error(error.error ?? "Matching failed.");
      }

      const matched: MatchedJob[] = await matchResponse.json();
      setMatches(matched);
      setStatus({ loading: false, error: "" });
    } catch (error) {
      setStatus({
        loading: false,
        error: error instanceof Error ? error.message : "Something went wrong."
      });
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <section className="mb-8 rounded-[2rem] bg-ink px-8 py-12 text-white shadow-card">
        <p className="mb-4 inline-flex rounded-full border border-white/20 px-4 py-2 text-sm text-slate-200">
          MVP: Resume upload + AI analysis + job matching
        </p>
        <h1 className="max-w-3xl text-4xl font-black tracking-tight sm:text-5xl">
          WillAIGetHired helps users understand whether their resume is ready for the jobs they want.
        </h1>
        <p className="mt-4 max-w-2xl text-lg text-slate-300">
          Upload a resume, extract the text, score it with AI, fetch live jobs, and show match percentages in one flow.
        </p>
      </section>

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="card">
          <h2 className="text-2xl font-bold">1. Upload Resume</h2>
          <p className="mt-2 text-sm text-slate-600">Supported file types: PDF and DOCX.</p>

          <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
            <input
              className="field"
              type="file"
              accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
              onChange={(event) => setFile(event.target.files?.[0] ?? null)}
            />

            <button className="button-primary w-full" disabled={status.loading} type="submit">
              {status.loading ? "Processing..." : "Upload and Analyze"}
            </button>
          </form>

          {status.error ? <p className="mt-4 rounded-2xl bg-red-50 p-4 text-sm text-red-600">{status.error}</p> : null}

          {uploadData ? (
            <div className="mt-6 rounded-2xl bg-sky p-4 text-sm text-slate-700">
              <p className="font-semibold">Uploaded:</p>
              <p>{uploadData.fileName}</p>
            </div>
          ) : null}
        </div>

        <div className="card">
          <h2 className="text-2xl font-bold">2. Resume Analysis</h2>

          {analysis ? (
            <div className="mt-5 space-y-4 text-sm text-slate-700">
              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Summary</p>
                <p className="mt-2">{analysis.summary}</p>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Experience Level</p>
                  <p className="mt-2">{analysis.experienceLevel}</p>
                </div>
                <div className="rounded-2xl bg-slate-50 p-4">
                  <p className="font-semibold text-slate-900">Resume Score</p>
                  <p className="mt-2 text-2xl font-bold">{analysis.resumeScore}/100</p>
                </div>
              </div>

              <div className="rounded-2xl bg-slate-50 p-4">
                <p className="font-semibold text-slate-900">Skills</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {analysis.skills.map((skill) => (
                    <span className="rounded-full bg-white px-3 py-1" key={skill}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-orange-50 p-4">
                <p className="font-semibold text-slate-900">Missing Skills</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {analysis.missingSkills.map((skill) => (
                    <span className="rounded-full bg-white px-3 py-1" key={skill}>
                      {skill}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-5 text-sm text-slate-500">Your AI analysis will appear here after upload.</p>
          )}
        </div>
      </section>

      <section className="mt-6 card">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold">3. Job Recommendations</h2>
            <p className="mt-2 text-sm text-slate-600">Jobs are fetched from Adzuna and ranked against resume skills.</p>
          </div>
          <div className="rounded-2xl bg-slate-100 px-4 py-2 text-sm text-slate-700">{jobs.length} jobs loaded</div>
        </div>

        {matches.length ? (
          <div className="mt-6 grid gap-4">
            {matches.map((job) => (
              <article className="rounded-3xl border border-slate-200 bg-white p-5" key={job.adzunaId}>
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h3 className="text-xl font-bold">{job.title}</h3>
                    <p className="mt-1 text-sm text-slate-500">
                      {job.company} {" • "} {job.location}
                    </p>
                  </div>

                  <div className="rounded-2xl bg-brand px-4 py-2 text-sm font-semibold text-white">
                    Match: {job.matchPercentage}%
                  </div>
                </div>

                <p className="mt-4 text-sm text-slate-700">{job.description}</p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {job.skills.map((skill) => (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-sm" key={skill}>
                      {skill}
                    </span>
                  ))}
                </div>

                {job.missingSkills.length ? (
                  <p className="mt-4 text-sm text-orange-600">Missing skills: {job.missingSkills.join(", ")}</p>
                ) : (
                  <p className="mt-4 text-sm text-emerald-600">Strong alignment with the detected job skills.</p>
                )}

                <a
                  className="button-secondary mt-4"
                  href={job.applyUrl}
                  rel="noreferrer"
                  target="_blank"
                >
                  View Job
                </a>
              </article>
            ))}
          </div>
        ) : (
          <p className="mt-6 text-sm text-slate-500">Recommended jobs will appear here after the AI analysis finishes.</p>
        )}
      </section>
    </main>
  );
}
