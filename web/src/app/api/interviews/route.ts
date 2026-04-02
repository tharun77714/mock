import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Interview from "@/models/Interview";
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import axios from "axios";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await dbConnect();
    const formData = await req.formData();
    
    const transcript = formData.get("transcript") as string;
    const videoFile = formData.get("video") as File;

    if (!transcript) {
      return NextResponse.json({ error: "Missing transcript" }, { status: 400 });
    }

    let filePath = "";
    let videoUrl = "";

    if (videoFile && videoFile.size > 0) {
      const buffer = Buffer.from(await videoFile.arrayBuffer());
      const uploadDir = join(process.cwd(), 'public/uploads');
      await mkdir(uploadDir, { recursive: true });
      const filename = `${Date.now()}_interview.webm`;
      filePath = join(uploadDir, filename);
      videoUrl = `/uploads/${filename}`;
      await writeFile(filePath, buffer);
    }

    const interview = await Interview.create({
      userId: (session.user as any).id || session.user?.email,
      transcript,
      videoUrl: videoUrl || undefined,
      status: 'pending'
    });

    try {
      const { data: analysis } = await axios.post("http://localhost:8000/process", {
        video_path: filePath,
        interview_id: interview._id.toString(),
        transcript: transcript
      });

      await Interview.findByIdAndUpdate(interview._id, {
        analysis: {
          confidence: analysis.confidence,
          emotion: analysis.emotion,
          communication: analysis.communication,
          suggestions: analysis.suggestions,
          eyeContact: analysis.eyeContact,
          posture: analysis.posture,
          headStability: analysis.headStability,
          facialExpression: analysis.facialExpression,
          fillerWords: analysis.fillerWords,
          speakingPace: analysis.speakingPace,
          overallScore: analysis.overallScore,
          voiceAnalysis: analysis.voiceAnalysis,
          englishCoaching: analysis.englishCoaching,  // Gemini transcript analysis
        },
        status: 'completed'
      });
    } catch (pyErr) {
      console.error("Python DL Server error:", pyErr);
    }

    return NextResponse.json({ 
      success: true, 
      interviewId: interview._id,
    });
    
  } catch (err) {
    console.error("Interview Upload Error:", err);
    return NextResponse.json({ error: "Server Error" }, { status: 500 });
  }
}
