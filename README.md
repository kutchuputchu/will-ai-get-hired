# WillAIGetHired MVP

This starter gives you a working MVP structure for:

- resume upload
- PDF/DOCX text extraction
- AI resume analysis
- Adzuna job fetching
- skill-based matching
- a basic dashboard UI

## 1. Install packages

```bash
npm install
```

## 2. Create `.env.local`

Copy `.env.example` to `.env.local` and fill in the values.

## 3. Create Supabase tables

Run the SQL in `supabase/schema.sql` inside the Supabase SQL editor.

Also create a storage bucket named `resumes`.

## 4. Start the app

```bash
npm run dev
```

## 5. MVP flow

1. Upload a PDF or DOCX resume
2. Text is extracted server-side
3. File is stored in Supabase Storage
4. Resume text is analyzed by Claude
5. Jobs are fetched from Adzuna using the detected skills
6. The app calculates a match percentage for each job
