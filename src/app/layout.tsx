import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NEON//PULSE — S&P 500, Bitcoin, Золото, Акции",
  description: "Киберпанк-дэшборд рынков: индексы, биткоин, золото, акции, технические сигналы и торговые идеи.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full antialiased">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Orbitron:wght@500;700;900&family=Share+Tech+Mono&display=swap"
        />
      </head>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
