import { NextResponse } from "next/server";

const ECHOES_MINT = "8F2N1Da9z1arxiFKmTzxaKoX1yUjJ2xKFQBxxMjQBAGS";

export async function GET() {
  const res = await fetch(
    `https://api.jup.ag/price/v2?ids=${ECHOES_MINT}`,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) return NextResponse.json({ error: "Jupiter unavailable" }, { status: 502 });
  const json = await res.json();
  const price = parseFloat(json.data?.[ECHOES_MINT]?.price);
  if (!price) return NextResponse.json({ error: "Price not found" }, { status: 404 });
  return NextResponse.json({ price });
}
