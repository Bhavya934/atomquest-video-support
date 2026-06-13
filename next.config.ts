import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Allow MiroTalk iframe embedding
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Permissions-Policy",
            value: "camera=*, microphone=*, display-capture=*",
          },
        ],
      },
    ];
  },
  // Disable strict mode for Socket.io compatibility
  reactStrictMode: false,
};

export default nextConfig;
