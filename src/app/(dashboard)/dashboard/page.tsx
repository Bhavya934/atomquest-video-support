import { getAuthUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Video,
  Users,
  Clock,
  Plus,
  ArrowUpRight,
  PhoneCall,
  PhoneOff,
  Timer,
} from "lucide-react";
import { formatDuration, timeAgo, mapSessionToClient } from "@/lib/utils";
import { SESSION_STATUSES } from "@/lib/constants";
import type { Session } from "@/types";

export default async function DashboardPage() {
  const user = await getAuthUser();

  if (!user) {
    redirect("/login");
  }

  // Fetch sessions from Prisma
  const dbSessions = await prisma.session.findMany({
    where: { agentId: user.id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      agent: true,
    },
  });

  const allSessions = dbSessions.map(mapSessionToClient);
  const activeSessions = allSessions.filter((s) => s.status === "active");
  const waitingSessions = allSessions.filter((s) => s.status === "waiting");
  const endedSessions = allSessions.filter((s) => s.status === "ended");
  const totalDuration = allSessions.reduce((sum, s) => sum + (s.duration_secs || 0), 0);

  return (
    <div className="max-w-7xl mx-auto space-y-8 animate-fade-in">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: "Active Calls",
            value: activeSessions.length.toString(),
            icon: PhoneCall,
            color: "text-success-400",
            bg: "bg-success-500/10",
          },
          {
            label: "Waiting",
            value: waitingSessions.length.toString(),
            icon: Clock,
            color: "text-warning-400",
            bg: "bg-warning-500/10",
          },
          {
            label: "Total Sessions",
            value: allSessions.length.toString(),
            icon: Video,
            color: "text-brand-400",
            bg: "bg-brand-500/10",
          },
          {
            label: "Total Call Time",
            value: totalDuration > 0 ? formatDuration(totalDuration) : "0s",
            icon: Timer,
            color: "text-accent-400",
            bg: "bg-accent-500/10",
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="p-4 sm:p-5 rounded-xl bg-surface-1 border border-border card-hover"
          >
            <div className="flex items-center gap-3 mb-3">
              <div className={`w-10 h-10 rounded-lg ${stat.bg} flex items-center justify-center`}>
                <stat.icon className={`w-5 h-5 ${stat.color}`} />
              </div>
            </div>
            <p className="text-2xl sm:text-3xl font-bold">{stat.value}</p>
            <p className="text-sm text-text-muted mt-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Link
          href="/sessions/new"
          className="flex-1 flex items-center gap-4 p-5 rounded-xl gradient-brand-subtle border border-brand-500/20 card-hover group"
        >
          <div className="w-12 h-12 rounded-xl gradient-brand flex items-center justify-center group-hover:scale-110 transition-transform">
            <Plus className="w-6 h-6 text-white" />
          </div>
          <div>
            <p className="font-semibold text-lg">Start New Session</p>
            <p className="text-sm text-text-secondary">
              Create a session and share the link with your customer
            </p>
          </div>
          <ArrowUpRight className="w-5 h-5 text-text-muted ml-auto" />
        </Link>
      </div>

      {/* Active & Waiting Sessions */}
      {(activeSessions.length > 0 || waitingSessions.length > 0) && (
        <div>
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Users className="w-5 h-5 text-brand-400" />
            Live Sessions
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[...activeSessions, ...waitingSessions].map((session) => {
              const statusConfig = SESSION_STATUSES[session.status as keyof typeof SESSION_STATUSES];
              return (
                <Link
                  key={session.id}
                  href={`/sessions/${session.id}`}
                  className="p-5 rounded-xl bg-surface-1 border border-border card-hover group"
                >
                  <div className="flex items-center gap-2 mb-3">
                    <span className={statusConfig.dotClass + " status-dot"} />
                    <span className={`text-xs font-medium text-${statusConfig.color}-400`}>
                      {statusConfig.label}
                    </span>
                    <span className="text-xs text-text-muted ml-auto">
                      {timeAgo(session.created_at)}
                    </span>
                  </div>
                  <h3 className="font-semibold text-sm group-hover:text-brand-400 transition-colors mb-1">
                    {session.title}
                  </h3>
                  {session.customer_name && (
                    <p className="text-xs text-text-secondary flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {session.customer_name}
                    </p>
                  )}
                  {!session.customer_name && session.status === "waiting" && (
                    <p className="text-xs text-warning-400">
                      Waiting for customer to join...
                    </p>
                  )}
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent Ended Sessions */}
      {endedSessions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <PhoneOff className="w-5 h-5 text-text-muted" />
              Recent Sessions
            </h2>
            <Link
              href="/history"
              className="text-sm text-brand-400 hover:text-brand-300 transition-colors"
            >
              View all →
            </Link>
          </div>
          <div className="space-y-2">
            {endedSessions.slice(0, 5).map((session) => (
              <Link
                key={session.id}
                href={`/sessions/${session.id}`}
                className="flex items-center gap-4 p-4 rounded-xl bg-surface-1 border border-border card-hover"
              >
                <div className="w-10 h-10 rounded-lg bg-surface-2 flex items-center justify-center flex-shrink-0">
                  <PhoneOff className="w-5 h-5 text-text-muted" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{session.title}</p>
                  <p className="text-xs text-text-muted">
                    {session.customer_name || "No customer"} •{" "}
                    {session.duration_secs ? formatDuration(session.duration_secs) : "N/A"}
                  </p>
                </div>
                <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                  <span className="text-xs text-text-muted">{timeAgo(session.created_at)}</span>
                  {session.recording_status === "ready" && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-success-400 font-medium bg-success-500/10 px-2 py-0.5 rounded-full">
                      📹 Ready
                    </span>
                  )}
                  {session.recording_status === "processing" && (
                    <span className="inline-flex items-center gap-1 text-[10px] text-warning-400 font-medium bg-warning-500/10 px-2 py-0.5 rounded-full">
                      ⚙️ Processing
                    </span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {allSessions.length === 0 && (
        <div className="text-center py-16">
          <div className="w-20 h-20 rounded-2xl gradient-brand mx-auto flex items-center justify-center mb-6 animate-float">
            <Video className="w-10 h-10 text-white" />
          </div>
          <h3 className="text-xl font-semibold mb-2">No sessions yet</h3>
          <p className="text-text-secondary mb-6 max-w-md mx-auto">
            Create your first support session and share the link with a customer
            to start a video call.
          </p>
          <Link
            href="/sessions/new"
            className="inline-flex items-center gap-2 px-6 py-3 rounded-xl gradient-brand text-white font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-5 h-5" />
            Create First Session
          </Link>
        </div>
      )}
    </div>
  );
}
