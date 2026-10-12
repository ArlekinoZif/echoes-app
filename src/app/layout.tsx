import type { Metadata, Viewport } from "next";
import { Space_Grotesk } from "next/font/google";
import Image from "next/image";
import "./globals.css";
import "helius-wallet-kit/ui/styles.css";
import NavBar from "@/components/NavBar";
import Onboarding from "@/components/Onboarding";
import AuthGate from "@/components/AuthGate";
import WalletProviders from "@/providers/WalletProviders";
import ServiceWorkerRegister from "@/components/ServiceWorkerRegister";
import MobileWalletAdapter from "@/components/MobileWalletAdapter";

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600", "700"],
  variable: "--font-space",
  display: "swap",
});

const SITE_URL = "https://app.echoes.fans";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  applicationName: "Echoes",
  title: "Echoes — Record. Tokenize. Earn.",
  description: "Record your story, launch a token backed by it, earn every time people trade it.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Echoes",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icons/favicon-48.png", sizes: "48x48", type: "image/png" },
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  openGraph: {
    type: "website",
    siteName: "Echoes",
    title: "Echoes — Record. Tokenize. Earn.",
    description: "Record your story, launch a token backed by it, earn every time people trade it.",
    url: SITE_URL,
  },
};

export const viewport: Viewport = {
  themeColor: "#0c0c0c",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`h-full antialiased ${spaceGrotesk.variable}`}>
      <body className="min-h-full" style={{ background: "var(--bg)" }}>
        <ServiceWorkerRegister />
        <MobileWalletAdapter />
        <WalletProviders>
          <AuthGate>
            {/* ── Decorative background assets ── */}

            {/* Busts — bottom corners */}
            <Image src="/media/bust1.png" alt="" width={340} height={612}
              style={{ width: "auto" }} className="bust-left" loading="eager" />
            <Image src="/media/bust2.png" alt="" width={340} height={612}
              style={{ width: "auto" }} className="bust-right" priority={false} />

            {/* Buddha — desktop background only */}
            <Image src="/media/buddha.png" alt="" width={520} height={700}
              style={{ width: "auto" }} className="buddha-bg" loading="eager" />

            <Onboarding />
            <div className="app-shell">
              <NavBar />
              <main className="app-main">
                {children}
              </main>
            </div>
          </AuthGate>
        </WalletProviders>
      </body>
    </html>
  );
}
