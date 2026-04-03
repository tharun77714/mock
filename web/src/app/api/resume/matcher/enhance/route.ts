import { NextResponse } from "next/server";

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";

export async function POST(req: Request) {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) {
      return NextResponse.json({ success: false, error: "Missing GROQ_API_KEY in environment." }, { status: 500 });
    }

    const { resumeText, jobDescription } = await req.json();
    if (!resumeText || !jobDescription) {
      return NextResponse.json({ success: false, error: "resumeText and jobDescription are required." }, { status: 400 });
    }

    const prompt = `
You are an ATS and resume optimization expert.
Given a resume and target job description, provide:
1) 6 specific bullet rewrites
2) 10 missing keywords to include naturally
3) 3 short summary alternatives

Return plain text with headings.

RESUME:
${String(resumeText).slice(0, 7000)}

JOB DESCRIPTION:
${String(jobDescription).slice(0, 7000)}
`;

    const response = await fetch(GROQ_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        temperature: 0.3,
        messages: [
          { role: "system", content: "Be precise and concise." },
          { role: "user", content: prompt },
        ],
      }),
    });

    const data = await response.json();
    if (!response.ok) {
      return NextResponse.json({ success: false, error: data?.error?.message || "Groq request failed." }, { status: 500 });
    }

    const suggestions = data?.choices?.[0]?.message?.content ?? "";
    return NextResponse.json({ success: true, suggestions });
  } catch (error) {
    console.error("resume-matcher-enhance:", error);
    return NextResponse.json({ success: false, error: "Failed to generate suggestions." }, { status: 500 });
  }
}
