"use client";

import {
  AddressType,
  useAccounts,
  useConnect,
  useDisconnect,
  useModal,
  usePhantom,
  useSolana,
} from "@phantom/react-sdk";
import { useHeliusWallet } from "helius-wallet-kit";
import { Buffer } from "buffer";
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";

export type WalletProviderKind = "helius" | "external";

interface AuthContextValue {
  ready: boolean;
  authenticated: boolean;
  address: string | null;
  provider: WalletProviderKind | null;
  email: string | null;
  googleEnabled: boolean;
  signingIn: boolean;
  error: string | null;
  login: () => Promise<string | null>;
  loginHelius: () => Promise<string | null>;
  loginExternal: () => Promise<string | null>;
  loginGoogle: () => Promise<string | null>;
  logout: () => Promise<void>;
  switchWallet: () => Promise<string | null>;
}

const STORAGE_KEY = "echoes.wallet-provider";
const AuthContext = createContext<AuthContextValue | null>(null);

function friendlyError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return /reject|cancel|denied|declined|closed/i.test(message)
    ? "Sign-in cancelled."
    : message;
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const helius = useHeliusWallet();
  const phantom = usePhantom();
  const accounts = useAccounts();
  const { connect } = useConnect();
  const { disconnect } = useDisconnect();
  const modal = useModal();
  const { solana } = useSolana();
  const heliusRef = useRef(helius);
  const solanaRef = useRef(solana);
  const [preferred, setPreferred] = useState<WalletProviderKind | null>(null);
  const [storageReady, setStorageReady] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [sessionReady, setSessionReady] = useState(false);
  const [sessionLoading, setSessionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attemptedSession = useRef<string | null>(null);

  useEffect(() => {
    heliusRef.current = helius;
    solanaRef.current = solana;
  }, [helius, solana]);

  const externalAddress =
    accounts?.find((account) => account.addressType === AddressType.solana)?.address ?? null;
  const heliusConnected = helius.status === "authenticated" && Boolean(helius.address);
  const externalConnected = phantom.isConnected && Boolean(externalAddress);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved === "helius" || saved === "external") setPreferred(saved);
      setStorageReady(true);
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  const selectProvider = useCallback((provider: WalletProviderKind) => {
    setPreferred(provider);
    window.localStorage.setItem(STORAGE_KEY, provider);
  }, []);

  const provider: WalletProviderKind | null =
    preferred === "external" && externalConnected
      ? "external"
      : preferred === "helius" && heliusConnected
        ? "helius"
        : externalConnected
          ? "external"
          : heliusConnected
            ? "helius"
            : null;

  const address =
    provider === "external" ? externalAddress : provider === "helius" ? helius.address : null;

  useEffect(() => {
    if (!provider || !address) {
      setSessionReady(false);
      attemptedSession.current = null;
      return;
    }
    const key = `${provider}:${address}`;
    let cancelled = false;

    async function establishSession() {
      setSessionLoading(true);
      try {
        const current = await fetch("/api/auth/session", { credentials: "same-origin" });
        const currentData = await current.json().catch(() => ({}));
        if (currentData.authenticated && currentData.address === address) {
          if (!cancelled) setSessionReady(true);
          return;
        }
        if (attemptedSession.current === key) return;
        attemptedSession.current = key;

        const challengeResponse = await fetch("/api/auth/challenge", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address }),
        });
        const challenge = await challengeResponse.json().catch(() => ({}));
        if (!challengeResponse.ok || typeof challenge.message !== "string") {
          throw new Error(challenge.error ?? "Could not start wallet authentication");
        }

        let signature: string;
        if (provider === "external") {
          const signed = await solanaRef.current.signMessage(challenge.message);
          signature = Buffer.from(signed.signature).toString("base64");
        } else {
          const signatureHex = await heliusRef.current.signMessage(challenge.message);
          signature = Buffer.from(signatureHex, "hex").toString("base64");
        }

        const verifyResponse = await fetch("/api/auth/verify", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ address, signature }),
        });
        const verified = await verifyResponse.json().catch(() => ({}));
        if (!verifyResponse.ok || !verified.authenticated) {
          throw new Error(verified.error ?? "Wallet authentication failed");
        }
        if (!cancelled) setSessionReady(true);
      } catch (cause) {
        if (!cancelled) {
          setSessionReady(false);
          setError(friendlyError(cause));
        }
      } finally {
        if (!cancelled) setSessionLoading(false);
      }
    }

    void establishSession();
    return () => {
      cancelled = true;
    };
  }, [address, provider]);

  const loginHelius = useCallback(async () => {
    if (heliusConnected && helius.address) {
      selectProvider("helius");
      return helius.address;
    }
    setSigningIn(true);
    setError(null);
    try {
      selectProvider("helius");
      await helius.login();
      return helius.address;
    } catch (cause) {
      setError(friendlyError(cause));
      return null;
    } finally {
      setSigningIn(false);
    }
  }, [helius, heliusConnected, selectProvider]);

  const loginExternal = useCallback(async () => {
    if (externalConnected && externalAddress) {
      selectProvider("external");
      return externalAddress;
    }
    setError(null);
    selectProvider("external");
    modal.open();
    return null;
  }, [externalAddress, externalConnected, modal, selectProvider]);

  const googleEnabled = Boolean(
    process.env.NEXT_PUBLIC_PHANTOM_APP_ID?.trim() &&
      process.env.NEXT_PUBLIC_PHANTOM_REDIRECT_URL?.trim()
  );

  const loginGoogle = useCallback(async () => {
    if (!googleEnabled) {
      setError("Google sign-in needs a Phantom Connect App ID.");
      return null;
    }
    setSigningIn(true);
    setError(null);
    try {
      selectProvider("external");
      const result = await connect({ provider: "google" });
      return result.addresses.find((item) => item.addressType === AddressType.solana)?.address ?? null;
    } catch (cause) {
      setError(friendlyError(cause));
      return null;
    } finally {
      setSigningIn(false);
    }
  }, [connect, googleEnabled, selectProvider]);

  const logout = useCallback(async () => {
    setError(null);
    window.localStorage.removeItem(STORAGE_KEY);
    setPreferred(null);
    setSessionReady(false);
    attemptedSession.current = null;
    const pending: Promise<unknown>[] = [];
    pending.push(fetch("/api/auth/logout", { method: "POST", credentials: "same-origin" }));
    if (heliusConnected) pending.push(helius.logout());
    if (phantom.isConnected) pending.push(disconnect());
    await Promise.allSettled(pending);
  }, [disconnect, helius, heliusConnected, phantom.isConnected]);

  const value = useMemo<AuthContextValue>(
    () => ({
      ready: storageReady && helius.status !== "loading" && !phantom.isLoading,
      authenticated: Boolean(provider && address && sessionReady),
      address,
      provider,
      email: provider === "helius" ? (helius.user?.email ?? null) : null,
      googleEnabled,
      signingIn: signingIn || sessionLoading || phantom.isConnecting,
      error: error ?? phantom.errors.connect?.message ?? null,
      login: loginExternal,
      loginHelius,
      loginExternal,
      loginGoogle,
      logout,
      switchWallet: loginExternal,
    }),
    [
      address,
      error,
      googleEnabled,
      helius.status,
      helius.user?.email,
      loginExternal,
      loginGoogle,
      loginHelius,
      logout,
      phantom.errors.connect?.message,
      phantom.isConnecting,
      phantom.isLoading,
      provider,
      sessionLoading,
      sessionReady,
      signingIn,
      storageReady,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside <AuthProvider>");
  return value;
}
