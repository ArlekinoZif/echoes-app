"use client";

import { useEffect } from "react";

/**
 * Registers the Solana Mobile Wallet Adapter as a Wallet-Standard wallet so the
 * Seeker's built-in Seed Vault wallet (and any installed MWA wallet) becomes
 * connectable. Phantom Connect's Wallet Standard discovery surfaces it beside
 * injected browser wallets while Helius continues to provide email/passkey.
 *
 * Registration is gated to environments where the local MWA association is
 * actually supported (Android / Seeker). On desktop and iOS it no-ops, leaving
 * the Helius email/passkey experience unchanged.
 */
export default function MobileWalletAdapter() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    let cancelled = false;

    (async () => {
      try {
        const mod = await import("@solana-mobile/wallet-standard-mobile");
        const {
          registerMwa,
          createDefaultAuthorizationCache,
          createDefaultChainSelector,
          createDefaultWalletNotFoundHandler,
        } = mod;

        // `getIsLocalAssociationSupported` ships in the browser build but isn't in
        // the package's published types — access it defensively, with a UA fallback.
        const localSupported = (
          mod as unknown as { getIsLocalAssociationSupported?: () => boolean }
        ).getIsLocalAssociationSupported;
        const supported =
          typeof localSupported === "function"
            ? localSupported()
            : /android/i.test(navigator.userAgent);

        // Only register where native MWA actually works (Android / Seeker).
        if (!supported) return;
        if (cancelled) return;

        registerMwa({
          appIdentity: {
            name: "Echoes",
            uri: "https://app.echoes.fans",
            // Path is resolved relative to `uri` per the MWA spec.
            icon: "/icons/icon-192.png",
          },
          authorizationCache: createDefaultAuthorizationCache(),
          chains: ["solana:mainnet"],
          chainSelector: createDefaultChainSelector(),
          onWalletNotFound: createDefaultWalletNotFoundHandler(),
        });

        if (localStorage.getItem("echoes_debug_wallet") === "1") {
          console.info("%c[mwa]", "color:#c8a84b;font-weight:bold", "Seed Vault / MWA registered");
        }
      } catch (err) {
        console.warn("[mwa] registration skipped:", err);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
