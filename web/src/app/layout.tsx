import type { Metadata, Viewport } from "next";
import "@/styles/globals.css";
import { IconSprite } from "@/components/ui/Icon";
import { UiProvider } from "@/components/ui/UiProvider";

export const metadata: Metadata = {
  title: "Kalkulačka schodů",
  description: "Kalkulace obkladu schodů pro podlahářské firmy",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  colorScheme: "light dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="cs">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Onest:wght@400;500;600&family=IBM+Plex+Sans:wght@400;500;600;700&subset=latin-ext&display=swap" />
      </head>
      <body>
        <IconSprite />
        <UiProvider>{children}</UiProvider>
      </body>
    </html>
  );
}
