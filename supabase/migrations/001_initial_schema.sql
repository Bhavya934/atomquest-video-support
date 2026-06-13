-- ================================================
-- AtomQuest Video Support — Database Schema
-- Run this in Supabase SQL Editor
-- ================================================

-- ========================================
-- 1. PROFILES (synced from auth.users)
-- ========================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  full_name     TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'agent' CHECK (role IN ('agent', 'admin')),
  avatar_url    TEXT,
  created_at    TIMESTAMPTZ DEFAULT now(),
  updated_at    TIMESTAMPTZ DEFAULT now()
);

-- Auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'agent')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop existing trigger if any
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ========================================
-- 2. SESSIONS (core entity)
-- ========================================
CREATE TABLE IF NOT EXISTS public.sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id        UUID NOT NULL REFERENCES public.profiles(id),
  customer_name   TEXT,
  customer_email  TEXT,
  title           TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'waiting'
                    CHECK (status IN ('waiting', 'active', 'paused', 'ended')),
  room_id         TEXT,
  room_url        TEXT,
  share_token     TEXT UNIQUE DEFAULT encode(gen_random_bytes(16), 'hex'),
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  duration_secs   INTEGER,
  recording_url   TEXT,
  metadata        JSONB DEFAULT '{}',
  created_at      TIMESTAMPTZ DEFAULT now(),
  updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_sessions_agent_id ON public.sessions(agent_id);
CREATE INDEX IF NOT EXISTS idx_sessions_share_token ON public.sessions(share_token);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON public.sessions(status);

-- ========================================
-- 3. CHAT MESSAGES
-- ========================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  sender_type TEXT NOT NULL CHECK (sender_type IN ('agent', 'customer', 'system')),
  sender_name TEXT NOT NULL,
  content     TEXT NOT NULL,
  file_url    TEXT,
  file_name   TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_session_id ON public.chat_messages(session_id);

-- ========================================
-- 4. SESSION EVENTS (audit log)
-- ========================================
CREATE TABLE IF NOT EXISTS public.session_events (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES public.sessions(id) ON DELETE CASCADE,
  event_type  TEXT NOT NULL,
  actor       TEXT NOT NULL,
  metadata    JSONB DEFAULT '{}',
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_session_events_session_id ON public.session_events(session_id);

-- ========================================
-- 5. ROW LEVEL SECURITY
-- ========================================

-- Enable RLS on all tables
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.session_events ENABLE ROW LEVEL SECURITY;

-- PROFILES: Users can read all profiles, update their own
CREATE POLICY "Profiles are viewable by authenticated users"
  ON public.profiles FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Users can update own profile"
  ON public.profiles FOR UPDATE TO authenticated
  USING (id = auth.uid());

-- SESSIONS: Agents manage their own sessions
CREATE POLICY "Agents can view own sessions"
  ON public.sessions FOR SELECT TO authenticated
  USING (agent_id = auth.uid());

CREATE POLICY "Agents can create sessions"
  ON public.sessions FOR INSERT TO authenticated
  WITH CHECK (agent_id = auth.uid());

CREATE POLICY "Agents can update own sessions"
  ON public.sessions FOR UPDATE TO authenticated
  USING (agent_id = auth.uid());

-- SESSIONS: Anonymous users can view sessions (for join flow)
CREATE POLICY "Anon can view waiting/active sessions"
  ON public.sessions FOR SELECT TO anon
  USING (status IN ('waiting', 'active'));

-- SESSIONS: Anonymous users can update sessions (to set customer_name on join)
CREATE POLICY "Anon can join sessions"
  ON public.sessions FOR UPDATE TO anon
  USING (status = 'waiting');

-- CHAT: Agents can read/write chat for their sessions
CREATE POLICY "Chat access for agents"
  ON public.chat_messages FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = chat_messages.session_id
      AND sessions.agent_id = auth.uid()
    )
  );

-- CHAT: Anonymous users can insert chat messages
CREATE POLICY "Anon can send chat messages"
  ON public.chat_messages FOR INSERT TO anon
  WITH CHECK (sender_type = 'customer');

-- CHAT: Anonymous users can read chat for active sessions
CREATE POLICY "Anon can read chat"
  ON public.chat_messages FOR SELECT TO anon
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = chat_messages.session_id
      AND sessions.status IN ('waiting', 'active')
    )
  );

-- EVENTS: Agents can read events for their sessions
CREATE POLICY "Event access for agents"
  ON public.session_events FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.sessions
      WHERE sessions.id = session_events.session_id
      AND sessions.agent_id = auth.uid()
    )
  );

-- ========================================
-- 6. UPDATED_AT TRIGGER
-- ========================================
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER set_updated_at_sessions
  BEFORE UPDATE ON public.sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
