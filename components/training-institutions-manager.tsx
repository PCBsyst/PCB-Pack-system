"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Info, Plus, RotateCcw, Search } from "lucide-react";
import { Field, controlClass } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { readTrainingInstitutions, saveTrainingInstitutions, parseTrainingInstitutionRow, type TrainingInstitution } from "@/lib/training-institutions";
import { readBoundedRows } from "@/lib/bounded-row-reader";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";

const emptyDraft = { id: "", name: "", designationNo: "", validFrom: "", validUntil: "", standards: "" };

export function TrainingInstitutionsManager() {
  const [institutions, setInstitutions] = useState<TrainingInstitution[]>([]);
  const [draft, setDraft] = useState(emptyDraft);
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [isAdmin, setIsAdmin] = useState(!hasEnvVars);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [standard, setStandard] = useState("ALL");
  const [revision, setRevision] = useState(0);
  const [loading, setLoading] = useState(Boolean(hasEnvVars));
  const [loadError, setLoadError] = useState("");
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);

  useEffect(() => {
    let cancelled = false;
    setInstitutions([]); setLoadError(""); setNotice(""); setLoading(true); setIsAdmin(!hasEnvVars);
    const load = async () => {
      try {
        if (!hasEnvVars) { setInstitutions(readTrainingInstitutions()); return; }
        const supabase = createClient();
        const { data: auth, error: authError } = await supabase.auth.getUser();
        if (cancelled) return;
        if (authError || !auth.user) throw new Error("인증 확인 실패");
        const { data: profile, error: profileError } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
        if (cancelled) return;
        if (profileError || !profile) throw new Error("권한 확인 실패");
        const rows = await readBoundedRows((from, to) => supabase.from("training_institutions").select("*", { count: "exact" }).order("name").order("id").range(from, to), row => row?.id, () => cancelled);
        if (cancelled) return;
        if (!rows) throw new Error("조회 실패");
        const parsed = rows.map(parseTrainingInstitutionRow);
        setInstitutions(parsed); setIsAdmin(profile.role === "ADMIN");
      } catch { if (!cancelled) { setInstitutions([]); setIsAdmin(false); setLoadError("연수기관 명단 또는 권한을 확인하지 못했습니다. 로컬 샘플로 대체하지 않습니다. 다시 조회해 주세요."); } }
      finally { if (!cancelled) setLoading(false); }
    };
    void load();
    return () => { cancelled = true; };
  }, [revision]);

  const save = async () => {
    if (busy.current || !isAdmin || loading || loadError) return;
    if (!draft.name.trim() || !draft.designationNo.trim() || !draft.validFrom || !draft.validUntil || !draft.standards.trim()) {
      setNotice("연수기관명, 지정번호, 유효기간, 신청표준을 모두 입력해 주세요.");
      return;
    }
    if (draft.validUntil < draft.validFrom) { setNotice("유효기간 종료일은 시작일보다 빠를 수 없습니다."); return; }
    const record: TrainingInstitution = {
      id: draft.id || `training-${Date.now()}`,
      name: draft.name.trim(),
      designationNo: draft.designationNo.trim(),
      validFrom: draft.validFrom,
      validUntil: draft.validUntil,
      standards: draft.standards.split(",").map((item) => item.trim()).filter(Boolean),
      active: true,
    };
    try {
      parseTrainingInstitutionRow({ id: record.id, name: record.name, designation_no: record.designationNo, valid_from: record.validFrom, valid_until: record.validUntil, standards: record.standards, active: record.active });
      if (!record.standards.length) throw new Error("신청표준 누락");
    } catch { setNotice("입력한 유효기간과 신청표준을 확인해 주세요."); return; }
    busy.current = true; setSaving(true);
    try {
    if (hasEnvVars) {
      const supabase = createClient();
      const payload = { name: record.name, designation_no: record.designationNo, valid_from: record.validFrom, valid_until: record.validUntil, standards: record.standards };
      const result = draft.id ? await supabase.from("training_institutions").update(payload).eq("id", draft.id).select().single() : await supabase.from("training_institutions").insert(payload).select().single();
      if (!mounted.current) return;
      if (result.error || !result.data) throw new Error("저장 응답 확인 실패");
      const saved = parseTrainingInstitutionRow(result.data);
      if ((draft.id && saved.id !== draft.id) || saved.name !== record.name || saved.designationNo !== record.designationNo || saved.validFrom !== record.validFrom || saved.validUntil !== record.validUntil || JSON.stringify(saved.standards) !== JSON.stringify(record.standards)) throw new Error("저장 응답 불일치");
      setInstitutions((items) => draft.id ? items.map((item) => item.id === draft.id ? saved : item) : [...items, saved].sort((a, b) => a.name.localeCompare(b.name, "ko")));
      setDraft(emptyDraft);
      setNotice(draft.id ? "지정 연수기관 정보를 공유 DB에 수정했습니다." : "지정 연수기관을 공유 DB에 등록했습니다.");
      return;
    }
    const next = draft.id ? institutions.map((item) => item.id === draft.id ? { ...record, active: item.active } : item) : [...institutions, record];
    saveTrainingInstitutions(next);
    setInstitutions(next);
    setDraft(emptyDraft);
    setNotice(draft.id ? "지정 연수기관 정보를 수정했습니다." : "지정 연수기관을 등록했습니다.");
    } catch { if (mounted.current) { setNotice("저장 결과를 확인하지 못했습니다. 입력은 유지됩니다. 중복 등록 전에 명단을 다시 조회해 주세요."); if (hasEnvVars) setLoadError("저장 결과 미확인: 다시 조회 후 등록·수정을 진행해 주세요."); } }
    finally { busy.current = false; if (mounted.current) setSaving(false); }
  };

  const edit = (item: TrainingInstitution) => {
    if (busy.current || !isAdmin || loading || loadError) return;
    setDraft({
    id: item.id, name: item.name, designationNo: item.designationNo,
    validFrom: item.validFrom, validUntil: item.validUntil, standards: item.standards.join(", "),
    });
  };

  const toggle = async (id: string) => {
    if (busy.current || !isAdmin || loading || loadError) return;
    const target = institutions.find((item) => item.id === id);
    if (!target) return;
    busy.current = true; setSaving(true);
    try {
    if (hasEnvVars) {
      const { data, error } = await createClient().from("training_institutions").update({ active: !target.active }).eq("id", id).eq("active", target.active).select().single();
      if (!mounted.current) return;
      if (error || !data) throw new Error("상태 변경 응답 확인 실패");
      const saved = parseTrainingInstitutionRow(data);
      if (saved.id !== id || saved.active !== !target.active) throw new Error("상태 변경 응답 불일치");
      setInstitutions(items => items.map(item => item.id === id ? saved : item));
      setNotice("연수기관 사용 상태를 공유 DB에 변경했습니다.");
      return;
    }
    const next = institutions.map((item) => item.id === id ? { ...item, active: !item.active } : item);
    saveTrainingInstitutions(next);
    setInstitutions(next);
    setNotice("연수기관 사용 상태를 변경했습니다.");
    } catch { if (mounted.current) { setNotice("사용 상태 변경 결과를 확인하지 못했습니다. 다시 조회한 뒤 확인해 주세요."); if (hasEnvVars) setLoadError("상태 변경 결과 미확인: 명단을 다시 조회해 주세요."); } }
    finally { busy.current = false; if (mounted.current) setSaving(false); }
  };
  const standards = useMemo(() => [...new Set(institutions.flatMap((item) => item.standards))].sort(), [institutions]);
  const visible = useMemo(() => institutions.filter((item) => {
    const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
    const warningDate = new Date(`${today}T00:00:00+09:00`); warningDate.setDate(warningDate.getDate() + 60);
    const warning = warningDate.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
    const validity = !item.active ? "INACTIVE" : item.validUntil < today ? "EXPIRED" : item.validUntil <= warning ? "EXPIRING" : "ACTIVE";
    const text = `${item.name} ${item.designationNo} ${item.standards.join(" ")}`.toLowerCase();
    return text.includes(query.trim().toLowerCase()) && (standard === "ALL" || item.standards.includes(standard)) && (status === "ALL" || validity === status);
  }), [institutions, query, standard, status]);

  return <div className="space-y-5">
    <div className="flex items-center justify-between gap-3"><p role="status" className="text-sm text-muted-foreground">{loading ? "연수기관·권한 조회 중..." : loadError || (hasEnvVars ? "공유 DB 연수기관 명단" : "로컬 가상 연수기관 명단")}</p><Button variant="outline" disabled={saving || loading} onClick={() => setRevision(value => value + 1)}><RotateCcw/>명단 다시 조회</Button></div>
    {notice && <div role="status" className="flex items-center gap-2 rounded-lg border bg-card px-4 py-3 text-sm font-medium text-foreground"><Info className="h-4 w-4"/>{notice}</div>}
    {isAdmin && <fieldset disabled={saving || loading || Boolean(loadError)} className="rounded-lg border bg-white p-5 shadow-sm">
      <div className="grid gap-4 rounded-lg border bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-5">
        <Field label="연수기관명"><input className={controlClass} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })}/></Field>
        <Field label="지정번호"><input className={controlClass} value={draft.designationNo} onChange={(event) => setDraft({ ...draft, designationNo: event.target.value })}/></Field>
        <Field label="유효기간 시작"><input type="date" className={controlClass} value={draft.validFrom} onChange={(event) => setDraft({ ...draft, validFrom: event.target.value })}/></Field>
        <Field label="유효기간 종료"><input type="date" className={controlClass} value={draft.validUntil} onChange={(event) => setDraft({ ...draft, validUntil: event.target.value })}/></Field>
        <Field label="신청표준"><input className={controlClass} value={draft.standards} onChange={(event) => setDraft({ ...draft, standards: event.target.value })} placeholder="ISO 9001, ISO 14001"/></Field>
      </div>
      <div className="mt-3 flex justify-end gap-2">{draft.id && <Button variant="outline" disabled={saving} onClick={() => setDraft(emptyDraft)}>수정 취소</Button>}<Button disabled={saving} onClick={save}><Plus/>{saving ? "저장 중..." : draft.id ? "수정 저장" : "연수기관 등록"}</Button></div>
    </fieldset>}
    <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div className="border-b px-5 py-4"><h2 className="font-semibold">등록 연수기관</h2><p className="mt-1 text-sm text-slate-500">비활성 기관은 기존 이력에는 유지되며 새 신청의 선택 목록에서 제외됩니다.</p></div>
      <div className="grid gap-3 border-b bg-slate-50/70 p-4 sm:grid-cols-[minmax(220px,1fr)_180px_180px_auto]"><label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input className={`${controlClass} w-full pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="기관명, 지정번호, 표준 검색"/></label><select className={controlClass} value={standard} onChange={(event) => setStandard(event.target.value)}><option value="ALL">전체 신청표준</option>{standards.map((value) => <option key={value}>{value}</option>)}</select><select className={controlClass} value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">전체 상태</option><option value="ACTIVE">유효</option><option value="EXPIRING">60일 이내 만료</option><option value="EXPIRED">만료</option><option value="INACTIVE">비활성</option></select><Button variant="outline" onClick={() => { setQuery(""); setStandard("ALL"); setStatus("ALL"); }}><RotateCcw/>초기화</Button></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3 text-left">연수기관명</th><th className="px-4 py-3 text-left">지정번호</th><th className="px-4 py-3 text-left">유효기간</th><th className="px-4 py-3 text-left">신청표준</th><th className="px-4 py-3 text-center">상태</th>{isAdmin && <th className="px-4 py-3 text-right">관리</th>}</tr></thead><tbody className="divide-y">{visible.map((item) => <TrainingRow key={item.id} item={item} isAdmin={isAdmin} saving={saving} edit={edit} toggle={toggle}/>)}{visible.length === 0 && <tr><td colSpan={isAdmin ? 6 : 5} className="px-4 py-10 text-center text-slate-500">조건에 맞는 지정 연수기관이 없습니다.</td></tr>}</tbody></table></div><div className="border-t px-5 py-3 text-xs text-slate-500">조회 결과 {visible.length}개 기관</div>
    </section>
  </div>;
}

function TrainingRow({ item, isAdmin, saving, edit, toggle }: { item: TrainingInstitution; isAdmin: boolean; saving: boolean; edit: (item: TrainingInstitution) => void; toggle: (id: string) => Promise<void> }) {
  const today = new Date().toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const warningDate = new Date(`${today}T00:00:00+09:00`); warningDate.setDate(warningDate.getDate() + 60);
  const warning = warningDate.toLocaleDateString("sv-SE", { timeZone: "Asia/Seoul" });
  const label = !item.active ? "비활성" : item.validUntil < today ? "만료" : item.validUntil <= warning ? "만료 임박" : "유효";
  const style = label === "만료" ? "bg-rose-50 text-rose-800" : label === "만료 임박" ? "bg-amber-50 text-amber-800" : label === "유효" ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500";
  return <tr><td className="px-4 py-3 font-medium">{item.name}</td><td className="px-4 py-3">{item.designationNo}</td><td className="whitespace-nowrap px-4 py-3">{item.validFrom} ~ {item.validUntil}</td><td className="px-4 py-3">{item.standards.join(", ")}</td><td className="px-4 py-3 text-center"><span className={`rounded-full px-2 py-1 text-xs font-semibold ${style}`}>{label}</span></td>{isAdmin && <td className="whitespace-nowrap px-4 py-3 text-right"><Button size="sm" variant="outline" disabled={saving} onClick={() => edit(item)}>수정</Button><Button size="sm" variant="outline" className="ml-2" disabled={saving} onClick={() => void toggle(item.id)}>{item.active ? "비활성" : "활성"}</Button></td>}</tr>;
}
