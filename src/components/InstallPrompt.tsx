"use client";

import { useEffect, useState } from "react";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

type Platform = "ios" | "android" | "desktop";
const HIDE_KEY = "neon-pulse:install-hidden-until";

function detect(): { platform: Platform; standalone: boolean; iosSafari: boolean } {
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const android = /Android/.test(ua);
  const standalone =
    window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  return { platform: ios ? "ios" : android ? "android" : "desktop", standalone, iosSafari: ios && !/CriOS|FxiOS|EdgiOS|YaBrowser/.test(ua) };
}

/** Floating "add to home screen" button + platform instructions; registers the service worker. */
export default function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [env, setEnv] = useState<ReturnType<typeof detect> | null>(null);
  const [visible, setVisible] = useState(false);
  const [help, setHelp] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    const onInstalled = () => {
      setDone(true);
      setVisible(false);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    const t = setTimeout(() => {
      const d = detect();
      setEnv(d);
      let hidden = false;
      try {
        hidden = Number(localStorage.getItem(HIDE_KEY) ?? 0) > Date.now();
      } catch {
        /* ignore */
      }
      setVisible(!d.standalone && !hidden);
    }, 0);
    return () => {
      clearTimeout(t);
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  const install = async () => {
    if (deferred) {
      await deferred.prompt();
      const { outcome } = await deferred.userChoice;
      setDeferred(null);
      if (outcome === "accepted") setVisible(false);
      return;
    }
    setHelp(true);
  };

  const hide = () => {
    setVisible(false);
    try {
      localStorage.setItem(HIDE_KEY, String(Date.now() + 7 * 86400_000));
    } catch {
      /* ignore */
    }
  };

  if (!env || done || (!visible && !help)) return null;

  return (
    <>
      {visible && (
        <div
          className="fixed right-3 z-[60] flex items-center gap-1"
          style={{ bottom: "calc(12px + env(safe-area-inset-bottom))" }}
        >
          <button
            onClick={install}
            className="flex items-center gap-2 border border-brand bg-bg/90 px-3 py-2 text-xs font-semibold tracking-wider text-brand uppercase shadow-[0_0_18px_rgba(5,217,232,0.45)] backdrop-blur-xl transition hover:bg-brand hover:text-black"
          >
            <span className="text-base leading-none">📲</span>
            {env.platform === "desktop" ? "Установить приложение" : "На экран «Домой»"}
          </button>
          <button onClick={hide} aria-label="Скрыть" className="border border-line bg-bg/90 px-2 py-2 text-xs text-faint hover:text-down">
            ✕
          </button>
        </div>
      )}

      {help && (
        <div className="fixed inset-0 z-[70] grid place-items-end bg-black/70 p-3 backdrop-blur-sm sm:place-items-center" onClick={() => setHelp(false)}>
          <div
            className="card w-full max-w-md p-5"
            style={{ marginBottom: "env(safe-area-inset-bottom)" }}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-label="Как установить приложение"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="neon-text text-sm font-bold">Установить NeonPulse</h2>
              <button onClick={() => setHelp(false)} className="text-faint hover:text-down" aria-label="Закрыть">
                ✕
              </button>
            </div>
            <ol className="space-y-3 text-sm text-ink">
              {env.platform === "ios" ? (
                <>
                  {!env.iosSafari && <li className="text-warn">Лучше открыть сайт в Safari — так установка работает надёжнее всего.</li>}
                  <li>
                    1. Нажмите кнопку <b className="text-brand">«Поделиться»</b>{" "}
                    <span className="inline-block border border-brand/50 px-1.5 text-brand">⬆︎</span> внизу экрана Safari (на iPad — вверху).
                  </li>
                  <li>
                    2. Пролистайте меню и выберите <b className="text-brand">«На экран „Домой“»</b>{" "}
                    <span className="inline-block border border-brand/50 px-1.5 text-brand">＋</span>.
                  </li>
                  <li>
                    3. Нажмите <b className="text-brand">«Добавить»</b> — значок NeonPulse появится на рабочем столе.
                  </li>
                </>
              ) : env.platform === "android" ? (
                <>
                  <li>
                    1. Откройте меню браузера <span className="inline-block border border-brand/50 px-1.5 text-brand">⋮</span> (справа вверху в Chrome).
                  </li>
                  <li>
                    2. Выберите <b className="text-brand">«Установить приложение»</b> или <b className="text-brand">«Добавить на главный экран»</b>.
                  </li>
                  <li>3. Подтвердите — значок появится на рабочем столе.</li>
                </>
              ) : (
                <>
                  <li>
                    1. В Chrome или Edge нажмите значок установки <span className="inline-block border border-brand/50 px-1.5 text-brand">⊕</span> в адресной
                    строке справа.
                  </li>
                  <li>
                    2. Или меню <span className="inline-block border border-brand/50 px-1.5 text-brand">⋮</span> → <b className="text-brand">«Установить NeonPulse»</b>.
                  </li>
                  <li>3. Чтобы поставить на телефон — откройте этот же адрес на телефоне.</li>
                </>
              )}
            </ol>
            <p className="mt-4 text-[11px] text-faint">
              Приложение откроется на весь экран без адресной строки, с тем же онлайн-обновлением котировок. Ваш список «Мои акции» сохранится.
            </p>
            {env.platform === "ios" && (
              <a href="/widget" className="mt-3 block border border-neon-pink/60 px-3 py-2 text-center text-xs font-semibold text-neon-pink hover:bg-neon-pink hover:text-black">
                ▣ Ещё можно поставить виджет с котировками на рабочий стол →
              </a>
            )}
          </div>
        </div>
      )}
    </>
  );
}
