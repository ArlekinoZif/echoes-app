import { NextRequest, NextResponse } from "next/server";
import { getSolBalance, getTokenBalances, getRecentTransactions, getStakedSKR } from "@/lib/rpc";
import { SKR_MINT } from "@/lib/seeker";

export async function GET(req: NextRequest) {
  const wallet = req.nextUrl.searchParams.get("wallet");
  if (!wallet) {
    return NextResponse.json({ error: "wallet param required" }, { status: 400 });
  }

  try {
    const [solBalance, tokenBalances, recentTxs, stakedSKR] = await Promise.all([
      getSolBalance(wallet),
      getTokenBalances(wallet),
      getRecentTransactions(wallet, 20),
      getStakedSKR(wallet),
    ]);

    const totalFeesSol = recentTxs
      .filter((tx) => tx.status === "success")
      .reduce((sum, tx) => sum + tx.fee, 0);

    const skrToken = tokenBalances.find((t) => t.mint === SKR_MINT);
    const skrBalance = skrToken?.uiAmount ?? 0;

    return NextResponse.json({
      wallet,
      solBalance,
      skrBalance,
      stakedSkrBalance: stakedSKR.stakedUiAmount,
      stakeAccount: stakedSKR.stakeAccount,
      tokenCount: tokenBalances.length,
      tokens: tokenBalances.slice(0, 20),
      recentTxs,
      estimatedFeeIncomeSol: parseFloat(totalFeesSol.toFixed(6)),
    });
  } catch (err: unknown) {
    console.error("dashboard RPC error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "RPC error" },
      { status: 502 }
    );
  }
}
