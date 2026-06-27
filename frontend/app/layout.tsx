import type { Metadata } from "next";
import "./globals.css";
import { GlobalBgmPlayer } from "@/components/layout/GlobalBgmPlayer";
import { Providers } from "@/components/layout/providers";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: site.name,
  description: site.description,
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
    apple: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body>
        <Providers>
          <main>{children}</main>
          <GlobalBgmPlayer />
        </Providers>
      </body>
    </html>
  );
}
