import type { NextConfig } from "next";

const config: NextConfig = {
  agentRules: false,
  async rewrites() {
    return [{ source: "/callback", destination: "/callback.html" }];
  },
  async headers() {
    const callbackHeaders = [
      { key: "Cache-Control", value: "no-store" },
      { key: "Referrer-Policy", value: "no-referrer" },
      { key: "X-Content-Type-Options", value: "nosniff" },
    ];
    return [
      { source: "/callback", headers: callbackHeaders },
      { source: "/callback.html", headers: callbackHeaders },
      { source: "/api/holds", headers: [{ key: "Cache-Control", value: "no-store" }] },
    ];
  },
};

export default config;
