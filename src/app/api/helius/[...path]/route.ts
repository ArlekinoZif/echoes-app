import { createHeliusRouteHandler } from "helius-wallet-kit/next";

export const runtime = "nodejs";
export const { GET, POST } = createHeliusRouteHandler();
