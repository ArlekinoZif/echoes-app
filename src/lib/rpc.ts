import { Connection, PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { SKR_STAKING_PROGRAM, SKR_STAKE_CONFIG } from "@/lib/seeker";
import { fetchSeekerStakeAccount } from "@/lib/seeker-idl";

const RPC_URL =
  process.env.NEXT_PUBLIC_SOLANA_RPC_URL ??
  "https://api.mainnet-beta.solana.com";

let _connection: Connection | null = null;
export function getConnection(): Connection {
  if (!_connection) _connection = new Connection(RPC_URL, "confirmed");
  return _connection;
}

export async function getSolBalance(walletAddress: string): Promise<number> {
  const conn = getConnection();
  const lamports = await conn.getBalance(new PublicKey(walletAddress));
  return lamports / LAMPORTS_PER_SOL;
}

export interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  uiAmount: number;
}

export async function getTokenBalances(walletAddress: string): Promise<TokenBalance[]> {
  const conn = getConnection();
  const resp = await conn.getParsedTokenAccountsByOwner(new PublicKey(walletAddress), {
    programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"),
  });

  return resp.value
    .map((acc) => {
      const info = acc.account.data.parsed.info;
      return {
        mint: info.mint as string,
        amount: Number(info.tokenAmount.amount),
        decimals: info.tokenAmount.decimals as number,
        uiAmount: (info.tokenAmount.uiAmount as number) ?? 0,
      };
    })
    .filter((t) => t.uiAmount > 0);
}

export interface StakedSKR {
  stakedAmount: number;   // raw token units
  stakedUiAmount: number; // human-readable (decimals applied)
  stakeAccount: string | null;
}

/**
 * Fetches staked SKR using the on-chain Seeker IDL (via Anchor's Program.fetchIdl).
 * Falls back to manual byte-offset parsing if the IDL fetch fails.
 */
export async function getStakedSKR(walletAddress: string): Promise<StakedSKR> {
  // Primary: IDL-based deserialization — correct regardless of field order
  try {
    const result = await fetchSeekerStakeAccount(walletAddress);
    return {
      stakedAmount: Number(result.stakedRawAmount),
      stakedUiAmount: result.stakedUiAmount,
      stakeAccount: result.stakeAccountAddress,
    };
  } catch (idlErr) {
    console.warn("Seeker IDL fetch failed, falling back to manual parsing:", idlErr);
  }

  // Fallback: manual byte-offset parsing (offset 72 = 8 discriminator + 32 + 32)
  const conn = getConnection();
  const stakingProgram = new PublicKey(SKR_STAKING_PROGRAM);
  const stakeConfig = new PublicKey(SKR_STAKE_CONFIG);
  const [stakeAccountPDA] = PublicKey.findProgramAddressSync(
    [Buffer.from("stake"), stakeConfig.toBuffer(), new PublicKey(walletAddress).toBuffer()],
    stakingProgram
  );

  const accountInfo = await conn.getAccountInfo(stakeAccountPDA);
  if (!accountInfo) return { stakedAmount: 0, stakedUiAmount: 0, stakeAccount: null };

  const OFFSET = 72;
  if (accountInfo.data.length < OFFSET + 8) {
    return { stakedAmount: 0, stakedUiAmount: 0, stakeAccount: stakeAccountPDA.toBase58() };
  }

  const lo = accountInfo.data.readUInt32LE(OFFSET);
  const hi = accountInfo.data.readUInt32LE(OFFSET + 4);
  const stakedAmount = hi * 0x100000000 + lo;
  return {
    stakedAmount,
    stakedUiAmount: stakedAmount / 1e9,
    stakeAccount: stakeAccountPDA.toBase58(),
  };
}

export interface RecentTx {
  signature: string;
  blockTime: number | null;
  fee: number;
  status: "success" | "failed";
}

export async function getRecentTransactions(
  walletAddress: string,
  limit = 10
): Promise<RecentTx[]> {
  const conn = getConnection();
  const sigs = await conn.getSignaturesForAddress(new PublicKey(walletAddress), { limit });

  return sigs.map((s) => ({
    signature: s.signature,
    blockTime: s.blockTime ?? null,
    fee: 0,
    status: s.err ? "failed" : "success",
  }));
}
