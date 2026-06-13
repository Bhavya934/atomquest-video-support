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

---

## How to Run Locally

### Prerequisites

- **Node.js** v18 or higher — [Download](https://nodejs.org/)
- **npm** (comes with Node.js)
- **Python** (required for building MiroTalk SFU's native `mediasoup` dependency)
- **C++ Build Tools** (for `mediasoup` native compilation)
  - **Windows**: Install [Visual Studio Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/) with "Desktop development with C++"
  - **macOS**: `xcode-select --install`
  - **Linux**: `sudo apt-get install build-essential python3`

### Step 1: Clone the Repository

```bash
git clone https://github.com/Bhavya934/atomquest-video-support.git
cd atomquest-video-support
```

### Step 2: Install Dependencies (Main App)

```bash
npm install
```

### Step 3: Set Up Environment Variables

```bash
cp .env.example .env.local
```

Edit `.env.local` and set the following:

```env
# Database
DATABASE_URL="file:./dev.db"

# JWT Secret (change this to a random secure string)
JWT_SECRET="your-secret-key-change-this"

# MiroTalk SFU URL
NEXT_PUBLIC_MIROTALK_URL="http://localhost:3010"
MIROTALK_API_KEY="your-mirotalk-api-key"

# App URL
NEXT_PUBLIC_APP_URL="http://localhost:3000"
```

### Step 4: Set Up the Database

```bash
npx prisma generate
npx prisma db push
```

This creates the SQLite database and generates the Prisma client.

### Step 5: Install & Configure MiroTalk SFU

```bash
cd mirotalk-sfu
npm install
```

Edit `mirotalk-sfu/.env` and update these key settings:

```env
SFU_SERVER=true
SFU_ANNOUNCED_IP=127.0.0.1    # Use your local IP for LAN access
```

Then go back to the project root:

```bash
cd ..
```

### Step 6: Start the Servers

**Terminal 1** — Start the main app (Next.js + Socket.io):

```bash
npm run dev:socket
```

**Terminal 2** — Start MiroTalk SFU (Video Server):

```bash
cd mirotalk-sfu
npm start
```

### Step 7: Open the App

| Service | URL |
|---|---|
| **AtomQuest App** | [http://localhost:3000](http://localhost:3000) |
| **MiroTalk SFU** | [http://localhost:3010](http://localhost:3010) |

1. Register a new agent account at `/register`
2. Create a new session from the dashboard
3. Share the join link with the customer
4. Customer opens the link, enters their name, and joins the video call

---

## Project Structure

```
atomquest-video-support/
├── prisma/
│   └── schema.prisma              # Database schema (User, Session, ChatMessage, SessionEvent)
├── public/
│   └── uploads/                   # User-uploaded files (auto-created)
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx     # Login page
│   │   │   ├── register/page.tsx  # Registration page
│   │   │   └── layout.tsx         # Auth layout
│   │   ├── (dashboard)/
│   │   │   ├── dashboard/page.tsx # Main dashboard with metrics
│   │   │   ├── sessions/
│   │   │   │   ├── [id]/page.tsx  # Session detail page (agent view)
│   │   │   │   ├── new/page.tsx   # Create new session
│   │   │   │   └── page.tsx       # Active sessions list
│   │   │   ├── history/page.tsx   # Session history with search/filter
│   │   │   ├── admin/metrics/page.tsx  # Admin metrics dashboard
│   │   │   └── layout.tsx         # Dashboard layout with sidebar
│   │   ├── api/
│   │   │   ├── auth/
│   │   │   │   ├── login/route.ts
│   │   │   │   ├── register/route.ts
│   │   │   │   ├── logout/route.ts
│   │   │   │   └── me/route.ts
│   │   │   ├── sessions/
│   │   │   │   ├── [id]/
│   │   │   │   │   ├── route.ts          # GET/PATCH session by ID
│   │   │   │   │   └── recording/route.ts # Upload call recording
│   │   │   │   ├── route.ts              # POST create session
│   │   │   │   └── history/route.ts      # GET session history
│   │   │   ├── uploads/route.ts          # File upload endpoint
│   │   │   ├── metrics/route.ts          # Live metrics API
│   │   │   └── mirotalk/create-room/route.ts  # MiroTalk room creation
│   │   ├── join/[sessionId]/page.tsx     # Customer join page
│   │   ├── globals.css                    # Global styles & design system
│   │   ├── layout.tsx                     # Root layout
│   │   └── page.tsx                       # Landing page
│   ├── components/
│   │   ├── layout/
│   │   │   ├── sidebar.tsx        # Dashboard sidebar navigation
│   │   │   └── topbar.tsx         # Top navigation bar
│   │   └── session/
│   │       ├── session-detail-client.tsx  # Agent session view (video + chat)
│   │       └── customer-join-client.tsx   # Customer join & call view
│   ├── lib/
│   │   ├── auth.ts                # JWT authentication helpers
│   │   ├── prisma.ts              # Prisma client singleton
│   │   ├── constants.ts           # App constants
│   │   ├── utils.ts               # Utility functions
│   │   ├── mirotalk/api.ts        # MiroTalk URL builder & API
│   │   └── socket/client.ts       # Socket.io client singleton
│   ├── types/index.ts             # TypeScript type definitions
│   └── middleware.ts              # Auth middleware (protected routes)
├── mirotalk-sfu/                  # Self-hosted MiroTalk SFU server
│   ├── .env                       # MiroTalk configuration
│   ├── app/src/                   # MiroTalk server source
│   └── package.json
├── server.js                      # Custom server (Next.js + Socket.io)
├── package.json
├── next.config.ts
├── tsconfig.json
├── .env.example                   # Environment variables template
├── .gitignore
└── README.md
```

