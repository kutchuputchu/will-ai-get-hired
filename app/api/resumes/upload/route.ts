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
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ""
    ];
    const lowerFileName = file.name.toLowerCase();
    const hasValidExtension = lowerFileName.endsWith(".pdf") || lowerFileName.endsWith(".docx");

    if (!validTypes.includes(file.type) || !hasValidExtension) {
      return NextResponse.json({ error: "Only PDF and DOCX files are allowed." }, { status: 400 });
    }

    let extractedText = "";

    try {
      extractedText = await extractResumeText(file);
    } catch (error) {
      return NextResponse.json(
        {
          error: `Resume text extraction failed: ${error instanceof Error ? error.message : "Unknown parser error."}`
        },
        { status: 422 }
      );
    }

    if (!extractedText) {
      return NextResponse.json({ error: "Could not extract text from the resume." }, { status: 422 });
    }

    const supabase = getSupabaseAdmin();
    const filePath = `${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    const bucketName = process.env.SUPABASE_BUCKET ?? "resumes";
    const { error: uploadError } = await supabase.storage
      .from(bucketName)
      .upload(filePath, fileBuffer, {
        contentType: file.type || (lowerFileName.endsWith(".pdf") ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"),
        upsert: false
      });

    if (uploadError) {
      return NextResponse.json(
        {
          error: `Supabase storage upload failed for bucket "${bucketName}": ${uploadError.message}`
        },
        { status: 500 }
      );
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
      return NextResponse.json(
        {
          error: `Database insert failed for table "resumes": ${
            insertError?.message ?? "Failed to save resume metadata."
          }`
        },
        { status: 500 }
      );
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
        error: `Unexpected upload error: ${error instanceof Error ? error.message : "Unknown error."}`
      },
      { status: 500 }
    );
  }
}
