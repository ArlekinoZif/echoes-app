"use client";

import { usePrivy, useActiveWallet } from "@privy-io/react-auth";
import { useWallets as useSolanaWallets, useCreateWallet } from "@privy-io/react-auth/solana";
import { Transaction, Connection } from "@solana/web3.js";

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ?? "https://api.mainnet-beta.solana.com";

export function useWallet() {
  const { ready, authenticated, login, logout } = usePrivy();
  const { wallet: activeWallet, setActiveWallet } = useActiveWallet();
  const { wallets } = useSolanaWallets();
  const { createWallet } = useCreateWallet();

  // Use the active wallet Privy has designated, matched against Solana wallets.
  // Only fall back to wallets[0] when no active wallet is set at all — never
  // auto-switch to a different wallet if the user already has one selected.
  const activeAddress = (activeWallet as { address?: string } | undefined)?.address;
  const solanaWallet = activeAddress
    ? (wallets.find((w) => w.address === activeAddress) ?? null)
    : (wallets[0] ?? null);
  const address = solanaWallet?.address ?? null;

  async function connect(): Promise<string> {
    if (!authenticated) {
      await login();
      return address ?? "";
    }
    if (!address) {
      try { await createWallet(); } catch { /* already exists */ }
    }
    return address ?? "";
  }

  async function signTransaction(tx: Transaction): Promise<Transaction> {
    if (!solanaWallet) throw new Error("No Solana wallet connected");
    const serialized = tx.serialize({ requireAllSignatures: false, verifySignatures: false });
    const { signedTransaction } = await (solanaWallet as unknown as {
      signTransaction(input: { transaction: Uint8Array }): Promise<{ signedTransaction: Uint8Array }>;
    }).signTransaction({ transaction: serialized });
    return Transaction.from(Buffer.from(signedTransaction));
  }

  async function signAllTransactions(txs: Transaction[]): Promise<Transaction[]> {
    return Promise.all(txs.map((tx) => signTransaction(tx)));
  }

  async function signAndSendAllBase64Txs(base64Txs: string[]): Promise<string[]> {
    if (!solanaWallet) throw new Error("No Solana wallet connected");
    const connection = new Connection(RPC_URL, "confirmed");
    const sigs: string[] = [];
    for (const b64 of base64Txs) {
      const txBytes = Buffer.from(b64, "base64");
      const { signedTransaction } = await (solanaWallet as unknown as {
        signTransaction(input: { transaction: Uint8Array }): Promise<{ signedTransaction: Uint8Array }>;
      }).signTransaction({ transaction: txBytes });
      const sig = await connection.sendRawTransaction(Buffer.from(signedTransaction));
      await connection.confirmTransaction(sig, "confirmed");
      sigs.push(sig);
    }
    return sigs;
  }

  return {
    ready,
    authenticated,
    address,
    connect,
    logout,
    signTransaction,
    signAllTransactions,
    signAndSendAllBase64Txs,
    setActiveWallet,
  };
}
