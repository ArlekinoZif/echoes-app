import { Connection, PublicKey } from "@solana/web3.js";
import { runtimeEnv } from "@/lib/runtime-env";

const ECHOES_MINT = runtimeEnv("NEXT_PUBLIC_ECHOES_TOKEN_MINT") ??
  "8F2N1Da9z1arxiFKmTzxaKoX1yUjJ2xKFQBxxMjQBAGS";
const PLATFORM_WALLET = runtimeEnv("NEXT_PUBLIC_PLATFORM_WALLET") ??
  "7PfDfuoNKzQCCxpRB5B6NFXq6RhuszYYBzbyrLLKkNhB";
const REQUIRED_RAW_AMOUNT = BigInt("2400000000000");

/** Confirm an unreplayed listing signature paid the platform from this wallet. */
export async function verifySolanaListingPayment(signature: string, payer: string): Promise<void> {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)) throw new Error("Invalid Solana signature");
  const payerKey = new PublicKey(payer).toBase58();
  const rpc = runtimeEnv("SOLANA_RPC_URL") ||
    (runtimeEnv("NEXT_PUBLIC_SOLANA_RPC_URL")?.startsWith("http") ? runtimeEnv("NEXT_PUBLIC_SOLANA_RPC_URL") : undefined) ||
    "https://api.mainnet-beta.solana.com";
  const tx = await new Connection(rpc, "confirmed").getParsedTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  if (!tx?.meta || tx.meta.err) throw new Error("Solana listing payment is not confirmed");

  const signerMatches = tx.transaction.message.accountKeys.some(
    (key) => key.signer && key.pubkey.toBase58() === payerKey
  );
  if (!signerMatches) throw new Error("Listing payment was not signed by this wallet");

  const balanceForPlatform = (balances: typeof tx.meta.preTokenBalances) =>
    (balances ?? []).reduce((total, balance) => {
      if (balance.mint !== ECHOES_MINT || balance.owner !== PLATFORM_WALLET) return total;
      return total + BigInt(balance.uiTokenAmount.amount);
    }, BigInt(0));
  const received = balanceForPlatform(tx.meta.postTokenBalances) - balanceForPlatform(tx.meta.preTokenBalances);
  if (received < REQUIRED_RAW_AMOUNT) throw new Error("Listing payment amount or recipient is invalid");
}

export async function verifySolanaTransfer(
  signature: string,
  payer: string,
  recipient: string,
  minimumLamports: number,
): Promise<void> {
  if (!/^[1-9A-HJ-NP-Za-km-z]{64,88}$/.test(signature)) throw new Error("Invalid Solana signature");
  const payerKey = new PublicKey(payer).toBase58();
  const recipientKey = new PublicKey(recipient).toBase58();
  const rpc = runtimeEnv("SOLANA_RPC_URL") ||
    (runtimeEnv("NEXT_PUBLIC_SOLANA_RPC_URL")?.startsWith("http") ? runtimeEnv("NEXT_PUBLIC_SOLANA_RPC_URL") : undefined) ||
    "https://api.mainnet-beta.solana.com";
  const tx = await new Connection(rpc, "confirmed").getParsedTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  if (!tx?.meta || tx.meta.err) throw new Error("Unlock payment is not confirmed");
  const signerMatches = tx.transaction.message.accountKeys.some(
    (key) => key.signer && key.pubkey.toBase58() === payerKey
  );
  if (!signerMatches) throw new Error("Unlock payment was not signed by this wallet");
  const paid = tx.transaction.message.instructions.some((instruction) => {
    if (!("parsed" in instruction)) return false;
    const parsed = instruction.parsed as { type?: string; info?: { source?: string; destination?: string; lamports?: number } };
    return parsed.type === "transfer" && parsed.info?.source === payerKey &&
      parsed.info.destination === recipientKey && (parsed.info.lamports ?? 0) >= minimumLamports;
  });
  if (!paid) throw new Error("Unlock payment amount or recipient is invalid");
}
