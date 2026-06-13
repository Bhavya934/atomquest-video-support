"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getSessionJoinUrl } from "@/lib/utils";
import QRCode from "qrcode";
import {
  Video,
  FileText,
  ArrowRight,
  Loader2,
  Copy,
  Check,
  ExternalLink,
  QrCode,
} from "lucide-react";

export default function NewSessionPage() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [createdSession, setCreatedSession] = useState<{
    id: string;
    share_token: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);
  const [qrCodeUrl, setQrCodeUrl] = useState("");

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/sessions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, description }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create session");
        return;
      }

      setCreatedSession({
        id: data.session.id,
        share_token: data.session.share_token,
      });

      // Generate QR Code URL
      const joinUrl = getSessionJoinUrl(data.session.share_token);
      const qrDataUrl = await QRCode.toDataURL(joinUrl, {
        margin: 2,
        width: 200,
        color: {
          dark: "#ffffff",
          light: "#1e1b4b", // deep indigo
        },
      });
      setQrCodeUrl(qrDataUrl);
    } catch (err: any) {
      console.error(err);
      setError("Failed to create session. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const joinUrl = createdSession
    ? getSessionJoinUrl(createdSession.share_token)
    : "";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // === Success State: Show Link ===
  if (createdSession) {
    return (
      <div className="max-w-lg mx-auto animate-fade-in">
        <div className="text-center mb-8">
          <div className="w-16 h-16 rounded-2xl gradient-brand mx-auto flex items-center justify-center mb-4">
            <Check className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Session Created!</h1>
          <p className="text-text-secondary">
            Share the link below with your customer to start the video call.
          </p>
        </div>

        {/* Share link card */}
        <div className="p-6 rounded-2xl bg-surface-1 border border-border space-y-4">
          <label className="block text-sm font-medium text-text-secondary">
            Customer Join Link
          </label>
          <div className="flex gap-2">
            <input
              type="text"
              value={joinUrl}
              readOnly
              className="flex-1 px-3 py-2.5 rounded-lg text-sm bg-surface-2 border border-border font-mono text-xs text-white"
            />
            <button
              onClick={handleCopy}
              className="flex items-center gap-2 px-4 py-2.5 rounded-lg gradient-brand text-white text-sm font-medium hover:opacity-90 transition-opacity flex-shrink-0 cursor-pointer"
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4" />
                  Copied
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  Copy
                </>
              )}
            </button>
          </div>

          {/* QR Code */}
          {qrCodeUrl && (
            <div className="flex flex-col items-center gap-3 p-4 rounded-lg bg-surface-2 border border-border">
              <img src={qrCodeUrl} alt="QR Code" className="w-32 h-32 rounded-lg border border-border bg-indigo-950" />
              <div className="text-center">
                <p className="text-sm font-medium">QR Code</p>
                <p className="text-xs text-text-muted">
                  Customer can scan this to join on mobile
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={() => router.push(`/sessions/${createdSession.id}`)}
            className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl gradient-brand text-white font-medium hover:opacity-90 transition-opacity cursor-pointer"
          >
            <Video className="w-5 h-5" />
            Go to Session
          </button>
          <button
            onClick={() => {
              setCreatedSession(null);
              setTitle("");
              setDescription("");
              setQrCodeUrl("");
            }}
            className="px-4 py-3 rounded-xl bg-surface-2 border border-border text-text-secondary hover:text-text-primary hover:bg-surface-3 transition-all cursor-pointer"
          >
            <ExternalLink className="w-5 h-5" />
          </button>
        </div>
      </div>
    );
  }

  // === Create Form ===
  return (
    <div className="max-w-lg mx-auto animate-fade-in">
      <div className="text-center mb-8">
        <div className="w-16 h-16 rounded-2xl gradient-brand mx-auto flex items-center justify-center mb-4 animate-float">
          <Video className="w-8 h-8 text-white" />
        </div>
        <h1 className="text-2xl font-bold mb-2">Create New Session</h1>
        <p className="text-text-secondary">
          Set up a video support session and share the link with your customer.
        </p>
      </div>

      <form onSubmit={handleCreate} className="space-y-5">
        {error && (
          <div className="p-3 rounded-lg bg-danger-500/10 border border-danger-500/20 text-danger-400 text-sm animate-fade-in">
            {error}
          </div>
        )}

        {/* Title */}
        <div className="space-y-1.5">
          <label htmlFor="title" className="block text-sm font-medium text-text-secondary">
            Session Title <span className="text-danger-400">*</span>
          </label>
          <div className="relative">
            <Video className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-text-muted" />
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g., Billing Issue #4521"
              required
              className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm bg-surface-2 border border-border focus:border-brand-500 text-white"
            />
          </div>
        </div>

        {/* Description */}
        <div className="space-y-1.5">
          <label htmlFor="description" className="block text-sm font-medium text-text-secondary">
            Description <span className="text-text-muted">(optional)</span>
          </label>
          <div className="relative">
            <FileText className="absolute left-3 top-3 w-4 h-4 text-text-muted" />
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief notes about this support session..."
              rows={3}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg text-sm resize-none bg-surface-2 border border-border focus:border-brand-500 text-white"
            />
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={loading || !title.trim()}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl gradient-brand text-white font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
        >
          {loading ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <>
              Create Session
              <ArrowRight className="w-5 h-5" />
            </>
          )}
        </button>
      </form>
    </div>
  );
}
