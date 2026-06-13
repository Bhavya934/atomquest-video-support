import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";

export async function GET(request: Request) {
  try {
    // 1. Authenticate (Allow either valid agent session OR correct Authorization API key header)
    const user = await getAuthUser();
    const authHeader = request.headers.get("authorization");
    const secretApiKey = process.env.MIROTALK_API_KEY || "atomquest_mirotalk_secret";
    const isApiKeyValid = authHeader === secretApiKey || authHeader === `Bearer ${secretApiKey}`;

    if (!user && !isApiKeyValid) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 2. Query DB Stats
    const totalSessions = await prisma.session.count();
    const activeSessions = await prisma.session.count({ where: { status: "active" } });
    const waitingSessions = await prisma.session.count({ where: { status: "waiting" } });
    const endedSessions = await prisma.session.count({ where: { status: "ended" } });

    // 3. Error counts (last 24 hours)
    const past24h = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const totalEvents24h = await prisma.sessionEvent.count({
      where: { createdAt: { gte: past24h } },
    });
    const errorEvents24h = await prisma.sessionEvent.count({
      where: { eventType: "error", createdAt: { gte: past24h } },
    });

    const errorRate24h = totalEvents24h > 0 ? (errorEvents24h / totalEvents24h) * 100 : 0;

    // 4. Retrieve Socket.io stats via shared global object
    let activeSocketSessions = 0;
    let totalConnectedSockets = 0;

    // @ts-ignore
    if (typeof global.getSocketMetrics === "function") {
      // @ts-ignore
      const socketStats = global.getSocketMetrics();
      activeSocketSessions = socketStats.activeSocketSessions;
      totalConnectedSockets = socketStats.totalConnectedSockets;
    }

    return NextResponse.json({
      uptime: Math.floor(process.uptime()),
      activeSessions,
      waitingSessions,
      endedSessions,
      totalSessions,
      activeSocketSessions,
      totalConnectedParticipants: totalConnectedSockets,
      eventsLast24h: totalEvents24h,
      errorsLast24h: errorEvents24h,
      errorRate24h: parseFloat(errorRate24h.toFixed(2)),
    });
  } catch (err: any) {
    console.error("GET metrics error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
