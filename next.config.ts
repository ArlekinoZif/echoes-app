import type { NextConfig } from "next";
import path from "path";

const noopModule = path.resolve(__dirname, "src/lib/__noop__.ts");

const R2_HOST = process.env.NEXT_PUBLIC_R2_PUBLIC_URL
  ? new URL(process.env.NEXT_PUBLIC_R2_PUBLIC_URL).hostname
  : "pub-a37a5c77e46d4e9e98a12b28a9c128e1.r2.dev";

// Cover images uploaded before the R2 migration still live in Supabase Storage,
// whose hostname follows the configured project rather than a fixed value.
const SUPABASE_HOST = process.env.NEXT_PUBLIC_SUPABASE_URL
  ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).hostname
  : "htpxzfesrtripvawpugc.supabase.co";

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingRoot: path.resolve(__dirname),
  poweredByHeader: false,

  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), geolocation=(), microphone=(self)" },
          { key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" },
        ],
      },
    ];
  },

  // Rewrite barrel imports to direct paths so the compiler doesn't load the
  // whole package on first use. Big win for the icon set, which is imported
  // across nearly every page.
  experimental: {
    optimizePackageImports: ["lucide-react", "@solana/spl-token"],
    // NOTE: turbopackFileSystemCacheForDev (persistent dev cache) was tried for
    // faster restarts but intermittently served stale route manifests after a
    // restart (all /api/* routes 404'd until `rm -rf .next`). Disabled for
    // correctness — the lazy-loading + optimizePackageImports gains remain.
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: R2_HOST },
      { protocol: "https", hostname: "pub-a37a5c77e46d4e9e98a12b28a9c128e1.r2.dev" },
      { protocol: "https", hostname: SUPABASE_HOST },
      { protocol: "https", hostname: "htpxzfesrtripvawpugc.supabase.co" },
    ],
  },

  // @solana/web3.js and Anchor are used in API routes — let Node require them
  // natively instead of bundling them, which avoids re-compilation on every
  // server restart and halves bundle sizes.
  // bs58 intentionally excluded — Turbopack mangles its name in standalone
  // builds (bs58-<hash>) making it unresolvable at runtime. Bundle it instead.
  serverExternalPackages: ["@solana/web3.js", "@coral-xyz/anchor"],

  // Turbopack (default in Next.js 16): alias Node-only built-ins to a browser
  // stub so the client bundle compiles without hanging on fs/net/tls.
  turbopack: {
    resolveAlias: {
      fs: { browser: noopModule },
      net: { browser: noopModule },
      tls: { browser: noopModule },
      "node-fetch": { browser: noopModule },
    },
  },

  // Fallback webpack config kept for `npm run dev -- --webpack` or CI builds.
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        "node-fetch": false,
      };
    }
    return config;
  },
};

export default nextConfig;
