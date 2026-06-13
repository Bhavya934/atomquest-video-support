"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { cn, getInitials } from "@/lib/utils";
import type { Profile } from "@/types";
import {
  Menu,
  X,
  LayoutDashboard,
  Video,
  Plus,
  Clock,
  Sparkles,
  LogOut,
  Server,
} from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/sessions", label: "Sessions", icon: Video },
  { href: "/sessions/new", label: "New Session", icon: Plus },
  { href: "/history", label: "History", icon: Clock },
  { href: "/admin/metrics", label: "Metrics", icon: Server },
];

interface TopbarProps {
  profile: Profile;
}

export function Topbar({ profile }: TopbarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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

  // Get page title from pathname
  const getPageTitle = () => {
    if (pathname === "/dashboard") return "Dashboard";
    if (pathname === "/sessions/new") return "New Session";
    if (pathname === "/sessions") return "Sessions";
    if (pathname.startsWith("/sessions/")) return "Session Details";
    if (pathname === "/history") return "History";
    if (pathname === "/admin/metrics") return "Operational Metrics";
    return "Dashboard";
  };

  return (
    <>
      <header className="sticky top-0 z-30 h-16 bg-surface-0/80 backdrop-blur-xl border-b border-border flex items-center px-4 sm:px-6 lg:px-8">
        {/* Mobile menu button */}
        <button
          onClick={() => setMobileMenuOpen(true)}
          className="md:hidden p-2 -ml-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-2 transition-colors mr-3 cursor-pointer"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Page title */}
        <h1 className="text-lg font-semibold">{getPageTitle()}</h1>

        {/* Right side */}
        <div className="ml-auto flex items-center gap-3">
          <Link
            href="/sessions/new"
            className="hidden sm:flex items-center gap-2 px-4 py-2 rounded-lg gradient-brand text-white text-sm font-medium hover:opacity-90 transition-opacity"
          >
            <Plus className="w-4 h-4" />
            New Session
          </Link>

          {/* User avatar (desktop) */}
          <div className="hidden md:flex items-center gap-2 pl-3 border-l border-border">
            <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center text-white text-xs font-semibold">
              {getInitials(profile.full_name)}
            </div>
          </div>
        </div>
      </header>

      {/* Mobile menu overlay */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 bg-surface-1 border-r border-border animate-slide-in-right flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 h-16 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center">
                  <Sparkles className="w-5 h-5 text-white" />
                </div>
                <span className="text-lg font-bold text-gradient">AtomQuest</span>
              </div>
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface-2 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Nav items */}
            <nav className="flex-1 px-3 py-4 space-y-1">
              {navItems.map((item) => {
                const isActive =
                  pathname === item.href ||
                  (item.href !== "/dashboard" && pathname.startsWith(item.href));
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={cn(
                      "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all",
                      isActive
                        ? "bg-brand-500/15 text-brand-400"
                        : "text-text-secondary hover:text-text-primary hover:bg-surface-2"
                    )}
                  >
                    <item.icon className="w-5 h-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            {/* User section */}
            <div className="p-3 border-t border-border">
              <div className="flex items-center gap-3 px-3 py-2.5">
                <div className="w-9 h-9 rounded-lg gradient-brand flex items-center justify-center text-white text-sm font-semibold">
                  {getInitials(profile.full_name)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{profile.full_name}</p>
                  <p className="text-xs text-text-muted truncate">{profile.email}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-1.5 rounded-md text-text-muted hover:text-danger-400 hover:bg-danger-500/10 transition-all cursor-pointer"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
