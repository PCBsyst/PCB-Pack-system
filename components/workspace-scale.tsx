"use client";

import { useEffect, useRef, useState } from "react";

const DEFAULT_SCALE = 90;
const storageKey = "certification-workspace-scale";
export function WorkspaceScale({ children }: { children: React.ReactNode }) {
  const [scale, setScale] = useState(DEFAULT_SCALE);
  const region = useRef<HTMLDivElement>(null);
  useEffect(() => {
    try {
      const stored = Number(localStorage.getItem(storageKey));
      if (Number.isFinite(stored) && stored >= 70 && stored <= 120) setScale(stored);
    } catch { /* 브라우저 저장이 차단되어도 배율 조절은 가능합니다. */ }
    const element = region.current;
    let lastWheel = 0;
    const wheel = (event: WheelEvent) => {
      if (!event.ctrlKey || event.deltaY === 0) return;
      event.preventDefault();
      const now = performance.now();
      if (now - lastWheel < 80) return;
      lastWheel = now;
      setScale((current) => Math.max(70, Math.min(120, current + (event.deltaY < 0 ? 5 : -5))));
    };
    element?.addEventListener("wheel", wheel, { passive: false });
    return () => element?.removeEventListener("wheel", wheel);
  }, []);
  const change = (value: number) => setScale(Math.max(70, Math.min(120, value)));
  useEffect(() => {
    // 최초 렌더 저장으로 기존 선택을 덮어쓰지 않도록 읽기 후 예약합니다.
    const timer = setTimeout(() => { try { localStorage.setItem(storageKey, String(scale)); } catch { /* 메모리에서 유지 */ } }, 100);
    return () => clearTimeout(timer);
  }, [scale]);
  return <div ref={region}>
    <div className="mx-auto flex w-full max-w-[1320px] items-center justify-end gap-2 px-4 pt-3 text-xs text-slate-500 sm:px-6 lg:px-8 print:hidden" role="group" aria-label="업무 화면 배율">
      <span className="hidden sm:inline">Ctrl + 휠</span>
      <button type="button" className="rounded border bg-white px-2 py-1" onClick={() => change(scale - 5)} disabled={scale <= 70} aria-label="업무 화면 축소">−</button>
      <output aria-live="polite" className="min-w-10 text-center">{scale}%</output>
      <button type="button" className="rounded border bg-white px-2 py-1" onClick={() => change(scale + 5)} disabled={scale >= 120} aria-label="업무 화면 확대">+</button>
      <button type="button" className="rounded border bg-white px-2 py-1" onClick={() => change(DEFAULT_SCALE)}>기본 90%</button>
    </div>
    <div className="workspace-scaled mx-auto w-full max-w-[1320px] min-w-0" style={{ zoom: scale / 100 }}>{children}</div>
  </div>;
}
