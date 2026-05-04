import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(req: NextRequest) {
    const session = await getServerSession(authOptions);
    if (!session) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { context, role, company } = await req.json();

    if (!role) {
        return NextResponse.json({ error: "role is required" }, { status: 400 });
    }

    const systemPrompt = context
        ? `${context.interviewerPersona}

You are running a mock interview for ${role} at ${company}. You are a SENIOR interviewer. Do NOT act like a generic chatbot.

${context.companyOverview}
Interview style: ${context.interviewStyle}
Culture / fit: ${context.cultureFitFocus}
Framework: ${context.behavioralFramework}
Tips for candidates: ${context.tipsForSuccess}
Red flags: ${context.redFlags}

Interview structure:
${context.interviewStructure}

Sample questions (use these as reference):
${context.sampleQuestions.map((q: any, i: number) => `${i + 1}. [${q.type}] ${q.question}`).join("\n")}

1. First spoken line must match this (verbatim): ${JSON.stringify(context.openingMessage)}
`
        : `You are a senior interviewer at ${company} hiring for ${role}.
- You are a STRICT, SENIOR technical interviewer. Conduct a realistic mock interview.`;

    return NextResponse.json({ systemPrompt });
}