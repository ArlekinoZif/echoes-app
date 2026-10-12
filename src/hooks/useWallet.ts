"use client";

import { useSolana } from "@phantom/react-sdk";
import { useHeliusWallet } from "helius-wallet-kit";
import { Buffer } from "buffer";
import { Connection, Transaction, VersionedTransaction } from "@solana/web3.js";
import { useAuth } from "@/providers/AuthProvider";
import { getRpcUrl } from "@/lib/rpcUrl";

type SolanaTransaction = Transaction | VersionedTransaction;

function deserializeTransaction(base64: string): SolanaTransaction {
  const bytes = Uint8Array.from(Buffer.from(base64, "base64"));
  try {
    return VersionedTransaction.deserialize(bytes);
  } catch {
    return Transaction.from(bytes);
  }
}

function serializeTransaction(transaction: SolanaTransaction) {
  return transaction instanceof VersionedTransaction
    ? transaction.serialize()
    : transaction.serialize({ requireAllSignatures: false, verifySignatures: false });
}

async function confirmSignature(connection: Connection, signature: string, timeoutMs = 60_000) {
  const startedAt = Date.now();
  while (Date.now() - startedAt < timeoutMs) {
    const { value } = await connection.getSignatureStatuses([signature]);
    const status = value[0];
    if (status?.err) throw new Error("Transaction failed on-chain. Check Solscan.");
    if (status?.confirmationStatus === "confirmed" || status?.confirmationStatus === "finalized") return;
    await new Promise((resolve) => window.setTimeout(resolve, 1_500));
  }
  throw new Error("Not confirmed in time — check Solscan for the signature.");
}

export function useWallet() {
  const auth = useAuth();
  const helius = useHeliusWallet();
  const { solana } = useSolana();
  const connection = helius.connection ?? new Connection(getRpcUrl(), "confirmed");

  function requireAddress() {
    if (!auth.address) throw new Error("Connect a wallet to continue.");
    return auth.address;
  }

  async function connect() {
    if (auth.authenticated && auth.address) return auth.address;
    return (await auth.login()) ?? "";
  }

  async function signTransaction(transaction: Transaction): Promise<Transaction> {
    requireAddress();
    if (auth.provider === "external") {
      const signed = await solana.signTransaction(transaction);
      if (!(signed instanceof Transaction)) {
        throw new Error("Wallet returned an unexpected transaction format.");
      }
      return signed;
    }
    if (helius.status !== "authenticated") {
      throw new Error("Reconnect your Helius wallet, then try again.");
    }
    return Transaction.from(await helius.signTransaction(serializeTransaction(transaction)));
  }

  async function signAllTransactions(transactions: Transaction[]) {
    if (auth.provider === "external") {
      const signed = await solana.signAllTransactions(transactions);
      if (!signed.every((transaction) => transaction instanceof Transaction)) {
        throw new Error("Wallet returned an unexpected transaction format.");
      }
      return signed as Transaction[];
    }
    return Promise.all(transactions.map(signTransaction));
  }

  async function signAndSendAllBase64Txs(base64Transactions: string[]) {
    requireAddress();
    const signatures: string[] = [];
    for (const encoded of base64Transactions) {
      const transaction = deserializeTransaction(encoded);
      let signature: string;
      if (auth.provider === "external") {
        const signed = await solana.signTransaction(transaction);
        signature = await connection.sendRawTransaction(serializeTransaction(signed), {
          skipPreflight: false,
        });
      } else {
        if (helius.status !== "authenticated") {
          throw new Error("Reconnect your Helius wallet, then try again.");
        }
        signature = await helius.signAndSendTransaction(serializeTransaction(transaction));
      }
      await confirmSignature(connection, signature);
      signatures.push(signature);
    }
    return signatures;
  }

  async function signMessage(message: string) {
    requireAddress();
    if (auth.provider === "external") {
      const result = await solana.signMessage(message);
      return Buffer.from(result.signature).toString("base64");
    }
    if (helius.status !== "authenticated") {
      throw new Error("Reconnect your Helius wallet, then try again.");
    }
    const signatureHex = await helius.signMessage(message);
    return Buffer.from(signatureHex, "hex").toString("base64");
  }

  return {
    ready: auth.ready,
    authenticated: auth.authenticated,
    address: auth.address,
    provider: auth.provider,
    connect,
    logout: auth.logout,
    switchWallet: auth.switchWallet,
    signTransaction,
    signAllTransactions,
    signAndSendAllBase64Txs,
    signMessage,
  };
}
