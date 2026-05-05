import type { NextConfig } from "next";
import path from "path";

const noopModule = path.resolve(__dirname, "src/lib/__noop__.ts");

const nextConfig: NextConfig = {
  outputFileTracingRoot: path.resolve(__dirname),

  // @solana/web3.js and Anchor are used in API routes — let Node require them
  // natively instead of bundling them, which avoids re-compilation on every
  // server restart and halves bundle sizes.
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
