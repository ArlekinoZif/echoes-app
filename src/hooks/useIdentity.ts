"use client";

import { useAuth } from "@/providers/AuthProvider";

/** Wallet addresses are the canonical identity for embedded Helius, browser,
 * and Seed Vault wallets. */
export function useIdentity() {
  const auth = useAuth();
  return {
    ready: auth.ready,
    authenticated: auth.authenticated,
    userId: auth.address,
    email: auth.email,
    twitter: null,
  };
}
