import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "NEON//PULSE — рынки онлайн",
    short_name: "NeonPulse",
    description: "Котировки онлайн, свечные графики, дэйтрейдинг, Finviz и новости",
    lang: "ru",
    start_url: "/?source=pwa",
    scope: "/",
    display: "standalone",
    display_override: ["standalone", "minimal-ui"],
    orientation: "any",
    background_color: "#05010d",
    theme_color: "#05010d",
    categories: ["finance", "business"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      { name: "Дэйтрейдинг", short_name: "Day", url: "/#day", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Крипта и мем-коины", short_name: "Крипто", url: "/crypto", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Виджет для iPhone", short_name: "Виджет", url: "/widget", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
      { name: "Обзор рынка", short_name: "Обзор", url: "/#overview", icons: [{ src: "/icons/icon-192.png", sizes: "192x192" }] },
    ],
  };
}
