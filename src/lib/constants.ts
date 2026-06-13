export const APP_NAME = "AtomQuest";
export const APP_DESCRIPTION = "Real-Time Video Support Platform";

export const SESSION_STATUSES = {
  waiting: { label: "Waiting", color: "warning", dotClass: "status-dot-waiting" },
  active: { label: "Active", color: "success", dotClass: "status-dot-active" },
  paused: { label: "Paused", color: "warning", dotClass: "status-dot-waiting" },
  ended: { label: "Ended", color: "muted", dotClass: "status-dot-ended" },
} as const;

export const ROLES = {
  agent: { label: "Agent", description: "Support agent who creates and manages sessions" },
  admin: { label: "Admin", description: "Administrator with full access" },
} as const;
