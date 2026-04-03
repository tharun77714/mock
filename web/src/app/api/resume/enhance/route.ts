import { NextResponse } from "next/server";
import type { ResumeDocument } from "@/lib/resume-builder-schema";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

function buildPrompt(resume: ResumeDocument) {
  return `
You are an expert resume writer.
Improve this resume content for clarity, impact, and ATS-friendliness.

Rules:
- Keep factual meaning intact.
- Keep dates and names unchanged.
- Improve grammar, tone, and action verbs.
- Keep concise bullet points.
- Return strict JSON only.

Output JSON shape:
{
  "summary": "string",
  "experience": [{ "id": "string", "highlights": ["string"] }],
  "projects": [{ "id": "string", "highlights": ["string"] }],
  "skills": ["string"]
}

Input Resume JSON:
${JSON.stringify(resume)}
`;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "Missing GROQ_API_KEY in environment." },
        { status: 500 }
      );
    }

    const body = await req.json();
    const resume = body?.resume as ResumeDocument | undefined;
    if (!resume) {
      return NextResponse.json({ success: false, error: "Resume payload is required." }, { status: 400 });
    }

    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.3,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content: "You return only valid JSON, no markdown, no extra text.",
          },
          {
            role: "user",
            content: buildPrompt(resume),
          },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      const errMsg = data?.error?.message || "Groq request failed";
      return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
    }

    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({ success: false, error: "No content from Groq." }, { status: 500 });
    }

    const enhanced = JSON.parse(raw) as {
      summary?: string;
      experience?: { id: string; highlights: string[] }[];
      projects?: { id: string; highlights: string[] }[];
      skills?: string[];
    };

    const merged: ResumeDocument = {
      ...resume,
      summary: enhanced.summary ?? resume.summary,
      skills: Array.isArray(enhanced.skills) && enhanced.skills.length ? enhanced.skills : resume.skills,
      experience: resume.experience.map((item) => {
        const match = enhanced.experience?.find((e) => e.id === item.id);
        return match?.highlights?.length ? { ...item, highlights: match.highlights } : item;
      }),
      projects: resume.projects.map((item) => {
        const match = enhanced.projects?.find((p) => p.id === item.id);
        return match?.highlights?.length ? { ...item, highlights: match.highlights } : item;
      }),
    };

    return NextResponse.json({ success: true, resume: merged });
  } catch (error) {
    console.error("resume-enhance:", error);
    return NextResponse.json({ success: false, error: "Failed to enhance resume." }, { status: 500 });
  }
}
