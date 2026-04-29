import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    // @solana/web3.js v1 pulls in Node-only deps (node-fetch, whatwg-url,
    // tr46) even in its ESM build.  Alias them to browser-no-ops so
    // Turbopack can bundle client components cleanly.
    resolveAlias: {
      "node-fetch": { browser: "./src/lib/__noop__.ts" },
    },
  },
};

export default nextConfig;
