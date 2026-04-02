import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Interview from "@/models/Interview";

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await dbConnect();
    const userId = (session.user as any).id || session.user?.email;
    const interviews = await Interview.find({ userId }).sort({ createdAt: -1 });

    return NextResponse.json(interviews);
  } catch (err) {
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
