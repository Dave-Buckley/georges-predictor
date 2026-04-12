import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // @react-pdf/renderer ships Node-only deps (yoga, fontkit, pdfkit) that Next's
  // server bundler can trip over on Vercel. Keeping it external prevents the
  // "Package subpath './build/yoga.wasm' is not defined" class of errors that
  // manifest only in production (10-RESEARCH.md Pitfall 3).
  serverExternalPackages: ['@react-pdf/renderer'],
  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'crests.football-data.org', pathname: '/**' },
    ],
  },
};

export default nextConfig;
