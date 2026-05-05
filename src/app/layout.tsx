import type { Metadata } from "next";
import { Space_Grotesk } from "next/font/google";
import "./globals.css";
import NavBar from "@/components/NavBar";
import Onboarding from "@/components/Onboarding";
import Providers from "@/providers/PrivyProvider";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-space",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Echoes — Record. Tokenize. Earn.",
  description: "Record your story, launch a token backed by it, earn every time people trade it.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${spaceGrotesk.variable}`}>
      <body className="min-h-full flex flex-col pb-24" style={{ background: "var(--bg)" }}>
        <Providers>
          {children}
          <NavBar />
          <Onboarding />
        </Providers>
      </body>
    </html>
  );
}
