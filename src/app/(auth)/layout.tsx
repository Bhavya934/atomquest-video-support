import { Sparkles } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12">
      {/* Background effects */}
      <div className="fixed inset-0 bg-grid opacity-10 pointer-events-none" />
      <div className="fixed top-1/4 left-1/4 w-96 h-96 bg-brand-500/8 rounded-full blur-3xl pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-accent-500/8 rounded-full blur-3xl pointer-events-none" />

      <div className="relative w-full max-w-md animate-fade-in">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl gradient-brand flex items-center justify-center">
              <Sparkles className="w-6 h-6 text-white" />
            </div>
            <span className="text-2xl font-bold text-gradient">AtomQuest</span>
          </Link>
        </div>

        {/* Card */}
        <div className="glass-strong rounded-2xl p-8 shadow-lg">{children}</div>
      </div>
    </div>
  );
}
