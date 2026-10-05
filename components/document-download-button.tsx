"use client";

import { useEffect, useRef, useState } from "react";
import { Download, LoaderCircle } from "lucide-react";
import { Button } from "@/components/ui/button";

export function DocumentDownloadButton({ label, task, setNotice, successMessage }: {
  label: string; task: () => Promise<void>; setNotice: (value: string) => void; successMessage: string;
}) {
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  const [pending, setPending] = useState(false);
  const download = async () => {
    if (busy.current) return;
    busy.current = true; setPending(true);
    try {
      setNotice(`${label} 생성 및 파일 확인 중입니다.`);
      await task();
      if (mounted.current) setNotice(successMessage);
    } catch (error) {
      if (mounted.current) setNotice(error instanceof Error ? error.message : "문서 생성에 실패했습니다. 다시 시도해 주세요.");
    } finally { busy.current = false; if (mounted.current) setPending(false); }
  };
  return <Button type="button" size="sm" variant="outline" disabled={pending} aria-busy={pending} onClick={() => void download()}>
    {pending ? <LoaderCircle className="animate-spin"/> : <Download/>}{pending ? "생성·확인 중" : label}
  </Button>;
}
