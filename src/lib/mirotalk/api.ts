// ==========================================
// MiroTalk SFU — REST API Wrapper
// ==========================================

const MIROTALK_URL = process.env.NEXT_PUBLIC_MIROTALK_URL || "http://localhost:3010";
const MIROTALK_API_KEY = process.env.MIROTALK_API_KEY || "";

interface MiroTalkMeetingResponse {
  meeting: string;
}

/**
 * Create a new MiroTalk SFU room via REST API
 */
export async function createMiroTalkRoom(roomId: string): Promise<string> {
  try {
    const res = await fetch(`${MIROTALK_URL}/api/v1/meeting`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        authorization: MIROTALK_API_KEY,
      },
      body: JSON.stringify({ room: roomId }),
    });

    if (!res.ok) {
      throw new Error(`MiroTalk API error: ${res.status} ${res.statusText}`);
    }

    const data: MiroTalkMeetingResponse = await res.json();
    return data.meeting;
  } catch (error) {
    console.error("Failed to create MiroTalk room:", error);
    // Fallback: construct URL directly (MiroTalk creates rooms on-demand)
    return `${MIROTALK_URL}/join/${roomId}`;
  }
}

/**
 * Build the MiroTalk iframe URL with customization parameters
 */
export function buildMiroTalkUrl(options: {
  roomId: string;
  userName: string;
  isHost: boolean;
  audioEnabled?: boolean;
  videoEnabled?: boolean;
}): string {
  const { roomId, userName, isHost, audioEnabled = true, videoEnabled = true } = options;

  const params = new URLSearchParams({
    room: roomId,
    name: userName,
    audio: audioEnabled ? "1" : "0",
    video: videoEnabled ? "1" : "0",
    chat: "0",
    notify: "0",
  });

  // Host token gives agents elevated controls (mute others, kick, record)
  if (isHost) {
    params.set("isPresenter", "1");
  }

  let baseUrl = MIROTALK_URL;
  if (typeof window !== "undefined") {
    try {
      const urlObj = new URL(MIROTALK_URL);
      urlObj.hostname = window.location.hostname;
      baseUrl = urlObj.toString().replace(/\/$/, "");
    } catch (e) {
      console.error("Failed to parse MiroTalk base URL:", e);
    }
  }

  return `${baseUrl}/join?${params.toString()}`;
}

/**
 * Check if MiroTalk SFU server is reachable
 */
export async function checkMiroTalkHealth(): Promise<boolean> {
  try {
    const res = await fetch(MIROTALK_URL, {
      method: "HEAD",
      signal: AbortSignal.timeout(3000),
    });
    return res.ok;
  } catch {
    return false;
  }
}
