import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Market Pulse — S&P 500, Bitcoin, Золото, Акции",
  description: "Дэшборд рынков: индексы, биткоин, золото, акции, технические сигналы и торговые идеи.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ru" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
