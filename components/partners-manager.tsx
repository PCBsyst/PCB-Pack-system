"use client";

import { useEffect, useState } from "react";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/form-fields";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";

export const PARTNERS_STORAGE_KEY = "certification-partners";
export type PartnerItem = { id: string; name: string; active: boolean };
const defaults: PartnerItem[] = [
  { id: "partner-quality", name: "한국품질파트너스", active: true },
  { id: "partner-beauty", name: "케이뷰티전문가연합회", active: true },
];

export function readStoredPartners() {
  if (typeof window === "undefined") return defaults;
  try { return JSON.parse(window.localStorage.getItem(PARTNERS_STORAGE_KEY) ?? "null") as PartnerItem[] ?? defaults; } catch { return defaults; }
}

export function PartnersManager() {
  const [partners, setPartners] = useState<PartnerItem[]>([]);
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { void load(); }, []);
  async function load() {
    if (!hasEnvVars) { setPartners(readStoredPartners()); return; }
    const { data, error } = await createClient().from("partners").select("id, name, active").order("name");
    if (error) { setNotice(`파트너사 명단을 불러오지 못했습니다: ${error.message}`); return; }
    setPartners((data ?? []) as PartnerItem[]);
  }
  async function add() {
    const value = name.trim();
    if (!value) { setNotice("파트너사명을 입력해 주세요."); return; }
    if (partners.some((partner) => partner.name === value)) { setNotice("이미 등록된 파트너사입니다."); return; }
    setSaving(true);
    if (hasEnvVars) {
      const { error } = await createClient().from("partners").insert({ name: value, active: true });
      setSaving(false);
      if (error) { setNotice(`등록하지 못했습니다: ${error.message}`); return; }
      setName(""); setNotice("파트너사를 등록했습니다."); await load(); return;
    }
    const next = [...partners, { id: `partner-${Date.now()}`, name: value, active: true }];
    window.localStorage.setItem(PARTNERS_STORAGE_KEY, JSON.stringify(next));
    setPartners(next); setName(""); setSaving(false); setNotice("파트너사를 이 브라우저에 등록했습니다.");
  }
  async function toggle(partner: PartnerItem) {
    setSaving(true);
    if (hasEnvVars) {
      const { error } = await createClient().from("partners").update({ active: !partner.active, updated_at: new Date().toISOString() }).eq("id", partner.id);
      setSaving(false);
      if (error) { setNotice(`상태를 변경하지 못했습니다: ${error.message}`); return; }
    }
    const next = partners.map((item) => item.id === partner.id ? { ...item, active: !item.active } : item);
    if (!hasEnvVars) window.localStorage.setItem(PARTNERS_STORAGE_KEY, JSON.stringify(next));
    setPartners(next); setNotice(`${partner.name}을(를) ${partner.active ? "비활성화" : "활성화"}했습니다.`);
  }
  return <section id="partners" className="scroll-mt-20 rounded-lg border bg-white shadow-sm"><div className="border-b px-5 py-4"><h2 className="font-semibold">파트너사 명단</h2><p className="mt-1 text-sm text-slate-500">신규 신청에서 선택할 파트너사를 관리합니다. 비활성화해도 기존 신청 기록의 명칭은 유지됩니다.</p></div><div className="p-5"><div className="flex flex-col gap-3 sm:flex-row"><input className={controlClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="파트너사명"/><Button type="button" disabled={saving} onClick={add}><Plus/>{saving ? "처리 중..." : "파트너사 등록"}</Button></div>{notice && <p className="mt-3 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">{notice}</p>}<div className="mt-5 overflow-hidden rounded-lg border"><div className="divide-y"><div className="flex items-center gap-3 bg-slate-50 px-4 py-3"><span className="grid h-9 w-9 place-items-center rounded-md bg-white text-slate-600"><Building2 className="h-4 w-4"/></span><p className="flex-1 font-medium">직접접수</p><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">항상 사용</span></div>{partners.map((partner) => <div key={partner.id} className="flex items-center gap-3 px-4 py-3"><span className="grid h-9 w-9 place-items-center rounded-md bg-slate-100 text-slate-600"><Building2 className="h-4 w-4"/></span><p className="flex-1 font-medium">{partner.name}</p><span className={`rounded-full px-2 py-1 text-xs font-semibold ${partner.active ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>{partner.active ? "사용" : "비활성"}</span><Button size="sm" variant="outline" disabled={saving} onClick={() => void toggle(partner)}>{partner.active ? "비활성" : "활성"}</Button></div>)}{partners.length === 0 && <p className="p-6 text-center text-sm text-slate-500">등록된 파트너사가 없습니다.</p>}</div></div></div></section>;
}
