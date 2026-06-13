"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types";
import {
  LayoutDashboard,
  Video,
  Plus,
  Clock,
  Sparkles,
  LogOut,
  Server,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { getInitials } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sessions", label: "Sessions", icon: Video },
  { href: "/sessions/new", label: "New Session", icon: Plus },
  { href: "/history", label: "History", icon: Clock },
  { href: "/admin/metrics", label: "Metrics", icon: Server },
];

interface SidebarProps {
  profile: Profile;
}

export function Sidebar({ profile }: SidebarProps) {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
      });
      if (response.ok) {
        router.push("/login");
        router.refresh();
      }
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  return (
    <aside className="hidden md:flex md:flex-col md:w-64 md:fixed md:inset-y-0 bg-surface-1 border-r border-border z-40">
      {/* Logo */}
      <div className="flex items-center gap-2 px-6 h-16 border-b border-border">
        <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-white" />
        </div>
        <span className="text-lg font-bold text-gradient">AtomQuest</span>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItems.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== "/dashboard" && pathname.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                isActive
                  ? "bg-brand-500/15 text-brand-400 shadow-sm"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-2"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive && "text-brand-400")} />
              {item.label}
              {item.href === "/sessions/new" && (
                <span className="ml-auto w-5 h-5 rounded-md gradient-brand flex items-center justify-center">
                  <Plus className="w-3 h-3 text-white" />
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* User section */}
      <div className="p-3 border-t border-border">
        <div className="flex items-center gap-3 px-3 py-2.5">
          <div className="w-9 h-9 rounded-lg gradient-brand flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
            {getInitials(profile.full_name)}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{profile.full_name}</p>
            <p className="text-xs text-text-muted truncate">{profile.email}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-md text-text-muted hover:text-danger-400 hover:bg-danger-500/10 transition-all cursor-pointer"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
