# AtomQuest Real-Time Video Support Platform

AtomQuest is a high-performance, real-time video support platform designed for customer service teams. It enables support agents to instantly initiate WebRTC-based video and audio calls with customers via simple, secure shareable links, requiring zero application installs or sign-ups for the customer.

---

## Key Features

*   **Real-Time Video & Audio Calling**: Low-latency WebRTC streams powered by a self-hosted MiroTalk SFU media server.
*   **Frictionless Customer Join Flow**: Customers join sessions instantly using a secure, public shareable token link (`/join/[shareToken]`) without login requirements.
*   **Live Presence & Presence Indicators**: Real-time tracking of session participants (Agent and Customer). Includes live online/disconnected status cues and an automatic 2-minute disconnect timeout safety net.
*   **Real-Time Chat & Persistence**: WebSocket-powered chat sync utilizing Socket.io, with all chat transcripts securely stored in the database.
*   **Interactive Audit Trails**: Comprehensive session events (created, joined, disconnected, reconnected, ended) displayed in a clean timeline view.
*   **Post-Call Feedback & Notes**: 
    *   **Customer Rating**: Form enabling customers to rate the support experience (1–5 stars) and write comments.
    *   **Agent Summaries**: Editable notes field for support agents to record post-call follow-ups.
*   **Metrics Dashboard**: Live dashboards illustrating agent statistics, active sessions, and search/filter-supported session history logs.
*   **Mobile-Optimized Design**: Clean mobile breakpoints, touch-friendly targets, and a dedicated full-screen agent call overlay on small viewports.

---

## Tech Stack

*   **Framework**: Next.js (App Router, React, TypeScript)
*   **Styling**: TailwindCSS & Vanilla CSS
*   **Real-Time Communication**: Socket.io (WebSockets) for messaging and signaling
*   **Video Infrastructure**: MiroTalk SFU (Self-hosted WebRTC Media Server)
*   **Database & ORM**: PostgreSQL/SQLite queried through Prisma ORM
*   **State Management & Utilities**: React Hooks, Lucide Icons
