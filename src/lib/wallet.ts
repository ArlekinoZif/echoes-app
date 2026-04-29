"use client";

export type PhantomProvider = {
  isPhantom: boolean;
  publicKey: { toString(): string } | null;
  isConnected: boolean;
  connect: () => Promise<{ publicKey: { toString(): string } }>;
  disconnect: () => Promise<void>;
};

export function getPhantom(): PhantomProvider | null {
  if (typeof window === "undefined") return null;
  const p = (window as unknown as { solana?: PhantomProvider }).solana;
  return p?.isPhantom ? p : null;
}

export async function connectWallet(): Promise<string> {
  const phantom = getPhantom();
  if (!phantom) throw new Error("Phantom not installed");
  const resp = await phantom.connect();
  return resp.publicKey.toString();
}

export function getConnectedWallet(): string | null {
  const phantom = getPhantom();
  if (!phantom?.isConnected || !phantom.publicKey) return null;
  return phantom.publicKey.toString();
}
