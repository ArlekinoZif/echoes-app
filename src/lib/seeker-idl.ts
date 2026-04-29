import { Program, AnchorProvider, Idl, web3 } from "@coral-xyz/anchor";
import { getConnection } from "@/lib/rpc";
import { SKR_STAKING_PROGRAM, SKR_STAKE_CONFIG } from "@/lib/seeker";

let _seekerIdl: Idl | null = null;
let _seekerProgram: Program | null = null;

async function getSeekerProgram(): Promise<Program> {
  if (_seekerProgram) return _seekerProgram;

  const connection = getConnection();
  const programId = new web3.PublicKey(SKR_STAKING_PROGRAM);

  if (!_seekerIdl) {
    // Fetch the IDL stored on-chain by the Anchor IDL registry
    const idl = await Program.fetchIdl(programId, { connection } as AnchorProvider);
    if (!idl) throw new Error("Seeker IDL not found on-chain");
    _seekerIdl = idl as Idl;
  }

  // Read-only provider — no signing needed for account reads
  const provider = new AnchorProvider(
    connection,
    {
      publicKey: web3.PublicKey.default,
      signTransaction: async (tx: web3.Transaction) => tx,
      signAllTransactions: async (txs: web3.Transaction[]) => txs,
    } as unknown as AnchorProvider["wallet"],
    { commitment: "confirmed" }
  );

  // This Anchor version: Program(idl, provider) — programId comes from idl.metadata.address
  _seekerProgram = new Program(_seekerIdl, provider);
  return _seekerProgram;
}

export interface SeekerStakeAccount {
  stakedUiAmount: number;
  stakedRawAmount: bigint;
  stakeAccountAddress: string;
}

export async function fetchSeekerStakeAccount(
  walletAddress: string
): Promise<SeekerStakeAccount> {
  const program = await getSeekerProgram();
  const userPubkey = new web3.PublicKey(walletAddress);
  const stakeConfig = new web3.PublicKey(SKR_STAKE_CONFIG);

  const [stakeAccountPDA] = web3.PublicKey.findProgramAddressSync(
    [Buffer.from("stake"), stakeConfig.toBuffer(), userPubkey.toBuffer()],
    program.programId
  );

  const accountName = findStakeAccountName(program.idl);
  const accounts = program.account as Record<
    string,
    { fetchNullable: (pda: web3.PublicKey) => Promise<Record<string, unknown> | null> }
  >;

  const raw = await accounts[accountName].fetchNullable(stakeAccountPDA);

  if (!raw) {
    return { stakedUiAmount: 0, stakedRawAmount: BigInt(0), stakeAccountAddress: stakeAccountPDA.toBase58() };
  }

  // Try common field names for the staked amount
  const amountRaw =
    raw["depositedAmount"] ??
    raw["stakedAmount"] ??
    raw["amount"] ??
    raw["balance"] ??
    0;

  const rawBigInt = BigInt(amountRaw?.toString() ?? "0");
  const SKR_DECIMALS = 9;

  return {
    stakedUiAmount: Number(rawBigInt) / 10 ** SKR_DECIMALS,
    stakedRawAmount: rawBigInt,
    stakeAccountAddress: stakeAccountPDA.toBase58(),
  };
}

function findStakeAccountName(idl: Idl): string {
  const candidates = ["StakeAccount", "UserStake", "StakeEntry", "StakeState", "Stake"];
  for (const name of candidates) {
    if (idl.accounts?.find((a) => a.name === name)) return name;
  }
  if (idl.accounts?.length) return idl.accounts[0].name;
  throw new Error("No stake account type found in Seeker IDL");
}
