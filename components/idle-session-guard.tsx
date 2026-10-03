"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";
import { IDLE_LIMIT_MS, idleState, idleStorageKey } from "@/lib/idle-session";
import { Button } from "@/components/ui/button";

export function IdleSessionGuard({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!hasEnvVars);
  const [expired, setExpired] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const resume = useRef<() => void>(() => {});
  useEffect(() => {
    if (!hasEnvVars) return;
    const client = createClient();
    let stopped = false, ending = false, last = Date.now(), lastWrite = 0;
    let key = "";
    const read = () => {
      try { const value = localStorage.getItem(key); if (value !== null) last = Number(value); } catch { /* use in-memory clock when browser storage is unavailable */ }
      return last;
    };
    const write = (now: number) => {
      last = now; lastWrite = now;
      try { localStorage.setItem(key, String(now)); } catch { /* timer still applies in this open tab */ }
    };
    const end = async () => {
      if (ending || stopped) return;
      ending = true;
      window.dispatchEvent(new Event("security-session-ending"));
      setExpired(true); setRemaining(null);
      try {
        const { error } = await client.auth.signOut({ scope: "local" });
        if (error) throw error;
        window.location.replace("/auth/login?reason=idle");
      } catch {
        if (!stopped) setNotice("자동 로그아웃 요청에 실패했습니다. 업무화면은 잠겼습니다. 다시 로그인해 주세요.");
      }
    };
    const check = () => {
      if (!key || stopped || ending) return;
      const now = Date.now(), state = idleState(read(), now);
      if (state === "expired") { void end(); return; }
      setRemaining(state === "warning" ? Math.max(1, Math.ceil((IDLE_LIMIT_MS - (now - last)) / 60000)) : null);
    };
    const activity = (event?: Event) => {
      if (!key || stopped || ending || document.visibilityState !== "visible" || (event && !event.isTrusted)) return;
      const now = Date.now();
      // An input after timeout must not resurrect an expired session.
      if (idleState(read(), now) === "expired") { void end(); return; }
      if (now - lastWrite >= 1000) write(now);
      setRemaining(null);
    };
    resume.current = () => activity();
    const init = async () => {
      const { data, error } = await client.auth.getSession();
      if (stopped) return;
      if (error || !data.session) { window.location.replace("/auth/login"); return; }
      key = idleStorageKey(data.session.user.id, data.session.access_token);
      try { if (localStorage.getItem(key) === null) write(Date.now()); } catch { /* memory-only fallback */ }
      check(); setReady(true);
    };
    void init().catch(() => { if (!stopped) { setExpired(true); setNotice("세션을 확인하지 못했습니다. 다시 로그인해 주세요."); } });
    const events = ["pointerdown", "keydown", "wheel", "touchstart"];
    events.forEach((name) => window.addEventListener(name, activity, { passive: true }));
    const onStorage = (event: StorageEvent) => { if (event.key === key) check(); };
    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", check);
    window.addEventListener("focus", check);
    const timer = window.setInterval(check, 15000);
    const { data: listener } = client.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT" && !stopped) {
        window.dispatchEvent(new Event("security-session-ending"));
        window.location.replace("/auth/login?reason=idle");
      }
    });
    return () => {
      stopped = true; resume.current = () => {};
      window.clearInterval(timer); listener.subscription.unsubscribe();
      events.forEach((name) => window.removeEventListener(name, activity));
      window.removeEventListener("storage", onStorage); window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  if (expired) return <div className="grid min-h-screen place-items-center bg-slate-50 p-6"><section role="alert" className="max-w-lg rounded-xl border bg-white p-8"><h1 className="text-xl font-semibold">세션이 종료되었습니다</h1><p className="mt-3 text-sm text-slate-600">1시간 미사용으로 업무화면을 잠갔습니다. 저장하지 않은 입력은 보존되지 않을 수 있습니다.</p>{notice && <p className="mt-3 text-sm text-red-800">{notice}</p>}<a className="mt-5 inline-block font-medium text-blue-800" href="/auth/login?reason=idle">다시 로그인</a></section></div>;
  if (!ready) return <p role="status" className="p-6 text-sm text-slate-500">세션을 확인하는 중입니다.</p>;
  return <>{remaining !== null && <div role="alert" className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-lg"><p className="text-sm text-amber-950">미사용으로 약 {remaining}분 후 자동 로그아웃됩니다. 입력 중인 내용은 저장해 주세요.</p><Button variant="outline" onClick={() => resume.current()}>계속 작업</Button></div>}{children}</>;
}
