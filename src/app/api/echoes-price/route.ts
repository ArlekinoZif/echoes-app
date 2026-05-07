import { NextResponse } from "next/server";

const ECHOES_MINT = "8F2N1Da9z1arxiFKmTzxaKoX1yUjJ2xKFQBxxMjQBAGS";
const ECHOES_PAIR = "22ppzkwu9dk2jeyokhseukaz7vv85tqvkdyvpcqtlvmk";

export async function GET() {
  // Primary: query the specific Meteora pool pair on DexScreener
  try {
    const res = await fetch(
      `https://api.dexscreener.com/latest/dex/pairs/solana/${ECHOES_PAIR}`,
      { next: { revalidate: 60 } }
    );
    if (res.ok) {
      const json = await res.json();
      const price = parseFloat(json.pair?.priceUsd);
      if (price > 0) return NextResponse.json({ price });
    }
  } catch { /* fall through */ }

  // Fallback: search by token mint across all pairs
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

  // Last resort: Jupiter price v2
  try {
    const res = await fetch(
      `https://api.jup.ag/price/v2?ids=${ECHOES_MINT}`,
      { next: { revalidate: 60 } }
    );
    if (res.ok) {
      const json = await res.json();
      const price = parseFloat(json.data?.[ECHOES_MINT]?.price);
      if (price > 0) return NextResponse.json({ price });
    }
  } catch { /* fall through */ }

  return NextResponse.json({ error: "Price not available" }, { status: 404 });
}
