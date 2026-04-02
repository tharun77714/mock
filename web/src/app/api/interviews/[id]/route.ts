import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import dbConnect from "@/lib/mongodb";
import Interview from "@/models/Interview";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    await dbConnect();
    const { id } = await params;
    const userId = (session.user as any).id || session.user?.email;
    const interview = await Interview.findById(id);

    if (!interview) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    if (String(interview.userId) !== String(userId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    return NextResponse.json(interview);
  } catch (err) {
    console.error("Interview GET error:", err);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
