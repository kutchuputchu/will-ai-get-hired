import mammoth from "mammoth";
import pdfParse from "pdf-parse";

export async function extractResumeText(file: File) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const fileName = file.name.toLowerCase();

  if (fileName.endsWith(".pdf")) {
    const pdf = await pdfParse(buffer);
    return cleanText(pdf.text);
  }

  if (fileName.endsWith(".docx")) {
    const result = await mammoth.extractRawText({ buffer });
    return cleanText(result.value);
  }

  throw new Error("Only PDF and DOCX files are supported.");
}

function cleanText(text: string) {
  return text.replace(/\s+/g, " ").trim();
}
