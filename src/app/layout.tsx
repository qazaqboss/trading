import type { Metadata, Viewport } from "next";
import InstallPrompt from "@/components/InstallPrompt";
import "./globals.css";

export const metadata: Metadata = {
  title: "NEON//PULSE — S&P 500, Bitcoin, Золото, Акции",
  description: "Киберпанк-дэшборд рынков: котировки онлайн, свечные графики, дэйтрейдинг, Finviz и новости.",
  applicationName: "NeonPulse",
  appleWebApp: {
    capable: true,
    title: "NeonPulse",
    statusBarStyle: "black-translucent",
  },
  formatDetection: { telephone: false },
};

export const viewport: Viewport = {
  themeColor: "#05010d",
  colorScheme: "dark",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
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
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Orbitron:wght@900&display=swap"
        />
      </head>
      <body className="min-h-full">
        {children}
        <InstallPrompt />
      </body>
    </html>
  );
}
