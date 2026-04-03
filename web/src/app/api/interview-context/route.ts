import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { jobRole, companyName, resumeText } = await req.json();
    if (!jobRole || typeof jobRole !== "string" || !jobRole.trim()) {
      return NextResponse.json({ error: "Job role is required" }, { status: 400 });
    }

    const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:8000";
    const response = await fetch(`${PYTHON_API_URL}/generate-interview-context`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jobRole: jobRole.trim(),
        companyName: typeof companyName === "string" ? companyName : "",
        resumeText: typeof resumeText === "string" ? resumeText : "",
      }),
    });

    const text = await response.text();
    if (!response.ok) {
      let message = "Failed to generate interview context";
      try {
        const body = JSON.parse(text) as { detail?: string };
        if (typeof body.detail === "string") message = body.detail;
      } catch {
        if (text?.trim()) message = text.trim().slice(0, 2000);
      }
      return NextResponse.json({ success: false, error: message }, { status: response.status });
    }

    return NextResponse.json(JSON.parse(text));
  } catch (err) {
    console.error("interview-context proxy:", err);
    const base = process.env.PYTHON_API_URL || "http://localhost:8000";
    return NextResponse.json(
      {
        success: false,
        error: `Could not reach Python API at ${base}. Start uvicorn on port 8000.`,
      },
      { status: 503 }
    );
  }
}
