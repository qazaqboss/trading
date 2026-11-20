import type { Metadata } from "next";
import CryptoPage from "@/components/crypto/CryptoPage";

export const metadata: Metadata = {
  title: "Крипта онлайн — все монеты и мем-коины · NEON//PULSE",
  description: "Все криптовалюты и мем-коины: цены онлайн, капитализация, графики, тренды, лидеры роста и падения.",
};

export default function Page() {
  return <CryptoPage />;
}
