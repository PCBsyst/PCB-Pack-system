"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Plus, RotateCcw, Search } from "lucide-react";
import { Field, controlClass } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { readTrainingInstitutions, saveTrainingInstitutions, type TrainingInstitution } from "@/lib/training-institutions";
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

  useEffect(() => {
    setInstitutions(readTrainingInstitutions());
    if (!hasEnvVars) return;
    const supabase = createClient();
    void supabase.auth.getUser().then(async ({ data }) => { if (!data.user) return; const { data: profile } = await supabase.from("profiles").select("role").eq("id", data.user.id).maybeSingle(); setIsAdmin(profile?.role === "ADMIN"); });
    void supabase.from("training_institutions").select("*").order("name").then(({ data, error }) => {
      if (error) { setNotice(`연수기관 명단을 불러오지 못했습니다: ${error.message}`); return; }
      setInstitutions((data ?? []).map((item) => ({ id: item.id, name: item.name, designationNo: item.designation_no, validFrom: item.valid_from, validUntil: item.valid_until, standards: item.standards ?? [], active: item.active })));
    });
  }, []);

  const save = async () => {
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
    if (hasEnvVars) {
      setSaving(true);
      const supabase = createClient();
      const payload = { name: record.name, designation_no: record.designationNo, valid_from: record.validFrom, valid_until: record.validUntil, standards: record.standards };
      const result = draft.id ? await supabase.from("training_institutions").update(payload).eq("id", draft.id).select().single() : await supabase.from("training_institutions").insert(payload).select().single();
      setSaving(false);
      if (result.error) { setNotice(`저장하지 못했습니다: ${result.error.message}. 연수기관 관리는 관리자 권한이 필요합니다.`); return; }
      const saved: TrainingInstitution = { id: result.data.id, name: result.data.name, designationNo: result.data.designation_no, validFrom: result.data.valid_from, validUntil: result.data.valid_until, standards: result.data.standards ?? [], active: result.data.active };
      setInstitutions((items) => draft.id ? items.map((item) => item.id === draft.id ? saved : item) : [...items, saved].sort((a, b) => a.name.localeCompare(b.name, "ko")));
      setDraft(emptyDraft);
      setNotice(draft.id ? "협약 연수기관 정보를 공유 DB에 수정했습니다." : "협약 연수기관을 공유 DB에 등록했습니다.");
      return;
    }
    const next = draft.id ? institutions.map((item) => item.id === draft.id ? { ...record, active: item.active } : item) : [...institutions, record];
    setInstitutions(next);
    saveTrainingInstitutions(next);
    setDraft(emptyDraft);
    setNotice(draft.id ? "협약 연수기관 정보를 수정했습니다." : "협약 연수기관을 등록했습니다.");
  };

  const edit = (item: TrainingInstitution) => setDraft({
    id: item.id, name: item.name, designationNo: item.designationNo,
    validFrom: item.validFrom, validUntil: item.validUntil, standards: item.standards.join(", "),
  });

  const toggle = async (id: string) => {
    const target = institutions.find((item) => item.id === id);
    if (!target) return;
    if (hasEnvVars) {
      setSaving(true);
      const { error } = await createClient().from("training_institutions").update({ active: !target.active }).eq("id", id);
      setSaving(false);
      if (error) { setNotice(`상태를 변경하지 못했습니다: ${error.message}. 관리자 권한을 확인해 주세요.`); return; }
    }
    const next = institutions.map((item) => item.id === id ? { ...item, active: !item.active } : item);
    setInstitutions(next);
    saveTrainingInstitutions(next);
    setNotice("연수기관 사용 상태를 변경했습니다.");
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
    {notice && <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"><CheckCircle2 className="h-4 w-4"/>{notice}</div>}
    {isAdmin && <section className="rounded-lg border bg-white p-5 shadow-sm">
      <div className="grid gap-4 rounded-lg border bg-slate-50 p-4 md:grid-cols-2 xl:grid-cols-5">
        <Field label="연수기관명"><input className={controlClass} value={draft.name} onChange={(event) => setDraft({ ...draft, name: event.target.value })}/></Field>
        <Field label="지정번호"><input className={controlClass} value={draft.designationNo} onChange={(event) => setDraft({ ...draft, designationNo: event.target.value })}/></Field>
        <Field label="유효기간 시작"><input type="date" className={controlClass} value={draft.validFrom} onChange={(event) => setDraft({ ...draft, validFrom: event.target.value })}/></Field>
        <Field label="유효기간 종료"><input type="date" className={controlClass} value={draft.validUntil} onChange={(event) => setDraft({ ...draft, validUntil: event.target.value })}/></Field>
        <Field label="신청표준"><input className={controlClass} value={draft.standards} onChange={(event) => setDraft({ ...draft, standards: event.target.value })} placeholder="ISO 9001, ISO 14001"/></Field>
      </div>
      <div className="mt-3 flex justify-end gap-2">{draft.id && <Button variant="outline" disabled={saving} onClick={() => setDraft(emptyDraft)}>수정 취소</Button>}<Button disabled={saving} onClick={save}><Plus/>{saving ? "저장 중..." : draft.id ? "수정 저장" : "연수기관 등록"}</Button></div>
    </section>}
    <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
      <div className="border-b px-5 py-4"><h2 className="font-semibold">등록 연수기관</h2><p className="mt-1 text-sm text-slate-500">비활성 기관은 기존 이력에는 유지되며 새 신청의 선택 목록에서 제외됩니다.</p></div>
      <div className="grid gap-3 border-b bg-slate-50/70 p-4 sm:grid-cols-[minmax(220px,1fr)_180px_180px_auto]"><label className="relative"><Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400"/><input className={`${controlClass} w-full pl-9`} value={query} onChange={(event) => setQuery(event.target.value)} placeholder="기관명, 지정번호, 표준 검색"/></label><select className={controlClass} value={standard} onChange={(event) => setStandard(event.target.value)}><option value="ALL">전체 신청표준</option>{standards.map((value) => <option key={value}>{value}</option>)}</select><select className={controlClass} value={status} onChange={(event) => setStatus(event.target.value)}><option value="ALL">전체 상태</option><option value="ACTIVE">유효</option><option value="EXPIRING">60일 이내 만료</option><option value="EXPIRED">만료</option><option value="INACTIVE">비활성</option></select><Button variant="outline" onClick={() => { setQuery(""); setStandard("ALL"); setStatus("ALL"); }}><RotateCcw/>초기화</Button></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[820px] text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3 text-left">연수기관명</th><th className="px-4 py-3 text-left">지정번호</th><th className="px-4 py-3 text-left">유효기간</th><th className="px-4 py-3 text-left">신청표준</th><th className="px-4 py-3 text-center">상태</th>{isAdmin && <th className="px-4 py-3 text-right">관리</th>}</tr></thead><tbody className="divide-y">{visible.map((item) => <TrainingRow key={item.id} item={item} isAdmin={isAdmin} saving={saving} edit={edit} toggle={toggle}/>)}{visible.length === 0 && <tr><td colSpan={isAdmin ? 6 : 5} className="px-4 py-10 text-center text-slate-500">조건에 맞는 협약 연수기관이 없습니다.</td></tr>}</tbody></table></div><div className="border-t px-5 py-3 text-xs text-slate-500">조회 결과 {visible.length}개 기관</div>
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
