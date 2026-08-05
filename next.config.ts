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
  // pdf-parse's native deps load via paths the standalone file tracer can't see,
  // so it drops them from the deployed bundle. Without these two, /candidates/new
  // 500s: pdfjs needs its worker (dynamic import), and pdf-parse hard-depends on
  // @napi-rs/canvas — a native .node addon whose platform package (e.g.
  // @napi-rs/canvas-linux-x64-gnu on Cloud Run) is otherwise missing, so the
  // route's server-action bundle throws at load for both Save and Autofill.
  outputFileTracingIncludes: {
    "/*": [
      "./node_modules/pdfjs-dist/legacy/build/pdf.worker.mjs",
      "./node_modules/@napi-rs/**/*",
    ],
  },
  async redirects() {
    return [
      {
        source: "/jobs",
        destination: "/careers",
        permanent: true,
      },
      {
        source: "/jobs/:path*",
        destination: "/careers/jobs/:path*",
        permanent: true,
      },
    ];
  },
  // STAF-115: baseline security headers on every response. `*.supabase.co`
  // (not the dev project's specific subdomain) so this holds across dev and
  // prod, which use different Supabase projects. style-src keeps
  // 'unsafe-inline' because the UI kit (Base UI) positions popovers/dialogs
  // via inline style attributes — a stricter policy would need per-request
  // nonces threaded through the proxy, which is a bigger change than this
  // ticket covers.
  async headers() {
    const csp = [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https://*.supabase.co",
      "font-src 'self' data:",
      "connect-src 'self' https://*.supabase.co",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
    ].join("; ");

    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=(), browsing-topics=()",
          },
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "Content-Security-Policy", value: csp },
        ],
      },
    ];
  },
};

export default nextConfig;
