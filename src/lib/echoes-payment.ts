"use client";

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
 * Uses the same signAndSendAllBase64Txs path as the tokenize flow.
 * Returns the transaction signature.
 */
export async function payListingFee(
  senderWallet: string,
  rpcUrl: string,
  signAndSendAllBase64Txs: (txs: string[]) => Promise<string[]>
): Promise<string> {
  const rawAmount = BigInt(LISTING_FEE_ECHOES * 10 ** ECHOES_DECIMALS);
  const connection = new Connection(rpcUrl, "confirmed");

  const mintInfo = await connection.getAccountInfo(ECHOES_MINT);
  const tokenProgramId = mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID)
    ? TOKEN_2022_PROGRAM_ID
    : TOKEN_PROGRAM_ID;

  const sender = new PublicKey(senderWallet);
  const senderAta = getAssociatedTokenAddressSync(ECHOES_MINT, sender, false, tokenProgramId);
  const platformAta = getAssociatedTokenAddressSync(ECHOES_MINT, PLATFORM_WALLET, false, tokenProgramId);

  const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();

  const instructions: TransactionInstruction[] = [];

  const platformAtaInfo = await connection.getAccountInfo(platformAta);
  if (!platformAtaInfo) {
    instructions.push(
      createAssociatedTokenAccountInstruction(
        sender, platformAta, PLATFORM_WALLET, ECHOES_MINT,
        tokenProgramId, ASSOCIATED_TOKEN_PROGRAM_ID
      )
    );
  }

  instructions.push(
    createTransferInstruction(senderAta, platformAta, sender, rawAmount, [], tokenProgramId)
  );

  const tx = new Transaction({ feePayer: sender, blockhash, lastValidBlockHeight })
    .add(...instructions);

  const b64 = tx.serialize({ requireAllSignatures: false, verifySignatures: false }).toString("base64");
  const [sig] = await signAndSendAllBase64Txs([b64]);
  return sig;
}
