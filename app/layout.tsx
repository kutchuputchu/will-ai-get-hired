import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "WillAIGetHired",
  description: "Upload your resume, analyze it with AI, and discover matching jobs."
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
