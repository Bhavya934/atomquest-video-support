"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { buildMiroTalkUrl } from "@/lib/mirotalk/api";
import { connectSocket, disconnectSocket } from "@/lib/socket/client";
import type { Session, ChatMessage } from "@/types";
import {
  Video,
  User,
  ArrowRight,
  Loader2,
  Sparkles,
  Shield,
  PhoneOff,
  AlertCircle,
  MessageSquare,
  Star,
  CheckCircle2,
  ChevronDown,
  Send,
  Paperclip,
  FileText,
  Download,
} from "lucide-react";

interface Props {
  shareToken: string;
}

export function CustomerJoinClient({ shareToken }: Props) {
  const [session, setSession] = useState<Session | null>(null);
  const [customerName, setCustomerName] = useState("");
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [joined, setJoined] = useState(false);
  const [error, setError] = useState("");

  // Post-call feedback states
  const [feedbackRating, setFeedbackRating] = useState(0);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  // In-call chat states
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatOpen, setChatOpen] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Fetch session by share token
  useEffect(() => {
    const fetchSession = async () => {
      try {
        const response = await fetch(`/api/sessions/${shareToken}`);
        const data = await response.json();

        if (!response.ok || !data.session) {
          setError(data.error || "Session not found or has expired.");
          return;
        }

        if (data.session.status === "ended") {
          setError("This session has already ended.");
          return;
        }

        setSession(data.session as Session);
        if (data.messages) {
          setMessages(data.messages);
        }
      } catch {
        setError("Failed to load session.");
      } finally {
        setLoading(false);
      }
    };

    fetchSession();
  }, [shareToken]);

  // Socket.io for real-time events once joined
  useEffect(() => {
    if (!joined || !session) return;

    const socket = connectSocket();
    // Join with role for proper server-side tracking
    socket.emit("session:join", { sessionId: session.id, role: "customer" });

    socket.on("session:ended", () => {
      setSession((prev) =>
        prev ? { ...prev, status: "ended" } : null
      );
    });

    socket.on("recording:start", (data) => {
      if (data.sessionId === session.id) {
        setSession((prev) =>
          prev ? { ...prev, recording_status: "recording" } : null
        );
      }
    });

    socket.on("recording:stop", (data) => {
      if (data.sessionId === session.id) {
        setSession((prev) =>
          prev ? { ...prev, recording_status: "processing" } : null
        );
      }
    });

    // Chat messages
    socket.on("chat:new-message", (msg) => {
      setMessages((prev) => {
        if (prev.some((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    });

    return () => {
      socket.emit("session:leave", session.id);
      disconnectSocket();
    };
  }, [joined, session?.id]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatOpen]);

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!session || !customerName.trim()) return;

    setJoining(true);
    try {
      // Update session with customer info
      const response = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          customer_name: customerName.trim(),
          status: "active",
          share_token: shareToken,
        }),
      });

      if (!response.ok) {
        setError("Failed to join call. Please try again.");
        return;
      }

      // Notify agent via socket
      const socket = connectSocket();
      socket.emit("session:customer-joined", {
        sessionId: session.id,
        customerName: customerName.trim(),
      });

      setSession((prev) =>
        prev
          ? { ...prev, customer_name: customerName.trim(), status: "active" as const }
          : null
      );
      setJoined(true);
    } catch {
      setError("Failed to join session. Please try again.");
    } finally {
      setJoining(false);
    }
  };

  // Customer leaves the call (session stays active for agent, timeout starts)
  const handleLeaveCall = () => {
    if (!session) return;
    const socket = connectSocket();
    socket.emit("session:customer-leave", { sessionId: session.id });
    socket.emit("session:leave", session.id);
    disconnectSocket();
    setSession((prev) =>
      prev ? { ...prev, status: "ended" } : null
    );
  };

  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || !session) return;

    const socket = connectSocket();
    socket.emit("chat:send-message", {
      sessionId: session.id,
      senderType: "customer",
      senderName: customerName,
      content: newMessage.trim(),
    });

    setNewMessage("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !session) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sessionId", session.id);
      formData.append("shareToken", shareToken);

      const res = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        const err = await res.json();
        console.error("Upload failed:", err.error);
        return;
      }

      const data = await res.json();

      const socket = connectSocket();
      socket.emit("chat:send-message", {
        sessionId: session.id,
        senderType: "customer",
        senderName: customerName,
        content: `📎 ${data.name}`,
        fileUrl: data.url,
        fileName: data.name,
      });
    } catch (err) {
      console.error("File upload error:", err);
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const isImageFile = (fileName: string) => {
    return /\.(png|jpe?g|gif|webp)$/i.test(fileName);
  };

  const submitFeedback = async () => {
    if (!session || feedbackRating === 0) return;
    setSubmittingFeedback(true);
    try {
      // Merge feedback into existing metadata
      const existingMeta = session.metadata && typeof session.metadata === "object" ? session.metadata : {};
      const updatedMeta = {
        ...existingMeta,
        feedback: {
          rating: feedbackRating,
          comment: feedbackComment.trim() || null,
          customerName: customerName,
          submittedAt: new Date().toISOString(),
        },
      };
      await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          share_token: shareToken,
          metadata: updatedMeta,
        }),
      });
      setFeedbackSubmitted(true);
    } catch (err) {
      console.error("Failed to submit feedback:", err);
    } finally {
      setSubmittingFeedback(false);
    }
  };


  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-brand-400 animate-spin" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="text-center max-w-md animate-fade-in">
          <div className="w-16 h-16 rounded-2xl bg-danger-500/15 mx-auto flex items-center justify-center mb-4">
            <AlertCircle className="w-8 h-8 text-danger-400" />
          </div>
          <h1 className="text-xl font-bold mb-2">Session Unavailable</h1>
          <p className="text-text-secondary text-sm">{error}</p>
        </div>
      </div>
    );
  }

  // Session ended after joining — show feedback form
  if (session?.status === "ended" && joined) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4">
        <div className="fixed inset-0 bg-grid opacity-10 pointer-events-none" />
        <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />
        <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-accent-500/8 rounded-full blur-3xl pointer-events-none" />

        <div className="relative w-full max-w-md animate-fade-in">
          {feedbackSubmitted ? (
            /* Thank-you screen after submitting */
            <div className="text-center">
              <div className="w-16 h-16 rounded-2xl bg-success-500/15 mx-auto flex items-center justify-center mb-4">
                <CheckCircle2 className="w-8 h-8 text-success-400" />
              </div>
              <h1 className="text-xl font-bold mb-2">Thank You!</h1>
              <p className="text-text-secondary text-sm">
                Your feedback has been submitted. We appreciate your time!
              </p>
              <div className="flex items-center justify-center gap-1 mt-3">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-5 h-5 ${
                      star <= feedbackRating
                        ? "text-warning-400 fill-warning-400"
                        : "text-text-muted"
                    }`}
                  />
                ))}
              </div>
            </div>
          ) : (
            /* Feedback form */
            <>
              <div className="text-center mb-6">
                <div className="w-14 h-14 rounded-2xl bg-surface-2 mx-auto flex items-center justify-center mb-3">
                  <PhoneOff className="w-7 h-7 text-text-muted" />
                </div>
                <h1 className="text-xl font-bold mb-1">Session Ended</h1>
                <p className="text-text-secondary text-sm">
                  How was your support experience?
                </p>
              </div>

              <div className="glass-strong rounded-2xl p-6 space-y-5">
                {/* Star Rating */}
                <div>
                  <label className="block text-sm font-medium text-text-secondary mb-3 text-center">
                    Rate your experience
                  </label>
                  <div className="flex items-center justify-center gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        onClick={() => setFeedbackRating(star)}
                        className="p-1 rounded-lg hover:bg-surface-2 transition-all hover:scale-110 cursor-pointer"
                      >
                        <Star
                          className={`w-8 h-8 transition-colors ${
                            star <= feedbackRating
                              ? "text-warning-400 fill-warning-400"
                              : "text-text-muted hover:text-warning-300"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                  {feedbackRating > 0 && (
                    <p className="text-center text-xs text-text-muted mt-2">
                      {feedbackRating === 1 && "Poor"}
                      {feedbackRating === 2 && "Fair"}
                      {feedbackRating === 3 && "Good"}
                      {feedbackRating === 4 && "Very Good"}
                      {feedbackRating === 5 && "Excellent!"}
                    </p>
                  )}
                </div>

                {/* Comment */}
                <div className="space-y-1.5">
                  <label htmlFor="feedbackComment" className="block text-sm font-medium text-text-secondary">
                    Comments (optional)
                  </label>
                  <textarea
                    id="feedbackComment"
                    value={feedbackComment}
                    onChange={(e) => setFeedbackComment(e.target.value)}
                    placeholder="Any additional feedback..."
                    rows={3}
                    className="w-full px-4 py-2.5 rounded-lg text-sm bg-surface-2 border border-border focus:border-brand-500 text-white placeholder:text-text-muted resize-none"
                  />
                </div>

                {/* Submit */}
                <button
                  onClick={submitFeedback}
                  disabled={feedbackRating === 0 || submittingFeedback}
                  className="w-full flex items-center justify-center gap-2 py-3 rounded-xl gradient-brand text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submittingFeedback ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Submit Feedback"
                  )}
                </button>

                {/* Skip */}
                <button
                  onClick={() => setFeedbackSubmitted(true)}
                  className="w-full text-center text-xs text-text-muted hover:text-text-secondary transition-colors py-1"
                >
                  Skip
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  // Joined state — show video
  if (joined && session?.room_id) {
    const videoUrl = buildMiroTalkUrl({
      roomId: session.room_id,
      userName: customerName,
      isHost: false,
    });

    return (
      <div className="fixed inset-0 flex flex-col bg-surface-0 z-50">
        {/* Top bar */}
        <header className="h-14 bg-surface-1 border-b border-border flex items-center px-4 gap-3 flex-shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-md gradient-brand flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="text-sm font-bold text-gradient hidden sm:inline-block">AtomQuest</span>
          </div>
          <div className="h-5 w-px bg-border mx-2 hidden sm:block" />
          <p className="text-sm text-text-secondary truncate flex-1 min-w-0">{session.title}</p>
          <button
            onClick={handleLeaveCall}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger-500/15 text-danger-400 text-xs font-medium hover:bg-danger-500/25 transition-colors flex-shrink-0"
          >
            <PhoneOff className="w-3.5 h-3.5" />
            Leave Call
          </button>
        </header>

        {/* Full-viewport MiroTalk Video Room */}
        <div className="flex-1 relative overflow-hidden">
          {session.recording_status === "recording" && (
            <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-danger-500/80 backdrop-blur-sm text-white text-xs font-semibold animate-pulse shadow-lg">
              <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
              Recording
            </div>
          )}
          <iframe
            src={videoUrl}
            allow="camera; microphone; display-capture; fullscreen; clipboard-read; clipboard-write; autoplay"
            style={{ width: "100%", height: "100%", border: "none" }}
            title="Video Call"
          />
        </div>

        {/* Floating Chat Toggle Button */}
        <button
          onClick={() => setChatOpen(!chatOpen)}
          className={`fixed bottom-6 right-6 z-[60] flex items-center justify-center w-14 h-14 rounded-full shadow-lg transition-all hover:scale-105 cursor-pointer ${
            chatOpen
              ? "gradient-brand text-white"
              : "bg-surface-1 border border-border text-brand-400 hover:border-brand-500"
          }`}
        >
          <MessageSquare className="w-6 h-6" />
          {messages.length > 0 && !chatOpen && (
            <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-danger-500 text-white text-[10px] font-bold flex items-center justify-center">
              {messages.length}
            </span>
          )}
        </button>

        {/* Floating Chat Panel */}
        {chatOpen && (
          <div className="fixed bottom-24 right-6 z-[60] w-80 sm:w-96 max-h-[60vh] rounded-2xl bg-surface-1 border border-border shadow-2xl flex flex-col animate-fade-in overflow-hidden">
            {/* Chat Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface-2/50">
              <div className="flex items-center gap-2">
                <MessageSquare className="w-4 h-4 text-brand-400" />
                <span className="text-sm font-semibold">Chat</span>
                <span className="text-[10px] text-text-muted">({messages.length})</span>
              </div>
              <button
                onClick={() => setChatOpen(false)}
                className="p-1 rounded-md hover:bg-surface-3 transition-colors text-text-muted hover:text-text-primary cursor-pointer"
              >
                <ChevronDown className="w-4 h-4" />
              </button>
            </div>

            {/* Messages List */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 min-h-[200px] max-h-[40vh]">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <MessageSquare className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-40" />
                  <p className="text-xs text-text-muted">No messages yet</p>
                </div>
              )}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-0.5 p-2.5 rounded-lg text-sm ${
                    msg.sender_type === "customer"
                      ? "bg-brand-500/10 border border-brand-500/20 ml-6"
                      : msg.sender_type === "system"
                      ? "bg-surface-2 border border-border mx-4 text-center"
                      : "bg-surface-2 border border-border mr-6"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-medium text-text-secondary">
                      {msg.sender_name}
                      <span className="text-[10px] text-text-muted ml-1">({msg.sender_type})</span>
                    </span>
                    <span className="text-[10px] text-text-muted flex-shrink-0">
                      {new Date(msg.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-text-primary">{msg.content}</p>
                  {msg.file_url && (
                    <div className="mt-1.5">
                      {msg.file_name && isImageFile(msg.file_name) ? (
                        <a href={msg.file_url} target="_blank" rel="noopener noreferrer">
                          <img src={msg.file_url} alt={msg.file_name} className="max-w-[180px] max-h-[120px] rounded-lg border border-border object-cover" />
                        </a>
                      ) : (
                        <a
                          href={msg.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md bg-surface-3 border border-border text-[11px] text-brand-400 hover:text-brand-300 transition-colors"
                        >
                          <FileText className="w-3 h-3" />
                          <span className="truncate max-w-[120px]">{msg.file_name}</span>
                          <Download className="w-2.5 h-2.5 flex-shrink-0" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Message Input */}
            <form onSubmit={sendChatMessage} className="p-3 border-t border-border bg-surface-2/30">
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                accept=".png,.jpg,.jpeg,.gif,.webp,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv"
                onChange={handleFileUpload}
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploading}
                  className="flex items-center justify-center w-9 h-9 rounded-lg bg-surface-2 border border-border text-text-muted hover:text-brand-400 hover:border-brand-500 transition-colors disabled:opacity-50 cursor-pointer flex-shrink-0"
                  title="Upload file"
                >
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Paperclip className="w-4 h-4" />}
                </button>
                <input
                  type="text"
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  placeholder="Type a message..."
                  className="flex-1 px-3 py-2 rounded-lg text-sm bg-surface-2 border border-border focus:border-brand-500 text-white placeholder:text-text-muted"
                />
                <button
                  type="submit"
                  disabled={!newMessage.trim()}
                  className="px-3 py-2 rounded-lg gradient-brand text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </form>
          </div>
        )}
      </div>
    );
  }

  // Join form
  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="fixed inset-0 bg-grid opacity-10 pointer-events-none" />
      <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-accent-500/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl gradient-brand mx-auto flex items-center justify-center mb-3">
            <Sparkles className="w-7 h-7 text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-1">Join Support Session</h1>
          <p className="text-text-secondary text-sm">
            You&apos;ve been invited to a video support call
          </p>
        </div>

        {/* Session info */}
        <div className="glass-strong rounded-2xl p-6">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-2 border border-border mb-6">
            <div className="w-10 h-10 rounded-lg bg-brand-500/15 flex items-center justify-center">
              <Video className="w-5 h-5 text-brand-400" />
            </div>
            <div>
              <p className="font-semibold text-sm">{session?.title}</p>
              <p className="text-xs text-text-muted">
                Support session • {session?.status === "waiting" ? "Ready to join" : "In progress"}
              </p>
            </div>
          </div>

          <form onSubmit={handleJoin} className="space-y-4">
            <div className="space-y-1.5">
              <label htmlFor="customerName" className="block text-sm font-medium text-text-secondary">
                Your Name
              </label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
                <input
                  id="customerName"
                  type="text"
                  value={customerName}
                  onChange={(e) => setCustomerName(e.target.value)}
                  placeholder="Enter your name"
                  required
                  autoFocus
                  className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={joining || !customerName.trim()}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl gradient-brand text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {joining ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  Join Call
                  <ArrowRight className="w-5 h-5" />
                </>
              )}
            </button>
          </form>

          <div className="flex items-center gap-2 mt-4 text-xs text-text-muted">
            <Shield className="w-3.5 h-3.5" />
            <span>No account needed • Browser-based • Encrypted</span>
          </div>
        </div>
      </div>
    </div>
  );
}
