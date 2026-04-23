import { NextResponse } from "next/server";
import type { ResumeDocument } from "@/lib/resume-builder-schema";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const SUPPORTED_TEMPLATES = ["classic", "modern", "minimal", "professional"] as const;
const SUPPORTED_FONTS = [
  "Inter",
  "Roboto",
  "Merriweather",
  "Lora",
  "Outfit",
  "Source Sans 3",
  "Playfair Display",
] as const;
const SUPPORTED_ACCENTS = [
  "#6366f1",
  "#8b5cf6",
  "#ec4899",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#22c55e",
  "#14b8a6",
  "#06b6d4",
  "#3b82f6",
  "#64748b",
  "#0f172a",
] as const;

type SupportedTemplate = (typeof SUPPORTED_TEMPLATES)[number];
type SupportedFont = (typeof SUPPORTED_FONTS)[number];

type EnhanceResponse = {
  summary?: string;
  experience?: { id: string; highlights: string[] }[];
  projects?: { id: string; highlights: string[] }[];
  skills?: string[];
  metadata?: {
    template?: SupportedTemplate;
    fontFamily?: SupportedFont;
    fontSize?: number;
    accentColor?: string;
  };
  designNotes?: string;
};

function clampFontSize(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(13, Math.max(8, Math.round(parsed * 2) / 2));
}

function normalizeMetadata(
  current: ResumeDocument["metadata"],
  proposed?: EnhanceResponse["metadata"]
) {
  const templateCandidate = proposed?.template;
  const fontCandidate = proposed?.fontFamily;
  const accentCandidate = proposed?.accentColor;

  const template: ResumeDocument["metadata"]["template"] =
    templateCandidate && SUPPORTED_TEMPLATES.includes(templateCandidate)
      ? templateCandidate
      : current.template;
  const fontFamily: ResumeDocument["metadata"]["fontFamily"] =
    fontCandidate && SUPPORTED_FONTS.includes(fontCandidate)
      ? fontCandidate
      : current.fontFamily;
  const accentColor: ResumeDocument["metadata"]["accentColor"] =
    accentCandidate &&
    SUPPORTED_ACCENTS.includes(
      accentCandidate as (typeof SUPPORTED_ACCENTS)[number]
    )
      ? accentCandidate
      : current.accentColor;

  return {
    ...current,
    template,
    fontFamily,
    accentColor,
    fontSize: clampFontSize(proposed?.fontSize, current.fontSize),
  };
}

function buildPrompt(resume: ResumeDocument) {
  return `
You are an expert resume writer.
Improve this resume content for clarity, impact, ATS-friendliness, and visual resume presentation.

Rules:
- Keep factual meaning intact.
- Keep dates and names unchanged.
- Improve grammar, tone, and action verbs.
- Keep concise bullet points.
- Keep the same overall resume content input; only improve phrasing and recommend better visual styling.
- Choose only from these templates: ${SUPPORTED_TEMPLATES.join(", ")}.
- Choose only from these fonts: ${SUPPORTED_FONTS.join(", ")}.
- Choose only from these accent colors: ${SUPPORTED_ACCENTS.join(", ")}.
- fontSize must stay between 8 and 13.
- Return strict JSON only.

Output JSON shape:
{
  "summary": "string",
  "experience": [{ "id": "string", "highlights": ["string"] }],
  "projects": [{ "id": "string", "highlights": ["string"] }],
  "skills": ["string"],
  "metadata": {
    "template": "classic | modern | minimal | professional",
    "fontFamily": "Inter | Roboto | Merriweather | Lora | Outfit | Source Sans 3 | Playfair Display",
    "fontSize": 10,
    "accentColor": "#6366f1"
  },
  "designNotes": "short explanation of the chosen layout and font style"
}

Input Resume JSON:
${JSON.stringify(resume)}
`;
}

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY?.trim();
    const model = process.env.GROQ_MODEL || "llama-3.3-70b-versatile";
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
        model,
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
      const errMsg =
        data?.error?.code === "invalid_api_key"
          ? "Groq rejected the configured API key. Update GROQ_API_KEY in web/.env.local and restart the Next.js server."
          : data?.error?.message || "Groq request failed";
      return NextResponse.json({ success: false, error: errMsg }, { status: 500 });
    }

    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({ success: false, error: "No content from Groq." }, { status: 500 });
    }

    const safeRaw = String(raw).trim().replace(/^```json\s*|\s*```$/g, "");
    const enhanced = JSON.parse(safeRaw) as EnhanceResponse;

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
      metadata: normalizeMetadata(resume.metadata, enhanced.metadata),
    };

    return NextResponse.json({
      success: true,
      resume: merged,
      designNotes: enhanced.designNotes || null,
    });
  } catch (error) {
    console.error("resume-enhance:", error);
    return NextResponse.json({ success: false, error: "Failed to enhance resume." }, { status: 500 });
  }
}
