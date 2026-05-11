import type { NextConfig } from "next";
import path from "path";

const noopModule = path.resolve(__dirname, "src/lib/__noop__.ts");

const R2_HOST = process.env.NEXT_PUBLIC_R2_PUBLIC_URL
  ? new URL(process.env.NEXT_PUBLIC_R2_PUBLIC_URL).hostname
  : "pub-a37a5c77e46d4e9e98a12b28a9c128e1.r2.dev";

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),

  images: {
    remotePatterns: [
      { protocol: "https", hostname: R2_HOST },
    ],
  },

  // @solana/web3.js and Anchor are used in API routes — let Node require them
  // natively instead of bundling them, which avoids re-compilation on every
  // server restart and halves bundle sizes.
  serverExternalPackages: ["@solana/web3.js", "@coral-xyz/anchor", "bs58"],

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
