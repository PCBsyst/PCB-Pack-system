"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";
import { IDLE_LIMIT_MS, IDLE_WARNING_MS, idleState, idleStorageKey } from "@/lib/idle-session";
import { Button } from "@/components/ui/button";
import { parseServerIdleStatus } from "@/lib/server-idle-session";

export function IdleSessionGuard({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(!hasEnvVars);
  const [loaded, setLoaded] = useState(!hasEnvVars);
  const [expired, setExpired] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [notice, setNotice] = useState("");
  const resume = useRef<() => void>(() => {});
  const verify = useRef<() => void>(() => {});
  useEffect(() => {
    if (!hasEnvVars) return;
    const client = createClient();
    let stopped = false, ending = false, last = Date.now(), lastWrite = 0;
    let key = "";
    let serverDeadline = 0, lastServerWrite = -Infinity, lastServerRead = -Infinity;
    let inFlight = false, pendingActivity = false, verificationFailed = false;
    let controller: AbortController | null = null;
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
    const sync = async (activityRequest = false) => {
      if (stopped || ending) return;
      if (inFlight) { if (activityRequest) pendingActivity = true; return; }
      inFlight = true;
      const requestStarted = performance.now();
      controller = new AbortController();
      const requestController = controller;
      const timeout = window.setTimeout(() => requestController.abort(), 10000);
      try {
        const response = await fetch("/api/session/activity", { method: activityRequest ? "POST" : "GET", cache: "no-store", signal: requestController.signal });
        if (stopped || ending) return;
        if (response.status === 401 || response.status === 403) { setNotice("서버에서 세션 또는 직원 권한이 종료된 것으로 확인됐습니다. 다시 로그인해 주세요."); await end(); return; }
        if (!response.ok) throw new Error("세션 확인 실패");
        const result = await response.json();
        if (stopped || ending) return;
        if (result?.mode === "legacy") {
          serverDeadline = 0;
          setNotice("서버 미사용 시간 보호는 SQL 032 적용 대기입니다. 현재 브라우저의 1시간 미사용 잠금만 적용됩니다.");
        } else {
          const parsed = result?.mode === "ready" ? parseServerIdleStatus({ valid: true, serverNow: result.serverNow, expiresAt: result.expiresAt }) : { mode: "unavailable" };
          if (parsed.mode !== "ready" || !("expiresAt" in parsed)) throw new Error("세션 응답 오류");
          serverDeadline = requestStarted + Date.parse(parsed.expiresAt) - Date.parse(parsed.serverNow);
          setNotice("");
        }
        verificationFailed = false; lastServerRead = performance.now();
        if (activityRequest) lastServerWrite = performance.now();
        setReady(true); setLoaded(true);
      } catch {
        if (!stopped && !ending) {
          verificationFailed = true; pendingActivity = false; setReady(false);
          setNotice("서버 세션을 확인하지 못해 업무화면을 잠시 숨겼습니다. 연결을 확인하고 재점검해 주세요. 입력값을 완료 처리하지 않습니다.");
        }
      } finally {
        window.clearTimeout(timeout); inFlight = false;
        if (controller === requestController) controller = null;
        if (pendingActivity && !stopped && !ending && !verificationFailed) {
          pendingActivity = false;
          if (performance.now() - lastServerWrite >= 30000) void sync(true);
        }
      }
    };
    verify.current = () => { void sync(); };
    const check = () => {
      if (!key || stopped || ending) return;
      const now = Date.now(), state = idleState(read(), now);
      if (state === "expired" || (serverDeadline && performance.now() >= serverDeadline)) { void end(); return; }
      if (!verificationFailed && performance.now() - lastServerRead >= 60000) void sync();
      const remainingMs = Math.min(IDLE_LIMIT_MS - (now - last), serverDeadline ? serverDeadline - performance.now() : Infinity);
      setRemaining(remainingMs <= IDLE_WARNING_MS ? Math.max(1, Math.ceil(remainingMs / 60000)) : null);
    };
    const activity = (event?: Event) => {
      if (!key || stopped || ending || verificationFailed || document.visibilityState !== "visible" || (event && !event.isTrusted)) return;
      const now = Date.now();
      // An input after timeout must not resurrect an expired session.
      if (idleState(read(), now) === "expired" || (serverDeadline && performance.now() >= serverDeadline)) { void end(); return; }
      if (now - lastWrite >= 1000) write(now);
      setRemaining(null);
      if (performance.now() - lastServerWrite >= 30000) void sync(true);
    };
    resume.current = () => activity();
    const init = async () => {
      const { data, error } = await client.auth.getSession();
      if (stopped) return;
      if (error || !data.session) { window.location.replace("/auth/login"); return; }
      key = idleStorageKey(data.session.user.id, data.session.access_token);
      try { if (localStorage.getItem(key) === null) write(Date.now()); } catch { /* memory-only fallback */ }
      await sync(); check();
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
      stopped = true; resume.current = () => {}; verify.current = () => {}; controller?.abort();
      window.clearInterval(timer); listener.subscription.unsubscribe();
      events.forEach((name) => window.removeEventListener(name, activity));
      window.removeEventListener("storage", onStorage); window.removeEventListener("focus", check);
      document.removeEventListener("visibilitychange", check);
    };
  }, []);
  if (expired) return <div className="grid min-h-screen place-items-center bg-background p-6"><section role="alert" className="max-w-lg rounded-xl border bg-card p-8"><h1 className="text-xl font-semibold">세션이 종료되었습니다</h1><p className="mt-3 text-sm text-muted-foreground">미사용 제한 또는 서버 세션·계정 상태 변경으로 업무화면을 잠갔습니다. 저장하지 않은 입력은 보존되지 않을 수 있습니다.</p>{notice && <p className="mt-3 text-sm text-red-800">{notice}</p>}<a className="mt-5 inline-block font-medium text-blue-800" href="/auth/login?reason=idle">다시 로그인</a></section></div>;
  return <>{!ready && <section role="status" className="p-6 text-sm"><p>{notice || "세션을 확인하는 중입니다."}</p>{notice && <Button className="mt-3" variant="outline" onClick={() => verify.current()}>서버 세션 재점검</Button>}</section>}{ready && notice && <p role="status" className="border-b bg-amber-50 p-3 text-xs text-amber-950">{notice}</p>}{ready && remaining !== null && <div role="alert" className="fixed bottom-4 left-4 right-4 z-50 mx-auto flex max-w-2xl flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-300 bg-amber-50 p-4 shadow-lg"><p className="text-sm text-amber-950">미사용으로 약 {remaining}분 후 자동 로그아웃됩니다. 입력 중인 내용은 저장해 주세요.</p><Button variant="outline" onClick={() => resume.current()}>계속 작업</Button></div>}<div hidden={!ready} inert={!ready}>{loaded && children}</div></>;
}
