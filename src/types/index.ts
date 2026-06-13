// ==========================================
// TypeScript Types — Database Models
// ==========================================

export type UserRole = "agent" | "admin";
export type SessionStatus = "waiting" | "active" | "paused" | "ended";
export type SenderType = "agent" | "customer" | "system";

export interface Profile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Session {
  id: string;
  agent_id: string;
  customer_name: string | null;
  customer_email: string | null;
  title: string;
  description: string | null;
  status: SessionStatus;
  room_id: string | null;
  room_url: string | null;
  share_token: string;
  started_at: string | null;
  ended_at: string | null;
  duration_secs: number | null;
  recording_url: string | null;
  recording_status: "idle" | "recording" | "processing" | "ready";
  recording_started_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  // Joined fields
  agent?: Profile;
}

export interface ChatMessage {
  id: string;
  session_id: string;
  sender_type: SenderType;
  sender_name: string;
  content: string;
  file_url: string | null;
  file_name: string | null;
  created_at: string;
}

export interface SessionEvent {
  id: string;
  session_id: string;
  event_type: string;
  actor: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

// ==========================================
// Socket.io Event Types
// ==========================================

export interface ServerToClientEvents {
  "session:customer-joined": (data: {
    sessionId: string;
    customerName: string;
  }) => void;
  "session:ended": (data: {
    sessionId: string;
    endedBy: "agent" | "customer" | "system";
    reason?: string;
  }) => void;
  "session:customer-left": (data: {
    sessionId: string;
    timeoutMs: number;
  }) => void;
  "session:customer-reconnected": (data: {
    sessionId: string;
  }) => void;
  "session:status-changed": (data: {
    sessionId: string;
    status: SessionStatus;
  }) => void;
  "chat:new-message": (data: ChatMessage) => void;
  "chat:typing": (data: {
    sessionId: string;
    senderName: string;
    isTyping: boolean;
  }) => void;
  "presence:update": (data: {
    sessionId: string;
    online: boolean;
    role: string;
    agentCount?: number;
    customerCount?: number;
  }) => void;
  "recording:start": (data: { sessionId: string }) => void;
  "recording:stop": (data: { sessionId: string }) => void;
}

export interface ClientToServerEvents {
  "session:join": (data: string | { sessionId: string; role: string }) => void;
  "session:leave": (sessionId: string) => void;
  "session:end": (data: string | { sessionId: string; role: string }) => void;
  "session:customer-leave": (data: string | { sessionId: string }) => void;
  "session:customer-joined": (data: {
    sessionId: string;
    customerName: string;
  }) => void;
  "chat:send-message": (data: {
    sessionId: string;
    content: string;
    senderType: SenderType;
    senderName: string;
    fileUrl?: string | null;
    fileName?: string | null;
  }) => void;
  "chat:typing": (data: {
    sessionId: string;
    senderName: string;
    isTyping: boolean;
  }) => void;
  "presence:heartbeat": (sessionId: string) => void;
  "recording:start": (sessionId: string) => void;
  "recording:stop": (sessionId: string) => void;
}

// ==========================================
// API Request/Response Types
// ==========================================

export interface CreateSessionRequest {
  title: string;
  description?: string;
}

export interface CreateSessionResponse {
  session: Session;
  joinUrl: string;
}

export interface JoinSessionResponse {
  session: Session;
  roomUrl: string;
}
