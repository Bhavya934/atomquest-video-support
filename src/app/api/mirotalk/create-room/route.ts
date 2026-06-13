import { NextResponse } from "next/server";
import { createMiroTalkRoom } from "@/lib/mirotalk/api";

// POST /api/mirotalk/create-room — Proxy to MiroTalk SFU API
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { roomId } = body;

    if (!roomId) {
      return NextResponse.json(
        { error: "roomId is required" },
        { status: 400 }
      );
    }

    const meetingUrl = await createMiroTalkRoom(roomId);

    return NextResponse.json({ meetingUrl });
  } catch (err) {
    console.error("MiroTalk API proxy error:", err);
    return NextResponse.json(
      { error: "Failed to create MiroTalk room" },
      { status: 500 }
    );
  }
}
