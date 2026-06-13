import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { mapSessionToClient } from "@/lib/utils";

// GET /api/sessions/history — Query ended sessions with search/filter
export async function GET(request: Request) {
  try {
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const url = new URL(request.url);
    const search = url.searchParams.get("search") || "";
    const from = url.searchParams.get("from");
    const to = url.searchParams.get("to");
    const limit = Math.min(parseInt(url.searchParams.get("limit") || "50", 10), 100);
    const offset = parseInt(url.searchParams.get("offset") || "0", 10);

    // Build filter conditions
    const where: any = {
      agentId: user.id,
      status: "ended",
    };

    // Search by title or customer name
    if (search.trim()) {
      where.OR = [
        { title: { contains: search.trim() } },
        { customerName: { contains: search.trim() } },
      ];
    }

    // Date range filter
    if (from || to) {
      where.endedAt = {};
      if (from) {
        where.endedAt.gte = new Date(from);
      }
      if (to) {
        // Set to end of day
        const toDate = new Date(to);
        toDate.setHours(23, 59, 59, 999);
        where.endedAt.lte = toDate;
      }
    }

    const [sessions, total] = await Promise.all([
      prisma.session.findMany({
        where,
        orderBy: { endedAt: "desc" },
        take: limit,
        skip: offset,
        include: {
          agent: true,
          _count: {
            select: { messages: true, events: true },
          },
        },
      }),
      prisma.session.count({ where }),
    ]);

    const mapped = sessions.map((s: any) => ({
      ...mapSessionToClient(s),
      message_count: s._count?.messages || 0,
      event_count: s._count?.events || 0,
    }));

    return NextResponse.json({
      sessions: mapped,
      total,
      limit,
      offset,
    });
  } catch (err: any) {
    console.error("GET history error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
