create extension if not exists "pgcrypto";

create table if not exists resumes (
  id uuid primary key default gen_random_uuid(),
  file_name text not null,
  storage_path text not null,
  raw_text text not null,
  extracted_skills text[] default '{}',
  created_at timestamptz not null default now()
);

create table if not exists resume_analyses (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references resumes(id) on delete cascade,
  summary text not null,
  skills text[] not null default '{}',
  experience_level text not null,
  missing_skills text[] not null default '{}',
  resume_score integer not null check (resume_score >= 0 and resume_score <= 100),
  created_at timestamptz not null default now()
);

create table if not exists job_matches (
  id uuid primary key default gen_random_uuid(),
  resume_id uuid not null references resumes(id) on delete cascade,
  adzuna_id text not null,
  title text not null,
  company text not null,
  location text not null,
  description text not null,
  apply_url text not null,
  required_skills text[] not null default '{}',
  missing_skills text[] not null default '{}',
  match_percentage integer not null check (match_percentage >= 0 and match_percentage <= 100),
  created_at timestamptz not null default now()
);
