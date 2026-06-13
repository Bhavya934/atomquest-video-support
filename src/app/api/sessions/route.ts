import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { mapSessionToClient } from "@/lib/utils";
import crypto from "crypto";

// GET /api/sessions — List sessions for the current agent
export async function GET() {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const dbSessions = await prisma.session.findMany({
      where: { agentId: user.id },
      orderBy: { createdAt: "desc" },
      include: {
        agent: true,
      },
    });

    const sessions = dbSessions.map(mapSessionToClient);

    return NextResponse.json({ sessions });
  } catch (err: any) {
    console.error("GET sessions error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// POST /api/sessions — Create a new session
export async function POST(request: Request) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { title, description } = body;

    if (!title?.trim()) {
      return NextResponse.json(
        { error: "Title is required" },
        { status: 400 }
      );
    }

    // Generate room ID for MiroTalk
    const roomId = `aq_${Date.now()}_${crypto.randomUUID().replace(/-/g, "").slice(0, 6)}`;
    
    // Generate share token
    const shareToken = crypto.randomUUID().replace(/-/g, "");

    const dbSession = await prisma.session.create({
      data: {
        agentId: user.id,
        title: title.trim(),
        description: description?.trim() || null,
        roomId: roomId,
        shareToken: shareToken,
        status: "waiting",
      },
      include: {
        agent: true,
      },
    });

    // Log SessionEvent for creation
    await prisma.sessionEvent.create({
      data: {
        sessionId: dbSession.id,
        eventType: "created",
        actor: "agent",
        metadata: JSON.stringify({ agentName: user.fullName }),
      },
    });

    const session = mapSessionToClient(dbSession);
    const joinUrl = `${process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000"}/join/${session.share_token}`;

    return NextResponse.json({
      session,
      joinUrl,
    });
  } catch (err: any) {
    console.error("POST sessions error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
