import type { Metadata } from "next";
import WidgetBuilder from "@/components/WidgetBuilder";

export const metadata: Metadata = {
  title: "Виджет котировок для iPhone · NEON//PULSE",
  description: "Виджет на рабочий стол и экран блокировки iPhone: акции, индексы, крипта онлайн. Через Scriptable.",
};

export default function Page() {
  return <WidgetBuilder />;
}
