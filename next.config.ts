import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for a small Docker image (Cloud Run).
  output: "standalone",
  // Only asset is the SVG logo — optimization adds nothing and avoids needing
  // sharp in the container.
  images: { unoptimized: true },
  // Resume/doc uploads ride the createCandidate server action; default is 1MB.
  experimental: { serverActions: { bodySizeLimit: "10mb" } },
};

export default nextConfig;
