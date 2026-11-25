import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  // `pg` reads the Supabase CA from `sslrootcert=prisma/certs/…` at runtime, so the
  // file has to be bundled with every server function (it isn't imported, so tracing misses it).
  outputFileTracingIncludes: {
    "/**": ["./prisma/certs/**"],
  },
  // The design preview is a static page in public/preview/ (built by scripts/build-preview.mjs).
  async rewrites() {
    return [{ source: "/preview", destination: "/preview/index.html" }];
  },
};

export default nextConfig;
