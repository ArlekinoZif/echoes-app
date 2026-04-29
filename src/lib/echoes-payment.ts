"use client";

/**
 * $ECHOES listing-gate payment.
 *
 * Transfers $1 worth of ECHOES SPL tokens from the connected wallet
 * to the platform treasury.  Uses Jupiter Price API to derive the amount
 * and builds the SPL-token transfer transaction client-side so Phantom
 * can sign it.
 */

import {
  Connection,
  PublicKey,
  Transaction,
  TransactionInstruction,
} from "@solana/web3.js";
import {
  getAssociatedTokenAddressSync,
  createTransferInstruction,
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";
import { getPhantom } from "./wallet";

const ECHOES_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_ECHOES_TOKEN_MINT ??
    "8F2N1Da9z1arxiFKmTzxaKoX1yUjJ2xKFQBxxMjQBAGS"
);

const PLATFORM_WALLET = new PublicKey(
  process.env.NEXT_PUBLIC_PLATFORM_WALLET ??
    "7PfDfuoNKzQCCxpRB5B6NFXq6RhuszYYBzbyrLLKkNhB"
);

const ECHOES_DECIMALS = 6; // adjust if different
const LISTING_FEE_USD = 1;

/** Fetch the USD price of 1 ECHOES token from Jupiter */
async function getEchoesPriceUsd(): Promise<number> {
  const res = await fetch(
    `https://price.jup.ag/v6/price?ids=${ECHOES_MINT.toString()}`
  );
  if (!res.ok) throw new Error("Failed to fetch ECHOES price from Jupiter");
  const json = await res.json();
  const price: number = json.data?.[ECHOES_MINT.toString()]?.price;
  if (!price) throw new Error("ECHOES price not found in Jupiter response");
  return price;
}

/**
 * Build and send the $1 ECHOES listing payment.
 * Returns the transaction signature.
 */
export async function payListingFee(
  senderWallet: string,
  rpcUrl: string
): Promise<string> {
  const phantom = getPhantom();
  if (!phantom) throw new Error("Phantom not connected");

  // 1. Get price → compute raw token amount
  const priceUsd = await getEchoesPriceUsd();
  const amountTokens = LISTING_FEE_USD / priceUsd;
  const rawAmount = BigInt(Math.ceil(amountTokens * 10 ** ECHOES_DECIMALS));

  // 2. Derive ATAs
  const sender = new PublicKey(senderWallet);
  const senderAta = getAssociatedTokenAddressSync(ECHOES_MINT, sender);
  const platformAta = getAssociatedTokenAddressSync(
    ECHOES_MINT,
    PLATFORM_WALLET
  );

  const connection = new Connection(rpcUrl, "confirmed");
  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();

  const instructions: TransactionInstruction[] = [];

  // 3. Create platform ATA if it doesn't exist yet
  const platformAtaInfo = await connection.getAccountInfo(platformAta);
  if (!platformAtaInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        sender,
        platformAta,
        PLATFORM_WALLET,
        ECHOES_MINT,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  // 4. Transfer instruction
  instructions.push(
    createTransferInstruction(
      senderAta,
      platformAta,
      sender,
      rawAmount,
      [],
      TOKEN_PROGRAM_ID
    )
  );

  // 5. Build transaction
  const tx = new Transaction({
    feePayer: sender,
    blockhash,
    lastValidBlockHeight,
  }).add(...instructions);

  // 6. Sign + send via Phantom
  const signed = await phantom.signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed"
  );
  return sig;
}
