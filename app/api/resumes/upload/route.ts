import { NextResponse } from "next/server";
import { extractResumeText } from "@/lib/resume-parser";
import { getSupabaseAdmin } from "@/lib/supabase/server";

export async function POST(request: Request) {
  try {
    const formData = await request.formData();
    const file = formData.get("resume");

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Resume file is required." }, { status: 400 });
    }

    const validTypes = [
      "application/pdf",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ];

    if (!validTypes.includes(file.type)) {
      return NextResponse.json({ error: "Only PDF and DOCX files are allowed." }, { status: 400 });
    }

    const extractedText = await extractResumeText(file);

    if (!extractedText) {
      return NextResponse.json({ error: "Could not extract text from the resume." }, { status: 422 });
    }

    const supabase = getSupabaseAdmin();
    const filePath = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const { error: uploadError } = await supabase.storage
      .from(process.env.SUPABASE_BUCKET ?? "resumes")
      .upload(filePath, fileBuffer, {
        contentType: file.type,
        upsert: false
      });

    if (uploadError) {
      throw uploadError;
    }

    const { data: resumeRow, error: insertError } = await supabase
      .from("resumes")
      .insert({
        file_name: file.name,
        storage_path: filePath,
        raw_text: extractedText
      })
      .select("id")
      .single();

    if (insertError || !resumeRow) {
      throw insertError ?? new Error("Failed to save resume metadata.");
    }

    return NextResponse.json({
      resumeId: resumeRow.id,
      fileName: file.name,
      text: extractedText,
      storagePath: filePath
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unexpected upload error."
      },
      { status: 500 }
    );
  }
}
