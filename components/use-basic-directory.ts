"use client";
import { useEffect, useRef, useState } from "react";
import { parseBasicDirectoryItem, type BasicDirectoryItem } from "@/lib/basic-directory";
import { readBoundedRows } from "@/lib/bounded-row-reader";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";

type LocalDirectory = { read: () => BasicDirectoryItem[]; save: (items: BasicDirectoryItem[]) => void };
export function useBasicDirectory(table: "partners" | "panel_members", local?: LocalDirectory) {
  const [items, setItems] = useState<BasicDirectoryItem[]>([]);
  const [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const busy = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let cancelled = false;
    setItems([]); setLoading(true); setError(""); setNotice("");
    const load = async () => {
      try {
        if (!hasEnvVars) {
          if (!local) throw new Error("공유 DB 연결 필요");
          const parsed = local.read().map(parseBasicDirectoryItem);
          if (new Set(parsed.map(item => item.id)).size !== parsed.length) throw new Error("명단 중복");
          setItems(parsed); return;
        }
        const rows = await readBoundedRows((from, to) => createClient().from(table).select("id, name, active, updated_at", { count: "exact" }).order("name").order("id").range(from, to), row => row?.id, () => cancelled);
        if (cancelled) return;
        if (!rows) throw new Error("조회 미확인");
        setItems(rows.map(parseBasicDirectoryItem));
      } catch { if (!cancelled) { setItems([]); setError(hasEnvVars ? "공유 명단을 확인하지 못했습니다. 샘플로 대체하지 않습니다. 다시 조회해 주세요." : "명단을 확인하지 못했습니다. 공유 DB 연결 또는 브라우저 저장 기록을 확인해 주세요."); } }
      finally { if (!cancelled) setLoading(false); }
    };
    void load(); return () => { cancelled = true; };
  }, [table, local, revision]);

  const register = async (name: string) => {
    if (busy.current || loading || error) return false;
    const value = name.trim();
    if (!value || value.length > 500 || /[\u0000-\u001f]/.test(value)) { setNotice("이름을 500자 이내로 입력해 주세요."); return false; }
    if (items.some(item => item.name.trim().normalize("NFC") === value.normalize("NFC"))) { setNotice("이미 등록된 이름입니다."); return false; }
    busy.current = true; setSaving(true);
    try {
      let saved: BasicDirectoryItem;
      if (hasEnvVars) {
        const result = await createClient().from(table).insert({ name: value, active: true }).select("id, name, active, updated_at").single();
        if (!mounted.current) return false;
        if (result.error || !result.data) throw new Error("등록 응답 미확인");
        saved = parseBasicDirectoryItem(result.data);
        if (saved.name !== value || !saved.active || items.some(item => item.id === saved.id)) throw new Error("등록 응답 불일치");
      } else {
        if (!local) throw new Error("로컬 등록 불가");
        saved = { id: `${table}-${Date.now()}`, name: value, active: true };
        local.save([...items, saved]);
      }
      setItems(current => [...current, saved].sort((a, b) => a.name.localeCompare(b.name, "ko")));
      setNotice(hasEnvVars ? "공유 DB에 등록한 정보를 확인했습니다." : "이 브라우저에 등록했습니다.");
      return true;
    } catch { if (mounted.current) { setNotice("등록 결과 미확인 · 입력은 유지합니다. 중복 등록 전에 명단을 다시 조회해 주세요."); setError("저장 결과를 확인하지 못했습니다. 재조회 후 처리해 주세요."); } return false; }
    finally { busy.current = false; if (mounted.current) setSaving(false); }
  };
  const toggle = async (target: BasicDirectoryItem) => {
    if (busy.current || loading || error || !items.some(item => item.id === target.id)) return;
    busy.current = true; setSaving(true);
    try {
      let saved = { ...target, active: !target.active };
      if (hasEnvVars) {
        if (!target.updatedAt) throw new Error("변경 기준 미확인");
        const result = await createClient().from(table).update({ active: !target.active }).eq("id", target.id).eq("updated_at", target.updatedAt).eq("active", target.active).select("id, name, active, updated_at").single();
        if (!mounted.current) return;
        if (result.error || !result.data) throw new Error("상태 변경 미확인");
        saved = parseBasicDirectoryItem(result.data);
        if (saved.id !== target.id || saved.name !== target.name || saved.active !== !target.active) throw new Error("상태 변경 불일치");
      } else {
        if (!local) throw new Error("로컬 상태 변경 불가");
        local.save(items.map(item => item.id === target.id ? saved : item));
      }
      setItems(current => current.map(item => item.id === target.id ? saved : item));
      setNotice("실제 변경된 사용 상태를 확인했습니다.");
    } catch { if (mounted.current) { setNotice("다른 직원의 변경 또는 통신 문제로 상태 변경을 확정하지 못했습니다. 다시 조회해 주세요."); setError("상태 변경 결과 미확인 · 재조회 후 처리해 주세요."); } }
    finally { busy.current = false; if (mounted.current) setSaving(false); }
  };
  return { items, loading, saving, error, notice, register, toggle, reload: () => { if (!busy.current) setRevision(value => value + 1); } };
}
