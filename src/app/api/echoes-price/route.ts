import { NextResponse } from "next/server";

const ECHOES_MINT = "8F2N1Da9z1arxiFKmTzxaKoX1yUjJ2xKFQBxxMjQBAGS";
const ECHOES_PAIR = "22ppzkwu9dk2jeyokhseukaz7vv85tqvkdyvpcqtlvmk";

export async function GET() {
  // Primary: query the specific Meteora/Bags pool pair on DexScreener
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/pairs/solana/${ECHOES_PAIR}`,
      { next: { revalidate: 60 } }
    );
    if (res.ok) {
      const json = await res.json();
      // DexScreener always returns a "pairs" array, never a "pair" object
      const price = parseFloat(json.pairs?.[0]?.priceUsd);
      if (price > 0) return NextResponse.json({ price });
    }
  } catch { /* fall through */ }

  // Fallback: search by token mint
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/tokens/${ECHOES_MINT}`,
      { next: { revalidate: 60 } }
    );
    if (res.ok) {
      const json = await res.json();
      const price = parseFloat(json.pairs?.[0]?.priceUsd);
      if (price > 0) return NextResponse.json({ price });
    }
  } catch { /* fall through */ }

  return NextResponse.json({ error: "Price not available" }, { status: 404 });
}
