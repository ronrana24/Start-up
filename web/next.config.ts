import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async rewrites() {
    const apiProxyTarget = (process.env.API_PROXY_TARGET ?? "").trim();
    if (!apiProxyTarget) {
      return [];
    }
    return [
      {
        source: "/api/:path*",
        destination: `${apiProxyTarget.replace(/\/+$/, "")}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
