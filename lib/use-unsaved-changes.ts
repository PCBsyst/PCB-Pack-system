"use client";

import { useEffect, useRef } from "react";
import { shouldConfirmLink } from "@/lib/unsaved-change-policy";

/** Best-effort browser warning. Never persist customer draft data in browser storage. */
export function useUnsavedChanges(dirty: boolean) {
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  useEffect(() => {
    let securityEnding = false;
    let allowUnloadUntil = 0;
    const ending = () => { securityEnding = true; };
    const beforeUnload = (event: BeforeUnloadEvent) => {
      if (!dirtyRef.current || securityEnding || Date.now() < allowUnloadUntil) return;
      event.preventDefault(); event.returnValue = "";
    };
    const click = (event: MouseEvent) => {
      if (securityEnding || event.defaultPrevented || event.button !== 0 || !(event.target instanceof Element)) return;
      const anchor = event.target.closest<HTMLAnchorElement>("a[href]");
      if (!anchor || !shouldConfirmLink({ dirty: dirtyRef.current, href: anchor.href, currentHref: window.location.href, target: anchor.target, download: anchor.hasAttribute("download"), modified: event.metaKey || event.ctrlKey || event.shiftKey || event.altKey })) return;
      if (!window.confirm("저장되지 않은 입력 또는 처리 중인 요청이 있습니다. 저장하지 않고 이동할까요?")) {
        event.preventDefault(); event.stopImmediatePropagation();
      } else {
        // Avoid asking again for a full-document navigation already explicitly approved.
        allowUnloadUntil = Date.now() + 1000;
      }
    };
    window.addEventListener("beforeunload", beforeUnload);
    document.addEventListener("click", click, true);
    window.addEventListener("security-session-ending", ending);
    return () => {
      window.removeEventListener("beforeunload", beforeUnload);
      document.removeEventListener("click", click, true);
      window.removeEventListener("security-session-ending", ending);
    };
  }, []);
}
