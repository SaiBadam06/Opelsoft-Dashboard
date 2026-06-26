import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Self-contained server bundle for a small Docker image (Cloud Run).
  output: "standalone",
  // Only asset is the SVG logo — optimization adds nothing and avoids needing
  // sharp in the container.
  images: { unoptimized: true },
};

export default nextConfig;
