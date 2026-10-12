"use client";

// Lazy-loaded $ECHO balance widget. Kept in its own file (dynamically imported
// by NavBar) so the heavy @solana/web3.js + spl-token graph is NOT bundled into
// the global layout that every route depends on — only loaded when a wallet is
// actually connected.

import { useEffect, useState } from "react";
import { Connection, PublicKey } from "@solana/web3.js";
import { getAssociatedTokenAddressSync, TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import { getRpcUrl } from "@/lib/rpcUrl";

const ECHOES_MINT = new PublicKey("8F2N1Da9z1arxiFKmTzxaKoX1yUjJ2xKFQBxxMjQBAGS");
const RPC_URL = getRpcUrl();

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toFixed(0);
}

export default function EchoBalance({ address }: { address: string }) {
  const [bal, setBal] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const conn = new Connection(RPC_URL, "confirmed");
        const pk = new PublicKey(address);
        const mintInfo = await conn.getAccountInfo(ECHOES_MINT);
        const prog = mintInfo?.owner.equals(TOKEN_2022_PROGRAM_ID) ? TOKEN_2022_PROGRAM_ID : TOKEN_PROGRAM_ID;
        const ata = getAssociatedTokenAddressSync(ECHOES_MINT, pk, false, prog);
        const b = await conn.getTokenAccountBalance(ata);
        if (!cancelled) setBal(b.value.uiAmount ?? 0);
      } catch {
        if (!cancelled) setBal(0);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [address]);

  if (bal === null) return (
    <div className="h-3 w-14 rounded animate-pulse" style={{ background: "rgba(200,168,75,0.15)" }} />
  );

  return (
    <span className="text-xs font-bold tabular-nums" style={{ color: "#c8a84b" }}>
      {fmt(bal)} <span style={{ color: "rgba(200,168,75,0.5)", fontWeight: 500 }}>$ECHO</span>
    </span>
  );
}
