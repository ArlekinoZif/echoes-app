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
  TOKEN_2022_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  createAssociatedTokenAccountInstruction,
} from "@solana/spl-token";

const ECHOES_MINT = new PublicKey(
  process.env.NEXT_PUBLIC_ECHOES_TOKEN_MINT ??
    "8F2N1Da9z1arxiFKmTzxaKoX1yUjJ2xKFQBxxMjQBAGS"
);

const PLATFORM_WALLET = new PublicKey(
  process.env.NEXT_PUBLIC_PLATFORM_WALLET ??
    "7PfDfuoNKzQCCxpRB5B6NFXq6RhuszYYBzbyrLLKkNhB"
);

const ECHOES_DECIMALS = 9;
const LISTING_FEE_ECHOES = 2400;

/**
 * Build and send the 2400 $ECHOES listing payment.
 * Returns the transaction signature.
 */
export async function payListingFee(
  senderWallet: string,
  rpcUrl: string,
  signTransaction: (tx: Transaction) => Promise<Transaction>
): Promise<string> {

  // Fixed fee: 2400 $ECHOES
  const rawAmount = BigInt(LISTING_FEE_ECHOES * 10 ** ECHOES_DECIMALS);

  const connection = new Connection(rpcUrl, "confirmed");

  // 2. Detect token program (Token vs Token-2022)
  const mintInfo = await connection.getAccountInfo(ECHOES_MINT);
  const tokenProgramId = mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)
    ? TOKEN_2022_PROGRAM_ID
    : TOKEN_PROGRAM_ID;

  // 3. Derive ATAs
  const sender = new PublicKey(senderWallet);
  const senderAta = getAssociatedTokenAddressSync(ECHOES_MINT, sender, false, tokenProgramId);
  const platformAta = getAssociatedTokenAddressSync(ECHOES_MINT, PLATFORM_WALLET, false, tokenProgramId);

  const { blockhash, lastValidBlockHeight } =
    await connection.getLatestBlockhash();

  const instructions: TransactionInstruction[] = [];

  // 4. Create platform ATA if it doesn't exist yet
  const platformAtaInfo = await connection.getAccountInfo(platformAta);
  if (!platformAtaInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        sender,
        platformAta,
        PLATFORM_WALLET,
        ECHOES_MINT,
        tokenProgramId,
        ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  // 5. Transfer instruction
  instructions.push(
    createTransferInstruction(
      senderAta,
      platformAta,
      sender,
      rawAmount,
      [],
      tokenProgramId
    )
  );

  // 6. Build transaction
  const tx = new Transaction({
    feePayer: sender,
    blockhash,
    lastValidBlockHeight,
  }).add(...instructions);

  // 7. Sign + send
  const signed = await signTransaction(tx);
  const sig = await connection.sendRawTransaction(signed.serialize());
  await connection.confirmTransaction(
    { signature: sig, blockhash, lastValidBlockHeight },
    "confirmed"
  );
  return sig;
}
