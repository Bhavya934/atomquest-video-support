import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: "AtomQuest — Real-Time Video Support",
  description:
    "Connect with customers instantly through browser-based video support. No downloads, no hassle — just real-time help.",
  keywords: ["video support", "real-time", "customer support", "WebRTC", "video call"],
  openGraph: {
    title: "AtomQuest — Real-Time Video Support",
    description: "Browser-based video support platform for modern teams.",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <div className="min-h-screen bg-surface-0 gradient-mesh">
          {children}
        </div>
      </body>
    </html>
  );
}
