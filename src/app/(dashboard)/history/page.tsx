"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  Clock,
  Video,
  Users,
  Search,
  Calendar,
  MessageSquare,
  X,
  Loader2,
  Filter,
} from "lucide-react";
import { formatDuration, timeAgo } from "@/lib/utils";
import type { Session } from "@/types";

interface HistorySession extends Session {
  message_count?: number;
  event_count?: number;
}

export default function HistoryPage() {
  const [sessions, setSessions] = useState<HistorySession[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showFilters, setShowFilters] = useState(false);

  const fetchHistory = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (fromDate) params.set("from", fromDate);
      if (toDate) params.set("to", toDate);

      const res = await fetch(`/api/sessions/history?${params.toString()}`);
      const data = await res.json();

      if (res.ok) {
        setSessions(data.sessions || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error("Failed to fetch history:", err);
    } finally {
      setLoading(false);
    }
  }, [search, fromDate, toDate]);

  useEffect(() => {
    const debounce = setTimeout(fetchHistory, 300);
    return () => clearTimeout(debounce);
  }, [fetchHistory]);

  const clearFilters = () => {
    setSearch("");
    setFromDate("");
    setToDate("");
    setShowFilters(false);
  };

  const hasActiveFilters = search || fromDate || toDate;

  return (
    <div className="max-w-4xl mx-auto animate-fade-in">
      <div className="mb-6">
        <h1 className="text-2xl font-bold">Session History</h1>
        <p className="text-text-secondary text-sm mt-1">
          Browse past support sessions and recordings
        </p>
      </div>

      {/* Search & Filters */}
      <div className="space-y-3 mb-6">
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by title or customer name..."
              className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm bg-surface-1 border border-border focus:border-brand-500 text-white placeholder:text-text-muted"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              showFilters || hasActiveFilters
                ? "gradient-brand text-white"
                : "bg-surface-1 border border-border text-text-secondary hover:text-text-primary"
            }`}
          >
            <Filter className="w-4 h-4" />
            Filters
            {hasActiveFilters && (
              <span className="w-1.5 h-1.5 rounded-full bg-white" />
            )}
          </button>
        </div>

        {/* Date range filters */}
        {showFilters && (
          <div className="flex flex-wrap items-center gap-3 p-4 rounded-xl bg-surface-1 border border-border animate-fade-in">
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-text-muted" />
              <span className="text-xs text-text-muted">From</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm bg-surface-2 border border-border text-white"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="text-xs text-text-muted">To</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-3 py-1.5 rounded-lg text-sm bg-surface-2 border border-border text-white"
              />
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs text-danger-400 hover:bg-danger-500/10 transition-colors ml-auto"
              >
                <X className="w-3 h-3" />
                Clear
              </button>
            )}
          </div>
        )}
      </div>

      {/* Results count */}
      {!loading && (
        <p className="text-xs text-text-muted mb-4">
          {total} session{total !== 1 ? "s" : ""} found
          {hasActiveFilters && " (filtered)"}
        </p>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center py-16">
          <Loader2 className="w-8 h-8 text-brand-400 animate-spin mx-auto" />
        </div>
      )}

      {/* Empty state */}
      {!loading && sessions.length === 0 && (
        <div className="text-center py-16">
          <div className="w-16 h-16 rounded-2xl bg-surface-2 mx-auto flex items-center justify-center mb-4">
            <Clock className="w-8 h-8 text-text-muted" />
          </div>
          <h3 className="font-semibold mb-2">
            {hasActiveFilters ? "No matching sessions" : "No session history"}
          </h3>
          <p className="text-text-secondary text-sm">
            {hasActiveFilters
              ? "Try adjusting your search or filters."
              : "Completed sessions will appear here."}
          </p>
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="mt-4 px-4 py-2 rounded-lg text-sm text-brand-400 hover:bg-brand-500/10 transition-colors"
            >
              Clear filters
            </button>
          )}
        </div>
      )}

      {/* Session list */}
      {!loading && sessions.length > 0 && (
        <div className="space-y-3">
          {sessions.map((session) => (
            <Link
              key={session.id}
              href={`/sessions/${session.id}`}
              className="flex items-center gap-4 p-4 rounded-xl bg-surface-1 border border-border card-hover"
            >
              <div className="w-10 h-10 rounded-lg bg-surface-2 flex items-center justify-center flex-shrink-0">
                <Video className="w-5 h-5 text-text-muted" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-sm truncate">{session.title}</p>
                <div className="flex items-center gap-3 text-xs text-text-muted mt-1">
                  {session.customer_name && (
                    <span className="flex items-center gap-1">
                      <Users className="w-3 h-3" />
                      {session.customer_name}
                    </span>
                  )}
                  {session.duration_secs != null && (
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDuration(session.duration_secs)}
                    </span>
                  )}
                  {(session.message_count ?? 0) > 0 && (
                    <span className="flex items-center gap-1">
                      <MessageSquare className="w-3 h-3" />
                      {session.message_count} msgs
                    </span>
                  )}
                </div>
              </div>
              <div className="text-right flex-shrink-0 flex flex-col items-end gap-1">
                <p className="text-xs text-text-muted">
                  {session.ended_at ? timeAgo(session.ended_at) : "N/A"}
                </p>
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
      )}
    </div>
  );
}
