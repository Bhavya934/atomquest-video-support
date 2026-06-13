import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";
import { SessionDetailClient } from "@/components/session/session-detail-client";
import { mapSessionToClient, mapMessageToClient } from "@/lib/utils";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SessionDetailPage({ params }: Props) {
  const { id } = await params;
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const dbSession = await prisma.session.findUnique({
    where: { id },
    include: {
      agent: true,
    },
  });

  if (!dbSession || dbSession.agentId !== user.id) {
    notFound();
  }

  const session = mapSessionToClient(dbSession);

  // Fetch chat messages for this session
  const dbMessages = await prisma.chatMessage.findMany({
    where: { sessionId: id },
    orderBy: { createdAt: "asc" },
  });
  const messages = dbMessages.map(mapMessageToClient);

  // Fetch session events for audit trail
  const dbEvents = await prisma.sessionEvent.findMany({
    where: { sessionId: id },
    orderBy: { createdAt: "asc" },
  });
  const events = dbEvents.map((e: any) => ({
    id: e.id,
    session_id: e.sessionId,
    event_type: e.eventType,
    actor: e.actor,
    metadata: e.metadata ? JSON.parse(e.metadata) : {},
    created_at: e.createdAt.toISOString(),
  }));

  return (
    <SessionDetailClient
      session={session}
      agentName={user.fullName}
      initialMessages={messages}
      initialEvents={events}
    />
  );
}
