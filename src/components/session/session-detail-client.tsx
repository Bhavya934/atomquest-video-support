"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { getSessionJoinUrl, formatTimer } from "@/lib/utils";
import { buildMiroTalkUrl } from "@/lib/mirotalk/api";
import { connectSocket, disconnectSocket } from "@/lib/socket/client";
import type { Session, ChatMessage, SessionEvent } from "@/types";
import {
  Video,
  Copy,
  Check,
  PhoneOff,
  Monitor,
  Users,
  Clock,
  ExternalLink,
  Loader2,
  AlertTriangle,
  Disc,
  Square,
  MessageSquare,
  Activity,
  ChevronDown,
  Star,
  StickyNote,
  Save,
  Paperclip,
  FileText,
  Image as ImageIcon,
  X,
  Download,
} from "lucide-react";

interface Props {
  session: Session;
  agentName: string;
  initialMessages?: ChatMessage[];
  initialEvents?: SessionEvent[];
}

export function SessionDetailClient({
  session: initialSession,
  agentName,
  initialMessages = [],
  initialEvents = [],
}: Props) {
  const [session, setSession] = useState(initialSession);
  const [showVideo, setShowVideo] = useState(false);
  const [copied, setCopied] = useState(false);
  const [ending, setEnding] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // In-call chat states
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [chatOpen, setChatOpen] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [uploading, setUploading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Recording states and refs
  const [recordingStatus, setRecordingStatus] = useState<"idle" | "recording" | "processing" | "ready">(
    (initialSession.recording_status as "idle" | "recording" | "processing" | "ready" | null) || "idle"
  );
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordingStreamRef = useRef<MediaStream | null>(null);

  // Agent notes state
  const [agentNotes, setAgentNotes] = useState<string>(
    (initialSession.metadata as any)?.agentNotes || ""
  );
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesSaved, setNotesSaved] = useState(false);

  const joinUrl = getSessionJoinUrl(session.share_token);

  // Timer for active sessions
  useEffect(() => {
    if (session.status !== "active" || !session.started_at) return;

    const startTime = new Date(session.started_at).getTime();
    const interval = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - startTime) / 1000));
    }, 1000);

    return () => clearInterval(interval);
  }, [session.status, session.started_at]);

  // Customer presence tracking
  const [customerOnline, setCustomerOnline] = useState(session.status === "active");
  const [customerDisconnectCountdown, setCustomerDisconnectCountdown] = useState<number | null>(null);
  const disconnectTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Socket.io for real-time events
  useEffect(() => {
    const socket = connectSocket();

    // Join with role for proper server-side tracking
    socket.emit("session:join", { sessionId: session.id, role: "agent" });

    socket.on("session:customer-joined", (data) => {
      if (data.sessionId === session.id) {
        setSession((prev) => ({
          ...prev,
          status: "active",
          customer_name: data.customerName,
          started_at: new Date().toISOString(),
        }));
        setCustomerOnline(true);
        setCustomerDisconnectCountdown(null);
        if (disconnectTimerRef.current) {
          clearInterval(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
      }
    });

    socket.on("session:ended", (data) => {
      if (data.sessionId === session.id) {
        setSession((prev) => ({
          ...prev,
          status: "ended",
          ended_at: new Date().toISOString(),
        }));
        setCustomerOnline(false);
        setCustomerDisconnectCountdown(null);
        if (disconnectTimerRef.current) {
          clearInterval(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
      }
    });

    // Customer disconnect handling with countdown
    socket.on("session:customer-left", (data) => {
      if (data.sessionId === session.id) {
        setCustomerOnline(false);
        const totalSecs = Math.floor(data.timeoutMs / 1000);
        setCustomerDisconnectCountdown(totalSecs);

        // Start countdown
        if (disconnectTimerRef.current) {
          clearInterval(disconnectTimerRef.current);
        }
        let remaining = totalSecs;
        disconnectTimerRef.current = setInterval(() => {
          remaining -= 1;
          if (remaining <= 0) {
            setCustomerDisconnectCountdown(null);
            if (disconnectTimerRef.current) {
              clearInterval(disconnectTimerRef.current);
              disconnectTimerRef.current = null;
            }
          } else {
            setCustomerDisconnectCountdown(remaining);
          }
        }, 1000);
      }
    });

    // Customer reconnected
    socket.on("session:customer-reconnected", (data) => {
      if (data.sessionId === session.id) {
        setCustomerOnline(true);
        setCustomerDisconnectCountdown(null);
        if (disconnectTimerRef.current) {
          clearInterval(disconnectTimerRef.current);
          disconnectTimerRef.current = null;
        }
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
      if (disconnectTimerRef.current) {
        clearInterval(disconnectTimerRef.current);
      }
      disconnectSocket();
    };
  }, [session.id]);

  // Scroll to bottom of chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatOpen]);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [joinUrl]);

  const startRecording = async () => {
    try {
      setRecordingStatus("processing");
      
      // Capture display screen/tab
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          displaySurface: "browser",
        },
        audio: true,
      });

      // Capture mic audio
      const micStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        },
      }).catch(() => null);

      // Mix audio tracks
      let combinedStream = displayStream;
      let audioContext: AudioContext | null = null;
      let dest: MediaStreamAudioDestinationNode | null = null;

      if (micStream && micStream.getAudioTracks().length > 0) {
        const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        audioContext = new AudioContextClass();
        dest = audioContext.createMediaStreamDestination();

        let hasAudioSource = false;
        
        if (displayStream.getAudioTracks().length > 0) {
          const displayAudioSource = audioContext.createMediaStreamSource(displayStream);
          displayAudioSource.connect(dest);
          hasAudioSource = true;
        }

        const micAudioSource = audioContext.createMediaStreamSource(micStream);
        micAudioSource.connect(dest);
        hasAudioSource = true;

        if (hasAudioSource) {
          const videoTrack = displayStream.getVideoTracks()[0];
          const mixedAudioTrack = dest.stream.getAudioTracks()[0];
          combinedStream = new MediaStream([videoTrack, mixedAudioTrack]);
        }
      }

      recordingStreamRef.current = combinedStream;
      chunksRef.current = [];

      let mimeType = "video/webm;codecs=vp9,opus";
      if (!MediaRecorder.isTypeSupported(mimeType)) {
        mimeType = "video/webm;codecs=vp8,opus";
        if (!MediaRecorder.isTypeSupported(mimeType)) {
          mimeType = "video/webm";
        }
      }

      const mediaRecorder = new MediaRecorder(combinedStream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;

      mediaRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        setRecordingStatus("processing");
        try {
          if (recordingStreamRef.current) {
            recordingStreamRef.current.getTracks().forEach(t => t.stop());
          }
          if (displayStream) {
            displayStream.getTracks().forEach(t => t.stop());
          }
          if (micStream) {
            micStream.getTracks().forEach(t => t.stop());
          }
          if (audioContext) {
            await audioContext.close().catch(() => {});
          }

          const blob = new Blob(chunksRef.current, { type: "video/webm" });
          if (blob.size === 0) {
            throw new Error("Recording is empty");
          }

          const formData = new FormData();
          formData.append("file", blob, `recording-${session.id}.webm`);

          const uploadResponse = await fetch(`/api/sessions/${session.id}/recording`, {
            method: "POST",
            body: formData,
          });

          if (!uploadResponse.ok) {
            throw new Error("Failed to upload recording file");
          }

          const uploadData = await uploadResponse.json();
          
          setSession((prev) => ({
            ...prev,
            recording_status: "ready" as const,
            recording_url: uploadData.url,
          }));
          setRecordingStatus("ready");

        } catch (err) {
          console.error("Error finalizing recording:", err);
          setRecordingStatus("idle");
          await fetch(`/api/sessions/${session.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ recording_status: "idle" }),
          }).catch(() => {});
        }
      };

      displayStream.getVideoTracks()[0].onended = () => {
        if (mediaRecorder.state !== "inactive") {
          mediaRecorder.stop();
          const socket = connectSocket();
          socket.emit("recording:stop", session.id);
        }
      };

      mediaRecorder.start(1000);
      
      const socket = connectSocket();
      socket.emit("recording:start", session.id);
      
      setRecordingStatus("recording");

    } catch (err) {
      console.error("Failed to start tab recording:", err);
      setRecordingStatus("idle");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
      const socket = connectSocket();
      socket.emit("recording:stop", session.id);
    }
  };

  const proceedToEndSession = async (recordingUrl?: string) => {
    setEnding(true);
    try {
      const body: Record<string, string | number | null> = {
        status: "ended",
        ended_at: new Date().toISOString(),
        duration_secs: elapsedSeconds,
      };
      if (recordingUrl) {
        body.recording_url = recordingUrl;
        body.recording_status = "ready";
      }
      
      const response = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const socket = connectSocket();
        socket.emit("session:end", { sessionId: session.id, role: "agent" });

        setSession((prev) => ({
          ...prev,
          status: "ended",
          ended_at: new Date().toISOString(),
          recording_url: recordingUrl || prev.recording_url,
          recording_status: (recordingUrl ? "ready" : prev.recording_status) as Session["recording_status"],
        }));
      }
    } catch (err) {
      console.error("Failed to end session:", err);
    } finally {
      setEnding(false);
    }
  };

  const sendChatMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    const socket = connectSocket();
    socket.emit("chat:send-message", {
      sessionId: session.id,
      senderType: "agent",
      senderName: agentName,
      content: newMessage.trim(),
    });

    setNewMessage("");
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("sessionId", session.id);

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
        senderType: "agent",
        senderName: agentName,
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

  const saveAgentNotes = async () => {
    setSavingNotes(true);
    setNotesSaved(false);
    try {
      const existingMeta = session.metadata && typeof session.metadata === "object" ? session.metadata : {};
      const updatedMeta = {
        ...existingMeta,
        agentNotes: agentNotes.trim(),
      };
      const res = await fetch(`/api/sessions/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ metadata: updatedMeta }),
      });
      if (res.ok) {
        setSession((prev) => ({
          ...prev,
          metadata: updatedMeta,
        }));
        setNotesSaved(true);
        setTimeout(() => setNotesSaved(false), 2000);
      }
    } catch (err) {
      console.error("Failed to save agent notes:", err);
    } finally {
      setSavingNotes(false);
    }
  };

  const handleEndSession = async () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      setRecordingStatus("processing");
      mediaRecorderRef.current.onstop = async () => {
        try {
          if (recordingStreamRef.current) {
            recordingStreamRef.current.getTracks().forEach(t => t.stop());
          }
          const blob = new Blob(chunksRef.current, { type: "video/webm" });
          const formData = new FormData();
          formData.append("file", blob, `recording-${session.id}.webm`);
          const uploadResponse = await fetch(`/api/sessions/${session.id}/recording`, {
            method: "POST",
            body: formData,
          });
          const uploadData = await uploadResponse.json();
          await proceedToEndSession(uploadData.url);
        } catch (err) {
          console.error("Error saving recording on end:", err);
          await proceedToEndSession();
        }
      };
      mediaRecorderRef.current.stop();
      const socket = connectSocket();
      socket.emit("recording:stop", session.id);
    } else {
      await proceedToEndSession();
    }
  };



  const videoUrl = session.room_id
    ? buildMiroTalkUrl({
        roomId: session.room_id,
        userName: agentName,
        isHost: true,
      })
    : null;


  const isEnded = session.status === "ended";

  return (
    <div className="max-w-6xl mx-auto animate-fade-in">
      {/* Session Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-4 mb-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-xl font-bold">{session.title}</h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium ${
                session.status === "active"
                  ? "bg-success-500/15 text-success-400"
                  : session.status === "waiting"
                  ? "bg-warning-500/15 text-warning-400"
                  : "bg-surface-3 text-text-muted"
              }`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  session.status === "active"
                    ? "bg-success-400 animate-pulse"
                    : session.status === "waiting"
                    ? "bg-warning-400 animate-pulse"
                    : "bg-text-muted"
                }`}
              />
              {session.status.charAt(0).toUpperCase() + session.status.slice(1)}
            </span>
          </div>
          {session.description && (
            <p className="text-sm text-text-secondary">{session.description}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {session.status === "active" && (
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-sm">
              <Clock className="w-4 h-4 text-accent-400" />
              <span className="font-mono text-accent-400">
                {formatTimer(elapsedSeconds)}
              </span>
            </div>
          )}
          {!isEnded && (
            <button
              onClick={handleEndSession}
              disabled={ending}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-danger-500/15 text-danger-400 text-sm font-medium hover:bg-danger-500/25 transition-colors disabled:opacity-50"
            >
              {ending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <PhoneOff className="w-4 h-4" />
              )}
              End Session
            </button>
          )}
        </div>
      </div>

      {/* Info Cards */}
      <div className="grid sm:grid-cols-3 gap-4 mb-6">
        {/* Customer */}
        <div className="p-4 rounded-xl bg-surface-1 border border-border">
          <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
            <Users className="w-3.5 h-3.5" />
            Customer
            {session.customer_name && session.status === "active" && (
              <span className={`ml-auto inline-flex items-center gap-1 text-[10px] font-medium ${
                customerOnline ? "text-success-400" : "text-warning-400"
              }`}>
                <span className={`w-1.5 h-1.5 rounded-full ${
                  customerOnline ? "bg-success-400" : "bg-warning-400 animate-pulse"
                }`} />
                {customerOnline ? "Online" : "Disconnected"}
              </span>
            )}
          </div>
          {session.customer_name ? (
            <p className="font-semibold text-sm">{session.customer_name}</p>
          ) : (
            <p className="text-sm text-warning-400">Waiting to join...</p>
          )}
          {customerDisconnectCountdown !== null && (
            <p className="text-xs text-warning-400 mt-1 animate-pulse">
              Auto-ending in {formatTimer(customerDisconnectCountdown)}
            </p>
          )}
        </div>

        {/* Share Link */}
        <div className="p-4 rounded-xl bg-surface-1 border border-border">
          <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
            <ExternalLink className="w-3.5 h-3.5" />
            Share Link
          </div>
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 text-sm text-brand-400 hover:text-brand-300 transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5" />
                Copied!
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                Copy join link
              </>
            )}
          </button>
        </div>

        {/* Room */}
        <div className="p-4 rounded-xl bg-surface-1 border border-border">
          <div className="flex items-center gap-2 text-xs text-text-muted mb-2">
            <Monitor className="w-3.5 h-3.5" />
            Video Room
          </div>
          {session.room_id ? (
            <p className="text-sm font-mono text-xs text-text-secondary truncate">
              {session.room_id}
            </p>
          ) : (
            <p className="text-sm text-text-muted">Not created</p>
          )}
        </div>
      </div>

      {/* Ended notice */}
      {isEnded && (
        <div className="flex items-center gap-3 p-4 rounded-xl bg-surface-1 border border-border mb-6">
          <AlertTriangle className="w-5 h-5 text-warning-400 flex-shrink-0" />
          <div>
            <p className="text-sm font-medium">Session ended</p>
            <p className="text-xs text-text-muted">
              Duration: {session.duration_secs ? formatTimer(session.duration_secs) : "N/A"}
              {session.ended_at &&
                ` • Ended ${new Date(session.ended_at).toLocaleString()}`}
            </p>
          </div>
        </div>
      )}

      {/* Session Event Timeline (ended sessions) */}
      {isEnded && initialEvents.length > 0 && (
        <div className="p-5 rounded-xl bg-surface-1 border border-border mb-6">
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
            <Activity className="w-4 h-4 text-accent-400" />
            Session Timeline
          </h3>
          <div className="space-y-3">
            {initialEvents.map((event) => (
              <div key={event.id} className="flex items-start gap-3">
                <div className="w-2 h-2 rounded-full bg-brand-400 mt-1.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm">
                    <span className="font-medium capitalize">{event.actor}</span>
                    {" — "}
                    <span className="text-text-secondary">
                      {event.event_type === "created" && "Created the session"}
                      {event.event_type === "joined" && `Joined the session${event.metadata?.customerName ? ` as ${event.metadata.customerName}` : ""}`}
                      {event.event_type === "ended" && `Ended the session${event.metadata?.reason === "customer_disconnect_timeout" ? " (auto: customer timeout)" : ""}`}
                      {event.event_type === "status-change" && `Changed status from ${event.metadata?.from} to ${event.metadata?.to}`}
                      {event.event_type === "customer-left" && "Left the call"}
                      {event.event_type === "disconnected" && "Disconnected"}
                      {event.event_type === "reconnected" && "Reconnected"}
                      {event.event_type === "recording-started" && "Started recording"}
                      {event.event_type === "recording-stopped" && "Stopped recording"}
                    </span>
                  </p>
                  <p className="text-[10px] text-text-muted mt-0.5">
                    {new Date(event.created_at).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Chat History (ended sessions) */}
      {isEnded && (
        <div className="p-5 rounded-xl bg-surface-1 border border-border mb-6">
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
            <MessageSquare className="w-4 h-4 text-brand-400" />
            Chat Transcript {messages.length > 0 && `(${messages.length} messages)`}
          </h3>
          {messages.length > 0 ? (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-2">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col gap-0.5 p-2.5 rounded-lg text-sm ${
                    msg.sender_type === "agent"
                      ? "bg-brand-500/10 border border-brand-500/20 ml-8"
                      : msg.sender_type === "system"
                      ? "bg-surface-2 border border-border mx-4 text-center"
                      : "bg-surface-2 border border-border mr-8"
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
                          <img src={msg.file_url} alt={msg.file_name} className="max-w-[200px] max-h-[150px] rounded-lg border border-border object-cover" />
                        </a>
                      ) : (
                        <a
                          href={msg.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-surface-3 border border-border text-xs text-brand-400 hover:text-brand-300 transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span className="truncate max-w-[150px]">{msg.file_name}</span>
                          <Download className="w-3 h-3 flex-shrink-0" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-6">
              <MessageSquare className="w-8 h-8 text-text-muted mx-auto mb-2 opacity-30" />
              <p className="text-sm text-text-muted">No chat messages were exchanged during this session.</p>
            </div>
          )}
        </div>
      )}

      {/* Recording Display */}
      {isEnded && session.recording_status !== "idle" && (
        <div className="p-6 rounded-xl bg-surface-1 border border-border mb-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-base flex items-center gap-2">
                <span className="relative flex h-2.5 w-2.5">
                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${session.recording_status === 'ready' ? 'bg-success-400' : 'bg-warning-400'}`}></span>
                  <span className={`relative inline-flex rounded-full h-2.5 w-2.5 ${session.recording_status === 'ready' ? 'bg-success-500' : 'bg-warning-500'}`}></span>
                </span>
                Call Recording
              </h3>
              <p className="text-xs text-text-secondary">
                {session.recording_status === "ready"
                  ? "Recording is ready for playback and download."
                  : "Recording is currently processing. Please refresh in a moment."}
              </p>
            </div>
            {session.recording_status === "ready" && session.recording_url && (
              <a
                href={session.recording_url}
                download={`recording-${session.id}.webm`}
                className="px-4 py-2 rounded-lg gradient-brand text-white text-sm font-medium hover:opacity-90 transition-all flex items-center gap-2"
              >
                Download WebM
              </a>
            )}
          </div>
          {session.recording_status === "ready" && session.recording_url && (
            <div className="aspect-video w-full max-w-2xl mx-auto rounded-lg overflow-hidden border border-border bg-black shadow-inner">
              <video
                src={session.recording_url}
                controls
                className="w-full h-full"
              />
            </div>
          )}
        </div>
      )}

      {/* Customer Feedback Display (ended sessions) */}
      {isEnded && (session.metadata as any)?.feedback && (
        <div className="p-5 rounded-xl bg-surface-1 border border-border mb-6">
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-4">
            <Star className="w-4 h-4 text-warning-400" />
            Customer Feedback
          </h3>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-5 h-5 ${
                    star <= ((session.metadata as any)?.feedback?.rating || 0)
                      ? "text-warning-400 fill-warning-400"
                      : "text-text-muted"
                  }`}
                />
              ))}
            </div>
            <span className="text-sm font-medium">
              {(session.metadata as any)?.feedback?.rating}/5
            </span>
            {(session.metadata as any)?.feedback?.customerName && (
              <span className="text-xs text-text-muted ml-auto">
                by {(session.metadata as any)?.feedback?.customerName}
              </span>
            )}
          </div>
          {(session.metadata as any)?.feedback?.comment && (
            <p className="mt-3 text-sm text-text-secondary bg-surface-2 rounded-lg p-3 border border-border/50">
              &ldquo;{(session.metadata as any)?.feedback?.comment}&rdquo;
            </p>
          )}
        </div>
      )}

      {/* Agent Notes (ended sessions) */}
      {isEnded && (
        <div className="p-5 rounded-xl bg-surface-1 border border-border mb-6">
          <h3 className="font-semibold text-sm flex items-center gap-2 mb-3">
            <StickyNote className="w-4 h-4 text-accent-400" />
            Agent Notes
          </h3>
          <textarea
            value={agentNotes}
            onChange={(e) => setAgentNotes(e.target.value)}
            placeholder="Add post-call notes, follow-up actions, resolution summary..."
            rows={4}
            className="w-full px-4 py-3 rounded-lg text-sm bg-surface-2 border border-border focus:border-brand-500 text-white placeholder:text-text-muted resize-none mb-3"
          />
          <div className="flex items-center gap-3">
            <button
              onClick={saveAgentNotes}
              disabled={savingNotes}
              className="flex items-center gap-2 px-4 py-2 rounded-lg gradient-brand text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {savingNotes ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : notesSaved ? (
                <>
                  <Check className="w-4 h-4" />
                  Saved!
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Notes
                </>
              )}
            </button>
            {notesSaved && (
              <span className="text-xs text-success-400">Notes saved successfully</span>
            )}
          </div>
        </div>
      )}

      {/* Video Controls */}
      {!isEnded && (
        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setShowVideo(!showVideo)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${
              showVideo
                ? "gradient-brand text-white"
                : "bg-surface-2 border border-border text-text-secondary hover:text-text-primary"
            }`}
          >
            <Video className="w-4 h-4" />
            {showVideo ? "Hide Video" : "Join Video"}
          </button>
          {showVideo && (
            <button
              onClick={recordingStatus === "recording" ? stopRecording : startRecording}
              disabled={recordingStatus === "processing"}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all disabled:opacity-50 ${
                recordingStatus === "recording"
                  ? "bg-danger-500 text-white hover:bg-danger-600 animate-pulse"
                  : "bg-surface-2 border border-border text-text-secondary hover:text-text-primary"
              }`}
            >
              {recordingStatus === "processing" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : recordingStatus === "recording" ? (
                <>
                  <Square className="w-4 h-4" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Disc className="w-4 h-4" />
                  Start Recording
                </>
              )}
            </button>
          )}
        </div>
      )}

      {/* Video Room (Unified Responsive Container) */}
      {showVideo && videoUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-surface-0 md:relative md:inset-auto md:z-auto md:w-full md:rounded-2xl md:overflow-hidden md:bg-surface-1 md:border md:border-border md:h-[65vh] md:lg:h-[78vh] md:flex-initial animate-fade-in">
          {/* Mobile-Only Header */}
          <header className="h-14 bg-surface-1 border-b border-border flex items-center px-4 gap-2 flex-shrink-0 md:hidden">
            <div className="flex-1 min-w-0">
              <h1 className="text-sm font-bold truncate">{session.title}</h1>
              {session.status === "active" && (
                <span className="text-xs font-mono text-accent-400">
                  {formatTimer(elapsedSeconds)}
                </span>
              )}
            </div>
            {/* End Session Button */}
            {!isEnded && (
              <button
                onClick={handleEndSession}
                disabled={ending}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-danger-500/15 text-danger-400 text-xs font-medium hover:bg-danger-500/25 transition-colors disabled:opacity-50 flex-shrink-0 cursor-pointer"
              >
                {ending ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <PhoneOff className="w-3.5 h-3.5" />
                )}
                End
              </button>
            )}
            {/* Hide Video Button */}
            <button
              onClick={() => setShowVideo(false)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-2 border border-border text-text-secondary text-xs font-medium hover:text-text-primary flex-shrink-0 cursor-pointer"
            >
              <Video className="w-3.5 h-3.5" />
              Hide
            </button>
          </header>

          {/* MiroTalk Iframe */}
          <div className="flex-1 relative overflow-hidden bg-black md:w-full md:h-full">
            {recordingStatus === "recording" && (
              <div className="absolute top-4 left-4 z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-danger-500/80 backdrop-blur-sm text-white text-xs font-semibold animate-pulse shadow-lg">
                <span className="w-2.5 h-2.5 rounded-full bg-white animate-ping" />
                Recording
              </div>
            )}
            <iframe
              src={videoUrl}
              allow="camera; microphone; display-capture; fullscreen; clipboard-read; clipboard-write; autoplay"
              className="w-full h-full border-0"
              title="Video Call"
            />
          </div>

          {/* Mobile-Only Recording Controls (Footer) */}
          <div className="p-3 bg-surface-1 border-t border-border flex items-center justify-between gap-2 flex-shrink-0 md:hidden">
            <button
              onClick={recordingStatus === "recording" ? stopRecording : startRecording}
              disabled={recordingStatus === "processing"}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-xs font-medium transition-all disabled:opacity-50 cursor-pointer ${
                recordingStatus === "recording"
                  ? "bg-danger-500 text-white hover:bg-danger-600 animate-pulse"
                  : "bg-surface-2 border border-border text-text-secondary"
              }`}
            >
              {recordingStatus === "processing" ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  Processing...
                </>
              ) : recordingStatus === "recording" ? (
                <>
                  <Square className="w-3.5 h-3.5" />
                  Stop Recording
                </>
              ) : (
                <>
                  <Disc className="w-3.5 h-3.5" />
                  Start Recording
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* In-Call Floating Chat Panel (Active Sessions) */}
      {!isEnded && (
        <>
          {/* Chat Toggle Button */}
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

          {/* Chat Panel */}
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
                      msg.sender_type === "agent"
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
                    Send
                  </button>
                </div>
              </form>
            </div>
          )}
        </>
      )}
    </div>
  );
}
