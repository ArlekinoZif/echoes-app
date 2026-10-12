import { getRpcUrl } from "@/lib/rpcUrl";
import { runtimeEnv } from "@/lib/runtime-env";

/** The server-side RPC (Helius in production), never the browser proxy. */
const serverRpcUrl = () => runtimeEnv("SOLANA_RPC_URL") ?? getRpcUrl();

/**
 * Seeker Genesis Token check, following Solana Mobile's published procedure
 * (docs.solanamobile.com, "Seeker Genesis Token"): a Token-2022 NFT minted once
 * per Seeker into its Seed Vault Wallet. A token counts only if its mint was
 * created by the SGT mint authority and belongs to the SGT group.
 */
const TOKEN_2022 = "TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb";
const SGT_MINT_AUTHORITY = "GT2zuHVaZQYZSyQMgJPLzvkmyztfyXg2NJunqFp4p3A4";
const SGT_GROUP = "GT22s89nU4iWFkNXj1Bw6uYhJJWDRPpShHt4Bk8f99Te";

async function rpc<T>(method: string, params: unknown[]): Promise<T> {
  const res = await fetch(serverRpcUrl(), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ jsonrpc: "2.0", id: 1, method, params }),
    signal: AbortSignal.timeout(15_000),
  });
  const json = await res.json();
  if (json.error) throw new Error(json.error.message ?? "RPC error");
  return json.result as T;
}

interface ParsedTokenAccount {
  account: { data: { parsed: { info: { mint: string; tokenAmount: { amount: string } } } } };
}

interface ParsedMint {
  data?: {
    parsed?: {
      info?: {
        mintAuthority?: string | null;
        extensions?: { extension: string; state?: Record<string, unknown> }[];
      };
    };
  };
}

/** Returns the wallet's SGT mint address, or null when it holds none. */
export async function findSeekerGenesisToken(wallet: string): Promise<string | null> {
  const accounts = await rpc<{ value: ParsedTokenAccount[] }>("getTokenAccountsByOwner", [
    wallet,
    { programId: TOKEN_2022 },
    { encoding: "jsonParsed" },
  ]);
  // A transferred SGT leaves an empty account behind; only a held one counts.
  const mints = accounts.value
    .map((a) => a.account.data.parsed.info)
    .filter((info) => info.tokenAmount.amount !== "0")
    .map((info) => info.mint);

  for (let i = 0; i < mints.length; i += 100) {
    const batch = mints.slice(i, i + 100);
    const result = await rpc<{ value: (ParsedMint | null)[] }>("getMultipleAccounts", [batch, { encoding: "jsonParsed" }]);
    for (let j = 0; j < batch.length; j++) {
      const info = result.value[j]?.data?.parsed?.info;
      if (!info || info.mintAuthority !== SGT_MINT_AUTHORITY) continue;
      const ext = (name: string) => info.extensions?.find((e) => e.extension === name)?.state ?? {};
      if (ext("metadataPointer").metadataAddress !== SGT_GROUP) continue;
      if (ext("tokenGroupMember").group !== SGT_GROUP) continue;
      return batch[j];
    }
  }
  return null;
}
