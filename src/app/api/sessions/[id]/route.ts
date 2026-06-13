import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getAuthUser } from "@/lib/auth";
import { mapSessionToClient, mapMessageToClient } from "@/lib/utils";

interface RouteParams {
  params: Promise<{ id: string }>;
}

// GET /api/sessions/[id] — Get session details
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getAuthUser();

    // Find the session
    const dbSession = await prisma.session.findUnique({
      where: { id },
      include: {
        agent: true,
      },
    });

    if (!dbSession) {
      // Also try to find by shareToken in case id is the shareToken
      const dbSessionByToken = await prisma.session.findUnique({
        where: { shareToken: id },
        include: {
          agent: true,
        },
      });

      if (!dbSessionByToken) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }

      // Fetch chat messages
      const dbMessages = await prisma.chatMessage.findMany({
        where: { sessionId: dbSessionByToken.id },
        orderBy: { createdAt: "asc" },
      });

      // If customer is querying, let them check waiting or active status
      return NextResponse.json({
        session: mapSessionToClient(dbSessionByToken),
        messages: dbMessages.map(mapMessageToClient),
      });
    }

    // If agent is authenticated, verify they own the session
    if (user && dbSession.agentId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // If customer (unauthenticated), only allow access if the session is waiting, active, or ended (so they see ended page)
    if (!user && dbSession.status !== "waiting" && dbSession.status !== "active" && dbSession.status !== "ended") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch chat messages
    const dbMessages = await prisma.chatMessage.findMany({
      where: { sessionId: dbSession.id },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      session: mapSessionToClient(dbSession),
      messages: dbMessages.map(mapMessageToClient),
    });
  } catch (err: any) {
    console.error("GET session error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// PATCH /api/sessions/[id] — Update session
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getAuthUser();

    // Verify session exists. id can be either session UUID or shareToken
    let existingSession = await prisma.session.findUnique({
      where: { id },
    });

    if (!existingSession) {
      existingSession = await prisma.session.findUnique({
        where: { shareToken: id },
      });
    }

    if (!existingSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const body = await request.json();

    // Auth check: if a valid share token is provided in the request body, treat the requester as a customer/guest
    const providedShareToken = body.share_token || body.shareToken;
    const hasValidShareToken = providedShareToken && providedShareToken === existingSession.shareToken;

    if (hasValidShareToken) {
      // Customer (or agent joining as customer) - restrict update fields
      const allowedKeys = ["customer_name", "customerName", "customer_email", "customerEmail", "status", "share_token", "shareToken", "metadata"];
      const bodyKeys = Object.keys(body);
      const isTryingToUpdateRestrictedFields = bodyKeys.some(key => !allowedKeys.includes(key));
      if (isTryingToUpdateRestrictedFields) {
        return NextResponse.json({ error: "Forbidden: Customers cannot modify session settings" }, { status: 403 });
      }

      // Customer can only set status to "active" (joining), NOT "ended" or anything else
      if (body.status && body.status !== "active") {
        return NextResponse.json({ error: "Forbidden: Customers cannot change session status to " + body.status }, { status: 403 });
      }
    } else {
      // Must be authenticated agent who owns the session
      if (!user) {
        return NextResponse.json({ error: "Unauthorized: Missing or invalid share token" }, { status: 401 });
      }
      if (existingSession.agentId !== user.id) {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    // Map snake_case fields from request body to camelCase prisma fields
    const data: any = {};
    if (body.title !== undefined) data.title = body.title;
    if (body.description !== undefined) data.description = body.description;
    if (body.status !== undefined) {
      data.status = body.status;
      if (body.status === "active" && !existingSession.startedAt) {
        data.startedAt = new Date();
      }
      if (body.status === "ended") {
        data.endedAt = new Date();
        const start = existingSession.startedAt || new Date();
        data.durationSecs = Math.floor((Date.now() - start.getTime()) / 1000);
      }
    }
    if (body.customer_name !== undefined) data.customerName = body.customer_name;
    if (body.customer_email !== undefined) data.customerEmail = body.customer_email;
    if (body.ended_at !== undefined) data.endedAt = body.ended_at ? new Date(body.ended_at) : null;
    if (body.duration_secs !== undefined) data.durationSecs = body.duration_secs;
    if (body.recording_url !== undefined) data.recordingUrl = body.recording_url;
    if (body.metadata !== undefined) {
      data.metadata = typeof body.metadata === "string" ? body.metadata : JSON.stringify(body.metadata);
    }

    const updatedSession = await prisma.session.update({
      where: { id: existingSession.id },
      data,
      include: {
        agent: true,
      },
    });

    // Log SessionEvent for status changes
    if (body.status && body.status !== existingSession.status) {
      await prisma.sessionEvent.create({
        data: {
          sessionId: existingSession.id,
          eventType: "status-change",
          actor: user ? "agent" : "customer",
          metadata: JSON.stringify({
            from: existingSession.status,
            to: body.status,
          }),
        },
      });
    }

    return NextResponse.json({ session: mapSessionToClient(updatedSession) });
  } catch (err: any) {
    console.error("PATCH session error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

// DELETE /api/sessions/[id] — Delete session
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { id } = await params;
    const user = await getAuthUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Verify ownership
    const existingSession = await prisma.session.findUnique({
      where: { id },
    });

    if (!existingSession) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    if (existingSession.agentId !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    await prisma.session.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error("DELETE session error:", err);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
