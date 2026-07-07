import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for a small Docker image (Cloud Run).
  output: "standalone",
  // Only asset is the SVG logo — optimization adds nothing and avoids needing
  // sharp in the container.
  images: { unoptimized: true },
  // Resume files ride the parse server action in FormData; raise the 1MB default.
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
  // pdf-parse pulls a test harness that reads a local pdf at import; keep it external.
  serverExternalPackages: ["pdf-parse"],
};

export default nextConfig;
