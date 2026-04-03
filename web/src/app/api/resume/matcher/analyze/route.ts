import { NextResponse } from "next/server";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

type AnalysisResult = {
  atsScore: number;
  jobs: string[];
};

export async function POST(req: Request) {
  try {
    const { resumeText } = await req.json();
    if (!resumeText || typeof resumeText !== "string") {
      return NextResponse.json({ success: false, error: "resumeText is required." }, { status: 400 });
    }

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { success: false, error: "GROQ_API_KEY missing. Real ATS analysis requires Groq API." },
        { status: 500 }
      );
    }

    const prompt = `
Analyze this resume for ATS readiness without any job description.
Return ONLY strict JSON with this shape:
{
  "atsScore": number,
  "jobs": string[]
}

Rules:
- atsScore must be 0-100
- jobs should be realistic roles this candidate can target now (max 8)
- no explanation text

Resume:
${resumeText.slice(0, 12000)}
`;

    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.2,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return only valid JSON." },
          { role: "user", content: prompt },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json(
        { success: false, error: data?.error?.message || "Groq ATS analysis failed." },
        { status: 500 }
      );
    }

    const raw = data?.choices?.[0]?.message?.content;
    if (!raw) {
      return NextResponse.json({ success: false, error: "No analysis returned by Groq." }, { status: 500 });
    }

    const parsed = JSON.parse(raw) as Partial<AnalysisResult>;
    const atsScore = Number.isFinite(parsed.atsScore)
      ? Math.max(0, Math.min(100, Math.round(parsed.atsScore as number)))
      : 0;
    const jobs = Array.isArray(parsed.jobs)
      ? parsed.jobs.filter((x) => typeof x === "string" && x.trim()).slice(0, 8)
      : [];

    return NextResponse.json({ success: true, atsScore, jobs });
  } catch (error) {
    console.error("resume-matcher-analyze:", error);
    return NextResponse.json({ success: false, error: "Failed to analyze resume." }, { status: 500 });
  }
}
