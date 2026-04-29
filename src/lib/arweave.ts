"use client";

import { WebUploader } from "@irys/web-upload";
import { WebSolana } from "@irys/web-upload-solana";

export interface ArweaveUploadResult {
  id: string;
  url: string;
  manifestUrl: string;
}

async function getIrys() {
  const provider = (window as unknown as { solana?: unknown }).solana;
  if (!provider) throw new Error("Phantom wallet not found. Install Phantom to continue.");

  const irys = await WebUploader(WebSolana).withProvider(provider);
  return irys;
}

export async function uploadToArweave(
  blob: Blob,
  metadata: { title: string; description: string; category: string }
): Promise<ArweaveUploadResult> {
  const irys = await getIrys();

  const price = await irys.getPrice(blob.size);
  await irys.fund(price);

  const tags = [
    { name: "Content-Type", value: blob.type || "audio/webm" },
    { name: "App-Name", value: "Echoes" },
    { name: "Title", value: metadata.title },
    { name: "Description", value: metadata.description },
    { name: "Category", value: metadata.category },
    { name: "Type", value: "audio-story" },
  ];

  const receipt = await irys.uploadFile(
    new File([blob], "story.webm", { type: blob.type }),
    { tags }
  );

  return {
    id: receipt.id,
    url: `https://arweave.net/${receipt.id}`,
    manifestUrl: `https://gateway.irys.xyz/${receipt.id}`,
  };
}

export async function estimateArweaveCost(sizeBytes: number): Promise<bigint> {
  try {
    const res = await fetch(`https://node1.irys.xyz/price/solana/${sizeBytes}`);
    if (!res.ok) return BigInt(0);
    const atomicPrice = await res.text();
    return BigInt(atomicPrice);
  } catch {
    return BigInt(0);
  }
}
