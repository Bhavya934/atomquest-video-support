// ==========================================
// Custom Server: Next.js + Socket.io
// ==========================================

const { createServer } = require("http");
const { Server } = require("socket.io");
const next = require("next");
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const dev = process.env.NODE_ENV !== "production";
const hostname = "localhost";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handler = app.getRequestHandler();

// ==========================================
// Session Tracking Maps
// ==========================================
// socketId → { sessionId, role }
const socketSessionMap = new Map();
// sessionId → { agent: Set<socketId>, customer: Set<socketId> }
const sessionParticipants = new Map();

// sessionId → disconnect timeout handle
const customerDisconnectTimers = new Map();

const CUSTOMER_DISCONNECT_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes

// Expose live socket metrics to Next.js via global object
global.getSocketMetrics = () => {
  let activeSessions = 0;
  for (const [_, p] of sessionParticipants.entries()) {
    if (p.agent.size > 0 || p.customer.size > 0) {
      activeSessions++;
    }
  }
  return {
    activeSocketSessions: activeSessions,
    totalConnectedSockets: socketSessionMap.size,
  };
};

// ==========================================
// Helper: Log SessionEvent to DB
// ==========================================
async function logSessionEvent(sessionId, eventType, actor, metadata = null) {
  try {
    await prisma.sessionEvent.create({
      data: {
        sessionId,
        eventType,
        actor,
        metadata: metadata ? JSON.stringify(metadata) : null,
      },
    });
    console.log(`[SessionEvent] ${eventType} by ${actor} for session ${sessionId}`);
  } catch (err) {
    console.error(`[SessionEvent] Failed to log ${eventType}:`, err);
  }
}

// ==========================================
// Helper: Get participants for a session
// ==========================================
function getOrCreateParticipants(sessionId) {
  if (!sessionParticipants.has(sessionId)) {
    sessionParticipants.set(sessionId, {
      agent: new Set(),
      customer: new Set(),
    });
  }
  return sessionParticipants.get(sessionId);
}

