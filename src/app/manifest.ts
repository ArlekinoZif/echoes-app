import type { MetadataRoute } from "next";

// Served by Next at /manifest.webmanifest. This is what makes Echoes an
// installable PWA and what the Bubblewrap TWA (Solana dApp Store build) reads.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Echoes — Record. Tokenize. Earn.",
    short_name: "Echoes",
    description:
      "Record your story, launch a token backed by it, and earn every time people trade it. Built for Solana Seeker.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "portrait",
    background_color: "#0c0c0c",
    theme_color: "#0c0c0c",
    categories: ["social", "music", "entertainment", "finance"],
    dir: "ltr",
    lang: "en",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-256.png", sizes: "256x256", type: "image/png", purpose: "any" },
      { src: "/icons/icon-384.png", sizes: "384x384", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Record an echo",
        short_name: "Record",
        url: "/record",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Explore stories",
        short_name: "Explore",
        url: "/",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
