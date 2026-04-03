import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Interview from "@/models/Interview";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import axios from "axios";
import { getInterviewsBucket, getSupabaseAdmin } from "@/lib/supabase-server";

function safePathSegment(id: string): string {
  return String(id).replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200);
}

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

    const userId = safePathSegment(
      (session.user as { id?: string })?.id || session.user?.email || "anonymous"
    );

    let filePath = "";
    let videoUrl = "";
    let usedSupabase = false;

    if (videoFile && videoFile.size > 0) {
      const buffer = Buffer.from(await videoFile.arrayBuffer());
      const ts = Date.now();
      const ext =
        videoFile.name?.toLowerCase().endsWith(".mp4")
          ? "mp4"
          : videoFile.name?.toLowerCase().endsWith(".webm")
            ? "webm"
            : "webm";
      const objectPath = `videos/${userId}/${ts}_interview.${ext}`;

      const supabase = getSupabaseAdmin();
      const bucket = getInterviewsBucket();

      if (supabase) {
        const contentType =
          videoFile.type ||
          (ext === "mp4" ? "video/mp4" : "video/webm");

        const { error: upErr } = await supabase.storage
          .from(bucket)
          .upload(objectPath, buffer, {
            contentType,
            upsert: true,
          });

        if (upErr) {
          console.error("Supabase video upload failed:", upErr);
        } else {
          const { data: pub } = supabase.storage.from(bucket).getPublicUrl(objectPath);
          videoUrl = pub.publicUrl;
          filePath = videoUrl;
          usedSupabase = true;
        }
      }

      if (!usedSupabase) {
        const uploadDir = join(process.cwd(), "public/uploads");
        await mkdir(uploadDir, { recursive: true });
        const filename = `${ts}_interview.${ext}`;
        filePath = join(uploadDir, filename);
        videoUrl = `/uploads/${filename}`;
        await writeFile(filePath, buffer);
      }
    }

    const interview = await Interview.create({
      userId: (session.user as { id?: string })?.id || session.user?.email,
      transcript,
      videoUrl: videoUrl || undefined,
      status: "pending",
    });

    try {
      const PYTHON_API_URL = process.env.PYTHON_API_URL || "http://localhost:8000";
      const { data: analysis } = await axios.post(`${PYTHON_API_URL}/process`, {
        video_path: filePath,
        interview_id: interview._id.toString(),
        transcript,
        user_id: userId,
      });

      await Interview.findByIdAndUpdate(interview._id, {
        analysis: {
          confidence: analysis.confidence,
          emotion: analysis.emotion,
          communication: analysis.communication,
          suggestions: analysis.suggestions,
          eyeContact: analysis.eyeContact,
          faceInFrame: analysis.faceInFrame,
          posture: analysis.posture,
          headStability: analysis.headStability,
          facialExpression: analysis.facialExpression,
          fillerWords: analysis.fillerWords,
          speakingPace: analysis.speakingPace,
          overallScore: analysis.overallScore,
          voiceAnalysis: analysis.voiceAnalysis,
          englishCoaching: analysis.englishCoaching,
        },
        audioUrl: analysis.audio_url || undefined,
        status: "completed",
      });
    } catch (pyErr) {
      console.error("Python DL Server error:", pyErr);
      await Interview.findByIdAndUpdate(interview._id, { status: "failed" });
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
