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
      <body>
        <IconSprite />
        <UiProvider>{children}</UiProvider>
      </body>
    </html>
  );
}
