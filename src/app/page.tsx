import Link from "next/link";
import {
  Video,
  Shield,
  Zap,
  Monitor,
  MessageSquare,
  Users,
  ArrowRight,
  Sparkles,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen">
      {/* ===== NAVBAR ===== */}
      <nav className="fixed top-0 left-0 right-0 z-50 glass-strong">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg gradient-brand flex items-center justify-center">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <span className="text-lg font-bold text-gradient">AtomQuest</span>
            </div>
            <div className="flex items-center gap-3">
              <Link
                href="/login"
                className="px-4 py-2 text-sm font-medium text-text-secondary hover:text-text-primary transition-colors"
              >
                Sign In
              </Link>
              <Link
                href="/register"
                className="px-4 py-2 text-sm font-medium rounded-lg gradient-brand text-white hover:opacity-90 transition-opacity"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* ===== HERO SECTION ===== */}
      <section className="relative pt-32 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 bg-grid opacity-20" />
        <div className="absolute top-20 left-10 w-72 h-72 bg-brand-500/10 rounded-full blur-3xl animate-float" />
        <div
          className="absolute bottom-10 right-10 w-96 h-96 bg-accent-500/10 rounded-full blur-3xl animate-float"
          style={{ animationDelay: "2s" }}
        />

        <div className="relative max-w-5xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full glass text-sm text-brand-400 mb-8 animate-fade-in">
            <Zap className="w-4 h-4" />
            <span>Powered by WebRTC • Server-Routed Media</span>
          </div>

          {/* Heading */}
          <h1
            className="text-4xl sm:text-5xl lg:text-7xl font-bold tracking-tight mb-6 animate-fade-in"
            style={{ animationDelay: "0.1s" }}
          >
            Real-Time Video
            <br />
            <span className="text-gradient">Support Platform</span>
          </h1>

          {/* Subtitle */}
          <p
            className="text-lg sm:text-xl text-text-secondary max-w-2xl mx-auto mb-10 animate-fade-in"
            style={{ animationDelay: "0.2s" }}
          >
            Connect with customers instantly through browser-based video calls.
            No downloads, no plugins — just share a link and start helping.
          </p>

          {/* CTA Buttons */}
          <div
            className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in"
            style={{ animationDelay: "0.3s" }}
          >
            <Link
              href="/register"
              className="group flex items-center gap-2 px-8 py-3.5 rounded-xl gradient-brand text-white font-semibold text-lg shadow-glow hover:shadow-glow-lg transition-all duration-300 hover:scale-105"
            >
              Start Free
              <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
            </Link>
            <Link
              href="/login"
              className="flex items-center gap-2 px-8 py-3.5 rounded-xl glass text-text-primary font-semibold text-lg hover:bg-surface-2 transition-all"
            >
              Agent Login
            </Link>
          </div>
        </div>
      </section>

      {/* ===== FEATURES GRID ===== */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              Everything you need for
              <span className="text-gradient"> live support</span>
            </h2>
            <p className="text-text-secondary text-lg max-w-2xl mx-auto">
              Built from the ground up for real-time customer interactions with
              enterprise-grade security.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Video,
                title: "1:1 Video Calls",
                description:
                  "Crystal-clear video powered by Mediasoup SFU. All media routes through your server — never P2P.",
                gradient: "from-brand-500 to-brand-700",
              },
              {
                icon: Monitor,
                title: "Screen Sharing",
                description:
                  "Share your screen or window instantly. Perfect for walkthroughs, debugging, and demos.",
                gradient: "from-accent-500 to-accent-600",
              },
              {
                icon: MessageSquare,
                title: "Real-Time Chat",
                description:
                  "In-call text messaging with file sharing. All conversations are persisted and searchable.",
                gradient: "from-success-400 to-success-500",
              },
              {
                icon: Shield,
                title: "Role-Based Access",
                description:
                  "Agents manage sessions with full controls. Customers join with just a link — no signup required.",
                gradient: "from-warning-400 to-warning-500",
              },
              {
                icon: Users,
                title: "Session Management",
                description:
                  "Create, track, and archive support sessions. Built-in timer, notes, and status tracking.",
                gradient: "from-danger-400 to-danger-500",
              },
              {
                icon: Zap,
                title: "Zero Install",
                description:
                  "100% browser-based. Works on Chrome, Firefox, Safari, and Edge. Mobile-responsive design.",
                gradient: "from-brand-400 to-accent-500",
              },
            ].map((feature, i) => (
              <div
                key={feature.title}
                className="group p-6 rounded-2xl bg-surface-1 border border-border card-hover animate-fade-in"
                style={{ animationDelay: `${0.1 * i}s` }}
              >
                <div
                  className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform`}
                >
                  <feature.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-text-secondary text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== HOW IT WORKS ===== */}
      <section className="py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">
              How it <span className="text-gradient">works</span>
            </h2>
          </div>

          <div className="space-y-8">
            {[
              {
                step: "01",
                title: "Agent Creates a Session",
                description:
                  "Login to your dashboard, click 'New Session', and give it a title. A unique shareable link is generated instantly.",
              },
              {
                step: "02",
                title: "Share the Link",
                description:
                  "Send the link to your customer via email, chat, or QR code. They can join from any modern browser.",
              },
              {
                step: "03",
                title: "Start the Video Call",
                description:
                  "Both parties join the secure video room. Share screens, chat, and resolve issues in real-time.",
              },
            ].map((item, i) => (
              <div
                key={item.step}
                className="flex gap-6 items-start p-6 rounded-2xl bg-surface-1 border border-border card-hover animate-fade-in"
                style={{ animationDelay: `${0.15 * i}s` }}
              >
                <div className="flex-shrink-0 w-14 h-14 rounded-xl gradient-brand flex items-center justify-center text-white font-bold text-lg">
                  {item.step}
                </div>
                <div>
                  <h3 className="text-xl font-semibold mb-2">{item.title}</h3>
                  <p className="text-text-secondary">{item.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ===== FOOTER ===== */}
      <footer className="py-12 px-4 border-t border-border">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-md gradient-brand flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <span className="font-semibold text-gradient">AtomQuest</span>
          </div>
          <p className="text-sm text-text-muted">
            Built for the AtomQuest Hackathon • Server-Routed Media via
            Mediasoup SFU
          </p>
        </div>
      </footer>
    </div>
  );
}
