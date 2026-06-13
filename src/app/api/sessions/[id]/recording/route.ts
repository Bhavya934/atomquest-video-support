import { NextResponse } from "next/server";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { id: sessionId } = await params;
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify session exists and belongs to the agent
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (session.agentId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File;

    if (!file) {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Ensure recordings directory exists inside public folder
    const recordingsDir = path.join(process.cwd(), "public", "recordings", sessionId);
    try {
      await mkdir(recordingsDir, { recursive: true });
    } catch (err) {
      // Ignore if directory already exists
    }

    const filename = `recording.webm`;
    const filePath = path.join(recordingsDir, filename);
    await writeFile(filePath, buffer);

    const recordingUrl = `/recordings/${sessionId}/${filename}`;

    // Update database
    await prisma.session.update({
      where: { id: sessionId },
      data: {
        recordingStatus: "ready",
        recordingUrl,
      },
    });

    return NextResponse.json({
      success: true,
      url: recordingUrl,
    });
  } catch (error: any) {
    console.error("Recording upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
