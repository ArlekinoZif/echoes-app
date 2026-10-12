"use client";

import { PhantomProvider, AddressType, darkTheme, type PhantomSDKConfig } from "@phantom/react-sdk";
import { HeliusWalletProvider } from "helius-wallet-kit";
import AuthProvider from "@/providers/AuthProvider";

const phantomAppId = process.env.NEXT_PUBLIC_PHANTOM_APP_ID?.trim();
const phantomRedirectUrl = process.env.NEXT_PUBLIC_PHANTOM_REDIRECT_URL?.trim();
const googleEnabled = Boolean(phantomAppId && phantomRedirectUrl);

const phantomConfig: PhantomSDKConfig = {
  providers: googleEnabled ? ["google", "injected"] : ["injected"],
  addressTypes: [AddressType.solana],
  ...(googleEnabled
    ? { appId: phantomAppId, authOptions: { redirectUrl: phantomRedirectUrl } }
    : {}),
};

export default function WalletProviders({ children }: { children: React.ReactNode }) {
  return (
    <HeliusWalletProvider
      config={{
        cluster: "mainnet-beta",
        authMethods: {
          email: true,
          passkey: true,
          sms: false,
          wallet: false,
          google: false,
          apple: false,
          discord: false,
          x: false,
        },
        theme: {
          darkMode: true,
          primaryColor: "#c8a84b",
          borderRadius: "12px",
          logoLight: "/media/logo-white.png",
          logoDark: "/media/logo-white.png",
        },
      }}
    >
      <PhantomProvider
        config={phantomConfig}
        appName="Echoes"
        appIcon="https://app.echoes.fans/icon.png"
        theme={darkTheme}
      >
        <AuthProvider>{children}</AuthProvider>
      </PhantomProvider>
    </HeliusWalletProvider>
  );
}
