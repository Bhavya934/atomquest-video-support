import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Video, Plus, Users, Clock } from "lucide-react";
import { timeAgo, mapSessionToClient } from "@/lib/utils";
import { SESSION_STATUSES } from "@/lib/constants";

export default async function SessionsPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  const dbSessions = await prisma.session.findMany({
    where: {
      agentId: user.id,
      status: {
        in: ["waiting", "active", "paused"],
      },
    },
    orderBy: { createdAt: "desc" },
    include: {
      agent: true,
    },
  });

  const allSessions = dbSessions.map(mapSessionToClient);

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Active Sessions</h1>
          <p className="text-text-secondary text-sm mt-1">
            Manage your current support sessions
          </p>
        </div>
        <Link
          href="/sessions/new"
          className="flex-1 max-w-[150px] flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg gradient-brand text-white text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          New Session
        </Link>
      </div>

      {allSessions.length === 0 ? (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-surface-2 mx-auto flex items-center justify-center mb-4">
            <Video className="w-8 h-8 text-text-muted" />
          </div>
          <h3 className="font-semibold mb-2">No active sessions</h3>
          <p className="text-text-secondary text-sm mb-6">
            All sessions have ended. Create a new one to get started.
          </p>
          <Link
            href="/sessions/new"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg gradient-brand text-white text-sm font-medium"
          >
            <Plus className="w-4 h-4" />
            New Session
          </Link>
        </div>
      ) : (
        <div className="grid gap-4">
          {allSessions.map((session) => {
            const statusConfig =
              SESSION_STATUSES[session.status as keyof typeof SESSION_STATUSES];
            return (
              <Link
                key={session.id}
                href={`/sessions/${session.id}`}
                className="flex items-center gap-4 p-5 rounded-xl bg-surface-1 border border-border card-hover group"
              >
                <div className="w-12 h-12 rounded-xl bg-brand-500/10 flex items-center justify-center group-hover:scale-110 transition-transform">
                  <Video className="w-6 h-6 text-brand-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-sm group-hover:text-brand-400 transition-colors truncate">
                      {session.title}
                    </h3>
                    <span className={`${statusConfig.dotClass} status-dot`} />
                    <span className="text-xs text-text-muted">
                      {statusConfig.label}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-text-muted">
                    {session.customer_name && (
                      <span className="flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {session.customer_name}
                      </span>
                    )}
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {timeAgo(session.created_at)}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
