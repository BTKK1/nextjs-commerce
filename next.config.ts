import type { NextConfig } from "next";

const configHeader = [
  {
    source: "/:path*",
    headers: [
      { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
      { key: "X-Frame-Options", value: "DENY" },
      { key: "X-Content-Type-Options", value: "nosniff" },
      { key: "X-XSS-Protection", value: "1; mode=block" },
      {
        key: "Permissions-Policy",
        value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
      },
    ],
  },
  {
    source: "/search/:path*",
    headers: [
      {
        key: "Cache-Control",
        value: "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    ],
  },
  {
    source: "/product/:path*",
    headers: [
      {
        key: "Cache-Control",
        value: "public, s-maxage=3600, stale-while-revalidate=86400",
      },
      {
        key: "Vary",
        value: "Accept-Encoding",
      },
    ],
  },
  {
    source: "/checkout/:path*",
    headers: [
      {
        key: "Cache-Control",
        value: "private, no-cache, no-store, must-revalidate",
      },
    ],
  },
  {
    source: "/customer/:path*",
    headers: [
      {
        key: "Cache-Control",
        value: "private, no-cache, no-store, must-revalidate",
      },
    ],
  },
  {
    source: "/image/:path*",
    headers: [
      {
        key: "Cache-Control",
        value: "public, max-age=31536000, immutable",
      },
    ],
  },
  {
    source: "/icons/:path*",
    headers: [
      {
        key: "Cache-Control",
        value: "public, max-age=31536000, immutable",
      },
    ],
  },
  {
    source: "/fonts/:path*",
    headers: [
      {
        key: "Cache-Control",
        value: "public, max-age=31536000, immutable",
      },
    ],
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  turbopack: {
    root: __dirname,
  },
  typescript: {
    ignoreBuildErrors: false,
  },
  images: {
    unoptimized: false,
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
    remotePatterns: [
      ...(process.env.NEXT_PUBLIC_BAGISTO_ENDPOINT
        ? (() => {
          try {
            const url = new URL(process.env.NEXT_PUBLIC_BAGISTO_ENDPOINT);
            return [
              {
                protocol: url.protocol.replace(":", "") as "https" | "http",
                hostname: url.hostname,
              },
            ];
          } catch {
            console.warn(
              "Invalid NEXT_PUBLIC_BAGISTO_ENDPOINT URL:",
              process.env.NEXT_PUBLIC_BAGISTO_ENDPOINT,
            );
            return [];
          }
        })()
        : []),
    ],
  },

  async headers() {
    return configHeader;
  },
  compress: true,
  experimental: {
    useCache: true,
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
};

export default nextConfig;