app.prepare().then(() => {
  const httpServer = createServer(handler);

  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
    transports: ["websocket", "polling"],
  });

  // ==========================================
  // Socket.io Event Handlers
  // ==========================================
  io.on("connection", (socket) => {
    console.log(`[Socket.io] Client connected: ${socket.id}`);

    // --- Session Room Management (role-aware) ---
    socket.on("session:join", (data) => {
      // Support both old format (just sessionId string) and new format ({ sessionId, role })
      let sessionId, role;
      if (typeof data === "string") {
        sessionId = data;
        role = "unknown";
      } else {
        sessionId = data.sessionId;
        role = data.role || "unknown";
      }

      socket.join(`session:${sessionId}`);
      socketSessionMap.set(socket.id, { sessionId, role });

      const participants = getOrCreateParticipants(sessionId);
      if (role === "agent") {
        participants.agent.add(socket.id);
      } else if (role === "customer") {
        participants.customer.add(socket.id);

        // Cancel any pending disconnect timer (customer reconnected)
        if (customerDisconnectTimers.has(sessionId)) {
          clearTimeout(customerDisconnectTimers.get(sessionId));
          customerDisconnectTimers.delete(sessionId);
          console.log(`[Socket.io] Customer reconnected to session ${sessionId}, cancelled disconnect timer`);
          logSessionEvent(sessionId, "reconnected", "customer", { socketId: socket.id });

          // Notify agent that customer reconnected
          io.to(`session:${sessionId}`).emit("session:customer-reconnected", {
            sessionId,
          });
        }
      }

      // Broadcast presence update
      io.to(`session:${sessionId}`).emit("presence:update", {
        sessionId,
        online: true,
        role,
        agentCount: participants.agent.size,
        customerCount: participants.customer.size,
      });

      console.log(`[Socket.io] ${socket.id} (${role}) joined session:${sessionId}`);
    });

    socket.on("session:leave", (sessionId) => {
      socket.leave(`session:${sessionId}`);
      const info = socketSessionMap.get(socket.id);
      if (info) {
        const participants = getOrCreateParticipants(sessionId);
        if (info.role === "agent") {
          participants.agent.delete(socket.id);
        } else if (info.role === "customer") {
          participants.customer.delete(socket.id);
        }
        socketSessionMap.delete(socket.id);
      }
      console.log(`[Socket.io] ${socket.id} left session:${sessionId}`);
    });

    // --- Customer Joined Notification ---
    socket.on("session:customer-joined", async (data) => {
      try {
        const session = await prisma.session.findUnique({
          where: { id: data.sessionId }
        });
        if (session && session.status === "waiting") {
          await prisma.session.update({
            where: { id: data.sessionId },
            data: {
              status: "active",
              customerName: data.customerName,
              startedAt: new Date(),
            }
          });

          // Log session event
          await logSessionEvent(data.sessionId, "joined", "customer", {
            customerName: data.customerName,
          });
        }
      } catch (err) {
        console.error("Error updating session customer-joined state:", err);
      }
      io.to(`session:${data.sessionId}`).emit("session:customer-joined", data);
    });

    // --- End Session (role-aware) ---
    socket.on("session:end", async (data) => {
      // Support both old format (just sessionId string) and new { sessionId, role }
      let sessionId, role;
      if (typeof data === "string") {
        sessionId = data;
        role = "agent"; // legacy: assume agent
      } else {
        sessionId = data.sessionId;
        role = data.role || "agent";
      }

      try {
        const session = await prisma.session.findUnique({
          where: { id: sessionId }
        });

        if (session && session.status !== "ended") {
          const endedAt = new Date();
          const start = session.startedAt || session.createdAt;
          const durationSecs = Math.floor((endedAt.getTime() - start.getTime()) / 1000);

          await prisma.session.update({
            where: { id: sessionId },
            data: {
              status: "ended",
              endedAt,
              durationSecs,
            }
          });

          // Log session event
          await logSessionEvent(sessionId, "ended", role, {
            durationSecs,
            endedAt: endedAt.toISOString(),
          });
        }
      } catch (err) {
        console.error("Failed to end session in socket handler:", err);
      }

      // Cancel any pending disconnect timer
      if (customerDisconnectTimers.has(sessionId)) {
        clearTimeout(customerDisconnectTimers.get(sessionId));
        customerDisconnectTimers.delete(sessionId);
      }

      io.to(`session:${sessionId}`).emit("session:ended", {
        sessionId,
        endedBy: role,
      });

      // Clean up tracking
      sessionParticipants.delete(sessionId);
    });

    // --- Customer Leave (disconnect from call but don't end session) ---
    socket.on("session:customer-leave", async (data) => {
      const sessionId = typeof data === "string" ? data : data.sessionId;

      try {
        // Log disconnect event
        await logSessionEvent(sessionId, "customer-left", "customer", {
          socketId: socket.id,
          timeoutMs: CUSTOMER_DISCONNECT_TIMEOUT_MS,
        });

        // Notify agent that customer left
        io.to(`session:${sessionId}`).emit("session:customer-left", {
          sessionId,
          timeoutMs: CUSTOMER_DISCONNECT_TIMEOUT_MS,
        });

        // Start disconnect timer — auto-end after timeout if customer doesn't return
        if (!customerDisconnectTimers.has(sessionId)) {
          const timer = setTimeout(async () => {
            customerDisconnectTimers.delete(sessionId);

            try {
              const session = await prisma.session.findUnique({
                where: { id: sessionId }
              });

              if (session && session.status === "active") {
                const endedAt = new Date();
                const start = session.startedAt || session.createdAt;
                const durationSecs = Math.floor((endedAt.getTime() - start.getTime()) / 1000);

                await prisma.session.update({
                  where: { id: sessionId },
                  data: {
                    status: "ended",
                    endedAt,
                    durationSecs,
                  }
                });

                await logSessionEvent(sessionId, "ended", "system", {
                  reason: "customer_disconnect_timeout",
                  durationSecs,
                });

                io.to(`session:${sessionId}`).emit("session:ended", {
                  sessionId,
                  endedBy: "system",
                  reason: "customer_disconnect_timeout",
                });

                sessionParticipants.delete(sessionId);
                console.log(`[Socket.io] Session ${sessionId} auto-ended after customer disconnect timeout`);
              }
            } catch (err) {
              console.error("Failed to auto-end session after disconnect timeout:", err);
            }
          }, CUSTOMER_DISCONNECT_TIMEOUT_MS);

          customerDisconnectTimers.set(sessionId, timer);
          console.log(`[Socket.io] Started ${CUSTOMER_DISCONNECT_TIMEOUT_MS / 1000}s disconnect timer for session ${sessionId}`);
        }
      } catch (err) {
        console.error("Error handling customer leave:", err);
      }
    });

    // --- Chat Messages ---
    socket.on("chat:send-message", async (data) => {
      console.log(`[Socket.io] Received chat:send-message for session ${data.sessionId}:`, data);
      try {
        const dbMessage = await prisma.chatMessage.create({
          data: {
            sessionId: data.sessionId,
            senderType: data.senderType,
            senderName: data.senderName,
            content: data.content,
            fileUrl: data.fileUrl || null,
            fileName: data.fileName || null,
          }
        });

        const message = {
          id: dbMessage.id,
          session_id: dbMessage.sessionId,
          sender_type: dbMessage.senderType,
          sender_name: dbMessage.senderName,
          content: dbMessage.content,
          file_url: dbMessage.fileUrl,
          file_name: dbMessage.fileName,
          created_at: dbMessage.createdAt.toISOString(),
        };

        console.log(`[Socket.io] Broadcasting chat:new-message to room session:${data.sessionId}:`, message);
        io.to(`session:${data.sessionId}`).emit("chat:new-message", message);
      } catch (err) {
        console.error("Failed to save message to SQLite:", err);
      }
    });

    // --- Typing Indicators ---
    socket.on("chat:typing", (data) => {
      socket.to(`session:${data.sessionId}`).emit("chat:typing", data);
    });

    // --- Call Recording Events ---
    socket.on("recording:start", async (sessionId) => {
      // Verify the requesting socket is an agent
      const info = socketSessionMap.get(socket.id);
      if (info && info.role !== "agent" && info.role !== "unknown") {
        console.log(`[Socket.io] Non-agent tried to start recording, rejecting`);
        return;
      }

      try {
        await prisma.session.update({
          where: { id: sessionId },
          data: {
            recordingStatus: "recording",
            recordingStartedAt: new Date(),
          }
        });
        await logSessionEvent(sessionId, "recording-started", "agent");
        io.to(`session:${sessionId}`).emit("recording:start", { sessionId });
      } catch (err) {
        console.error("[Socket.io] Error starting recording:", err);
      }
    });

    socket.on("recording:stop", async (sessionId) => {
      try {
        await prisma.session.update({
          where: { id: sessionId },
          data: {
            recordingStatus: "processing",
          }
        });
        await logSessionEvent(sessionId, "recording-stopped", "agent");
        io.to(`session:${sessionId}`).emit("recording:stop", { sessionId });
      } catch (err) {
        console.error("[Socket.io] Error stopping recording:", err);
      }
    });

    // --- Presence ---
    socket.on("presence:heartbeat", (sessionId) => {
      const info = socketSessionMap.get(socket.id);
      const role = info?.role || "unknown";

      socket.to(`session:${sessionId}`).emit("presence:update", {
        sessionId,
        online: true,
        role,
      });
    });

    // --- Disconnect (with timeout for customers) ---
    socket.on("disconnect", async (reason) => {
      console.log(`[Socket.io] Client disconnected: ${socket.id} (${reason})`);

      const info = socketSessionMap.get(socket.id);
      if (!info) return;

      const { sessionId, role } = info;
      const participants = sessionParticipants.get(sessionId);

      if (participants) {
        if (role === "agent") {
          participants.agent.delete(socket.id);
        } else if (role === "customer") {
          participants.customer.delete(socket.id);

          // If no more customer sockets and session is active, start disconnect timer
          if (participants.customer.size === 0) {
            try {
              const session = await prisma.session.findUnique({
                where: { id: sessionId }
              });

              if (session && session.status === "active") {
                await logSessionEvent(sessionId, "disconnected", "customer", {
                  reason,
                  socketId: socket.id,
                });

                // Notify agent
                io.to(`session:${sessionId}`).emit("session:customer-left", {
                  sessionId,
                  timeoutMs: CUSTOMER_DISCONNECT_TIMEOUT_MS,
                });

                // Start timeout timer if not already running
                if (!customerDisconnectTimers.has(sessionId)) {
                  const timer = setTimeout(async () => {
                    customerDisconnectTimers.delete(sessionId);
                    try {
                      const s = await prisma.session.findUnique({
                        where: { id: sessionId }
                      });

                      if (s && s.status === "active") {
                        const endedAt = new Date();
                        const start = s.startedAt || s.createdAt;
                        const durationSecs = Math.floor((endedAt.getTime() - start.getTime()) / 1000);

                        await prisma.session.update({
                          where: { id: sessionId },
                          data: {
                            status: "ended",
                            endedAt,
                            durationSecs,
                          }
                        });

                        await logSessionEvent(sessionId, "ended", "system", {
                          reason: "customer_disconnect_timeout",
                          durationSecs,
                        });

                        io.to(`session:${sessionId}`).emit("session:ended", {
                          sessionId,
                          endedBy: "system",
                          reason: "customer_disconnect_timeout",
                        });

                        sessionParticipants.delete(sessionId);
                        console.log(`[Socket.io] Session ${sessionId} auto-ended after customer disconnect timeout`);
                      }
                    } catch (err) {
                      console.error("Auto-end on disconnect timeout failed:", err);
                    }
                  }, CUSTOMER_DISCONNECT_TIMEOUT_MS);

                  customerDisconnectTimers.set(sessionId, timer);
                  console.log(`[Socket.io] Customer disconnected from ${sessionId}, started ${CUSTOMER_DISCONNECT_TIMEOUT_MS / 1000}s timeout`);
                }
              }
            } catch (err) {
              console.error("Error handling customer socket disconnect:", err);
            }
          }
        }

        // Broadcast updated presence
        io.to(`session:${sessionId}`).emit("presence:update", {
          sessionId,
          online: false,
          role,
          agentCount: participants.agent.size,
          customerCount: participants.customer.size,
        });
      }

      socketSessionMap.delete(socket.id);
    });
  });

  httpServer.listen(port, () => {
    console.log(`
  ┌─────────────────────────────────────────┐
  │                                         │
  │   ⚡ AtomQuest Video Support Platform   │
  │                                         │
  │   App:    http://${hostname}:${port}          │
  │   Mode:   ${dev ? "development" : "production"}               │
  │   Socket: ✓ enabled                     │
  │                                         │
  └─────────────────────────────────────────┘
    `);
  });
});
