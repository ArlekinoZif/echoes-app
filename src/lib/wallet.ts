"use client";

import { Transaction, Connection } from "@solana/web3.js";

export type PhantomProvider = {
  isPhantom: boolean;
  publicKey: { toString(): string; toBytes(): Uint8Array } | null;
  isConnected: boolean;
  connect: () => Promise<{ publicKey: { toString(): string } }>;
  disconnect: () => Promise<void>;
  signTransaction: (tx: Transaction) => Promise<Transaction>;
  signAllTransactions: (txs: Transaction[]) => Promise<Transaction[]>;
  signAndSendTransaction: (
    tx: Transaction
  ) => Promise<{ signature: string }>;
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

/** Sign a single base64-encoded transaction and broadcast it. Returns the signature. */
export async function signAndSendBase64Tx(
  base64Tx: string,
  rpcUrl: string
): Promise<string> {
  const phantom = getPhantom();
  if (!phantom) throw new Error("Phantom not connected");

  const buffer = Buffer.from(base64Tx, "base64");
  const tx = Transaction.from(buffer);

  const signed = await phantom.signTransaction(tx);
  const connection = new Connection(rpcUrl, "confirmed");
  const sig = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction(sig, "confirmed");
  return sig;
}

/** Sign and send multiple base64-encoded transactions in sequence. Returns all sigs. */
export async function signAndSendAllBase64Txs(
  base64Txs: string[],
  rpcUrl: string
): Promise<string[]> {
  const phantom = getPhantom();
  if (!phantom) throw new Error("Phantom not connected");

  const txs = base64Txs.map((b64) => Transaction.from(Buffer.from(b64, "base64")));
  const signedTxs = await phantom.signAllTransactions(txs);

  const connection = new Connection(rpcUrl, "confirmed");
  const sigs: string[] = [];
  for (const signed of signedTxs) {
    const sig = await connection.sendRawTransaction(signed.serialize());
    await connection.confirmTransaction(sig, "confirmed");
    sigs.push(sig);
  }
  return sigs;
}
