import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Echoes — Preserve your story on-chain",
  description: "Record your story, tokenize forever on Arweave, trade on Bags.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-neutral-950">{children}</body>
    </html>
  );
}
