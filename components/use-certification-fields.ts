"use client";
import { useEffect, useRef, useState } from "react";
import { CERTIFICATION_FIELDS_KEY, parseAdditionalCertificationFields } from "@/lib/certification-fields";
import { numberingRules, type NumberingRule } from "@/lib/numbering-rules";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";
export function useCertificationFields() {
  const [additional, setAdditional] = useState<NumberingRule[]>([]), [loading, setLoading] = useState(true), [saving, setSaving] = useState(false);
  const [error, setError] = useState(""), [notice, setNotice] = useState("");
  const [revision, setRevision] = useState(0);
  const baseline = useRef<{ exists: boolean; updatedAt: string } | null>(null), busy = useRef(false), mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  useEffect(() => {
    let cancelled = false; baseline.current = null; setAdditional([]); setLoading(true); setError("");
    const load = async () => {
      try {
        if (!hasEnvVars) { setAdditional(parseAdditionalCertificationFields(JSON.parse(window.localStorage.getItem(CERTIFICATION_FIELDS_KEY) ?? "[]"))); baseline.current = { exists: false, updatedAt: "" }; return; }
        const { data, error } = await createClient().from("system_settings").select("value, updated_at").eq("key", CERTIFICATION_FIELDS_KEY).maybeSingle();
        if (cancelled) return;
        if (error || data && (typeof data.updated_at !== "string" || !Number.isFinite(Date.parse(data.updated_at)))) throw new Error("설정 조회 오류");
        setAdditional(data ? parseAdditionalCertificationFields(data.value) : []);
        baseline.current = { exists: Boolean(data), updatedAt: data?.updated_at ?? "" };
      } catch { if (!cancelled) setError("인증분야 설정을 확인하지 못했습니다. 다시 조회해 주세요. 오류 상태에서는 새 번호를 부여하지 않습니다."); }
      finally { if (!cancelled) setLoading(false); }
    }; void load(); return () => { cancelled = true; };
  }, [revision]);
  const add = async (rule: NumberingRule) => {
    if (busy.current || loading || error || !baseline.current) return false;
    let next: NumberingRule[];
    try { next = parseAdditionalCertificationFields([...additional, rule]); } catch (issue) { setNotice(issue instanceof Error ? issue.message : "입력한 규칙을 확인해 주세요."); return false; }
    busy.current = true; setSaving(true);
    try {
      if (hasEnvVars) {
        const client = createClient(), auth = await client.auth.getUser();
        if (!mounted.current) return false;
        if (auth.error || !auth.data.user) throw new Error("인증 확인 실패");
        const updatedAt = new Date().toISOString(), payload = { value: next, updated_by: auth.data.user.id, updated_at: updatedAt };
        const result = baseline.current.exists ? await client.from("system_settings").update(payload).eq("key", CERTIFICATION_FIELDS_KEY).eq("updated_at", baseline.current.updatedAt).select("value, updated_at").single() : await client.from("system_settings").insert({ key: CERTIFICATION_FIELDS_KEY, ...payload }).select("value, updated_at").single();
        if (!mounted.current) return false;
        if (result.error || !result.data || JSON.stringify(parseAdditionalCertificationFields(result.data.value)) !== JSON.stringify(next) || typeof result.data.updated_at !== "string" || Date.parse(result.data.updated_at) !== Date.parse(updatedAt)) throw new Error("저장 응답 미확인");
        baseline.current = { exists: true, updatedAt: result.data.updated_at };
      } else { window.localStorage.setItem(CERTIFICATION_FIELDS_KEY, JSON.stringify(next)); }
      setAdditional(next); setNotice("인증분야를 추가했습니다. 새 신청부터 선택할 수 있습니다. 기존 번호는 변경하지 않습니다."); return true;
    } catch { if (mounted.current) { setError("저장 결과를 확인하지 못했습니다. 중복 등록 전에 다시 조회해 주세요."); setNotice("입력은 유지합니다. 권한·동시 변경·연결 상태를 확인해 주세요."); } return false; }
    finally { busy.current = false; if (mounted.current) setSaving(false); }
  };
  return { catalog: [...numberingRules, ...additional], additional, loading, saving, error, notice, add, reload: () => { if (!busy.current) setRevision(value => value + 1); } };
}
