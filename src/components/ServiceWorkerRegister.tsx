"use client";

import { useEffect } from "react";

// Registers the PWA service worker (public/sw.js). Required for installability
// and the Solana dApp Store TWA. Auto-activates new versions so the wrapped app
// never gets stuck on stale code after a redeploy.
export default function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    // Allow opting out locally: localStorage.setItem("echoes_no_sw","1")
    if (localStorage.getItem("echoes_no_sw") === "1") return;

    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/" })
        .then((reg) => {
          // When a new SW takes control, reload once to pick up fresh assets.
          reg.addEventListener("updatefound", () => {
            const sw = reg.installing;
            if (!sw) return;
            sw.addEventListener("statechange", () => {
              if (sw.state === "installed" && navigator.serviceWorker.controller) {
                sw.postMessage("SKIP_WAITING");
              }
            });
          });
        })
        .catch((err) => console.warn("[sw] registration failed", err));
    };

    let reloaded = false;
    navigator.serviceWorker.addEventListener("controllerchange", () => {
      if (reloaded) return;
      reloaded = true;
      window.location.reload();
    });

    if (document.readyState === "complete") onLoad();
    else window.addEventListener("load", onLoad, { once: true });
  }, []);

  return null;
}
