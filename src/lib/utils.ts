import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import type { Session, ChatMessage } from "@/types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Generate a shareable session URL
 */
export function getSessionJoinUrl(shareToken: string): string {
  const base =
    typeof window !== "undefined"
      ? window.location.origin
      : process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  return `${base}/join/${shareToken}`;
}

/**
 * Format duration in seconds to human-readable string
 */
export function formatDuration(seconds: number): string {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hrs > 0) {
    return `${hrs}h ${mins}m ${secs}s`;
  }
  if (mins > 0) {
    return `${mins}m ${secs}s`;
  }
  return `${secs}s`;
}

/**
 * Format a timer display (MM:SS or HH:MM:SS)
 */
export function formatTimer(totalSeconds: number): string {
  const hrs = Math.floor(totalSeconds / 3600);
  const mins = Math.floor((totalSeconds % 3600) / 60);
  const secs = totalSeconds % 60;

  const pad = (n: number) => n.toString().padStart(2, "0");

  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Generate initials from a name
 */
export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((word) => word.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

/**
 * Relative time display (e.g., "2 minutes ago")
 */
export function timeAgo(date: Date | string): string {
  const now = new Date();
  const then = new Date(date);
  const seconds = Math.floor((now.getTime() - then.getTime()) / 1000);

  if (seconds < 60) return "just now";
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

/**
 * Copy text to clipboard with fallback
 */
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    // Fallback for older browsers
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    try {
      document.execCommand("copy");
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textArea);
    }
  }
}

/**
 * Map Prisma SQLite Session schema to client Session type
 */
export function mapSessionToClient(dbSession: any): Session {
  if (!dbSession) return null as any;
  return {
    id: dbSession.id,
    agent_id: dbSession.agentId,
    customer_name: dbSession.customerName,
    customer_email: dbSession.customerEmail,
    title: dbSession.title,
    description: dbSession.description,
    status: dbSession.status,
    room_id: dbSession.roomId,
    room_url: dbSession.roomUrl,
    share_token: dbSession.shareToken,
    started_at: dbSession.startedAt ? dbSession.startedAt.toISOString() : null,
    ended_at: dbSession.endedAt ? dbSession.endedAt.toISOString() : null,
    duration_secs: dbSession.durationSecs,
    recording_url: dbSession.recordingUrl,
    recording_status: dbSession.recordingStatus || "idle",
    recording_started_at: dbSession.recordingStartedAt ? dbSession.recordingStartedAt.toISOString() : null,
    metadata: dbSession.metadata ? JSON.parse(dbSession.metadata) : {},
    created_at: dbSession.createdAt.toISOString(),
    updated_at: dbSession.updatedAt.toISOString(),
    agent: dbSession.agent ? {
      id: dbSession.agent.id,
      email: dbSession.agent.email,
      full_name: dbSession.agent.fullName,
      role: dbSession.agent.role,
      avatar_url: dbSession.agent.avatarUrl || null,
      created_at: dbSession.agent.createdAt.toISOString(),
      updated_at: dbSession.agent.updatedAt.toISOString(),
    } : undefined
  };
}

/**
 * Map Prisma SQLite ChatMessage schema to client ChatMessage type
 */
export function mapMessageToClient(dbMessage: any): ChatMessage {
  if (!dbMessage) return null as any;
  return {
    id: dbMessage.id,
    session_id: dbMessage.sessionId,
    sender_type: dbMessage.senderType,
    sender_name: dbMessage.senderName,
    content: dbMessage.content,
    file_url: dbMessage.fileUrl,
    file_name: dbMessage.fileName,
    created_at: dbMessage.createdAt.toISOString(),
  };
}

