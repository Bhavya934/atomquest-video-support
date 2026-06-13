"use client";

import { useEffect, useState } from "react";
import {
  Activity,
  Server,
  Users,
  AlertTriangle,
  RefreshCw,
  Clock,
  TrendingUp,
  Terminal,
} from "lucide-react";

interface Metrics {
  uptime: number;
  activeSessions: number;
  waitingSessions: number;
  endedSessions: number;
  totalSessions: number;
  activeSocketSessions: number;
  totalConnectedParticipants: number;
  eventsLast24h: number;
  errorsLast24h: number;
  errorRate24h: number;
}

export default function AdminMetricsPage() {
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const fetchMetrics = async () => {
    setRefreshing(true);
    setError("");
    try {
      const res = await fetch("/api/metrics");
      if (!res.ok) {
        throw new Error(`Failed to load metrics: ${res.statusText}`);
      }
      const data = await res.json();
      setMetrics(data);
    } catch (err: any) {
      setError(err.message || "An error occurred fetching metrics.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchMetrics();
    const interval = setInterval(fetchMetrics, 10000); // refresh every 10s
    return () => clearInterval(interval);
  }, []);

  const formatUptime = (seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    return `${h}h ${m}m ${s}s`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Activity className="w-8 h-8 text-brand-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Server className="w-6 h-6 text-brand-400" />
            Operational Metrics
          </h1>
          <p className="text-sm text-text-secondary">
            Live system performance and support call metrics.
          </p>
        </div>
        <button
          onClick={fetchMetrics}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-2 border border-border hover:bg-surface-3 transition-colors text-sm font-medium disabled:opacity-50 cursor-pointer"
        >
          <RefreshCw className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-danger-500/10 border border-danger-500/20 text-danger-400 text-sm flex items-center gap-3">
          <AlertTriangle className="w-5 h-5 flex-shrink-0" />
          {error}
        </div>
      )}

      {metrics && (
        <>
          {/* Main Grid */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Card 1: System Uptime */}
            <div className="p-5 rounded-xl bg-surface-1 border border-border space-y-3">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-xs font-semibold uppercase tracking-wider">System Uptime</span>
                <Clock className="w-5 h-5 text-accent-400" />
              </div>
              <p className="text-3xl font-bold">{formatUptime(metrics.uptime)}</p>
              <p className="text-xs text-text-secondary">Time since node server process started.</p>
            </div>

            {/* Card 2: Connected Sockets */}
            <div className="p-5 rounded-xl bg-surface-1 border border-border space-y-3">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-xs font-semibold uppercase tracking-wider">Connected Sockets</span>
                <Users className="w-5 h-5 text-brand-400" />
              </div>
              <p className="text-3xl font-bold">{metrics.totalConnectedParticipants}</p>
              <p className="text-xs text-text-secondary">
                Active socket clients (Agents + Customers).
              </p>
            </div>

            {/* Card 3: Error Rate (24h) */}
            <div className="p-5 rounded-xl bg-surface-1 border border-border space-y-3">
              <div className="flex items-center justify-between text-text-muted">
                <span className="text-xs font-semibold uppercase tracking-wider">Error Rate (24h)</span>
                <AlertTriangle className={`w-5 h-5 ${metrics.errorRate24h > 5 ? "text-danger-400" : "text-success-400"}`} />
              </div>
              <p className="text-3xl font-bold">{metrics.errorRate24h}%</p>
              <div className="w-full bg-surface-3 rounded-full h-1.5 overflow-hidden">
                <div
                  className={`h-full rounded-full ${metrics.errorRate24h > 5 ? "bg-danger-500" : "bg-brand-500"}`}
                  style={{ width: `${Math.min(metrics.errorRate24h, 100)}%` }}
                />
              </div>
              <p className="text-xs text-text-secondary">
                {metrics.errorsLast24h} errors out of {metrics.eventsLast24h} total events.
              </p>
            </div>
          </div>

          {/* Details Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Session Summary */}
            <div className="p-6 rounded-xl bg-surface-1 border border-border space-y-4">
              <h3 className="font-semibold text-base flex items-center gap-2 border-b border-border pb-3">
                <TrendingUp className="w-4 h-4 text-brand-400" />
                Session Counters
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-xs text-text-muted uppercase tracking-wider font-semibold">Active calls</p>
                  <p className="text-xl font-bold text-success-400">{metrics.activeSessions}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-text-muted uppercase tracking-wider font-semibold">Waiting rooms</p>
                  <p className="text-xl font-bold text-warning-400">{metrics.waitingSessions}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-text-muted uppercase tracking-wider font-semibold">Completed calls</p>
                  <p className="text-xl font-bold text-text-muted">{metrics.endedSessions}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-text-muted uppercase tracking-wider font-semibold">Total created</p>
                  <p className="text-xl font-bold">{metrics.totalSessions}</p>
                </div>
              </div>
            </div>

            {/* Socket Rooms details */}
            <div className="p-6 rounded-xl bg-surface-1 border border-border space-y-4">
              <h3 className="font-semibold text-base flex items-center gap-2 border-b border-border pb-3">
                <Terminal className="w-4 h-4 text-accent-400" />
                WebRTC Socket Activity
              </h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-secondary">Active Socket Rooms</span>
                  <span className="font-semibold">{metrics.activeSocketSessions}</span>
                </div>
                <div className="flex justify-between items-center text-sm">
                  <span className="text-text-secondary">Total Connected Sockets</span>
                  <span className="font-semibold">{metrics.totalConnectedParticipants}</span>
                </div>
                <div className="text-xs text-text-muted pt-2 border-t border-border/50">
                  Calculated dynamically from socket mapping indices.
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
