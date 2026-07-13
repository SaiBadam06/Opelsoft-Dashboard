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
  // pdfjs loads its worker via dynamic import, invisible to the standalone file
  // tracer — without this the deployed bundle 500s on every PDF parse.
  outputFileTracingIncludes: {
    "/*": ["./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs"],
  },
};

export default nextConfig;
