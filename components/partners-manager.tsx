"use client";

import { useState } from "react";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/form-fields";
import { useBasicDirectory } from "@/components/use-basic-directory";


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

const localDirectory = { read: readStoredPartners, save: (items: PartnerItem[]) => window.localStorage.setItem(PARTNERS_STORAGE_KEY, JSON.stringify(items)) };

export function PartnersManager() {
  const [name, setName] = useState("");
  const { items: partners, loading, saving, error, notice, register, toggle, reload } = useBasicDirectory("partners", localDirectory);
  const add = async () => { if (await register(name)) setName(""); };
  return <section id="partners" className="scroll-mt-20 rounded-lg border bg-white shadow-sm"><div className="border-b px-5 py-4"><h2 className="font-semibold">파트너사 명단</h2><p className="mt-1 text-sm text-slate-500">신규 신청에서 선택할 파트너사를 관리합니다. 비활성화해도 기존 신청 기록의 명칭은 유지됩니다.</p></div><div className="p-5"><div className="flex flex-col gap-3 sm:flex-row"><input disabled={saving || loading || Boolean(error)} className={controlClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="파트너사명"/><Button type="button" disabled={saving || loading || Boolean(error)} onClick={add}><Plus/>{saving ? "처리 중..." : "파트너사 등록"}</Button></div><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm text-muted-foreground">{loading ? "명단 조회 중 · 건수 미확정" : error || `명단 ${partners.length}건 조회 완료`}</p><Button variant="outline" disabled={saving || loading} onClick={reload}>명단 다시 조회</Button></div>{notice && <p className="mt-3 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">{notice}</p>}<div className="mt-5 overflow-hidden rounded-lg border"><div className="divide-y"><div className="flex items-center gap-3 bg-slate-50 px-4 py-3"><span className="grid h-9 w-9 place-items-center rounded-md bg-white text-slate-600"><Building2 className="h-4 w-4"/></span><p className="flex-1 font-medium">직접접수</p><span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-800">항상 사용</span></div>{partners.map((partner) => <div key={partner.id} className="flex items-center gap-3 px-4 py-3"><span className="grid h-9 w-9 place-items-center rounded-md bg-slate-100 text-slate-600"><Building2 className="h-4 w-4"/></span><p className="flex-1 font-medium">{partner.name}</p><span className={`rounded-full px-2 py-1 text-xs font-semibold ${partner.active ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>{partner.active ? "사용" : "비활성"}</span><Button size="sm" variant="outline" disabled={saving || loading || Boolean(error)} onClick={() => void toggle(partner)}>{partner.active ? "비활성" : "활성"}</Button></div>)}{partners.length === 0 && <p className="p-6 text-center text-sm text-slate-500">{loading ? "파트너사 조회 중입니다." : error ? "명단 미확인 · 재조회가 필요합니다." : "등록된 파트너사가 없습니다."}</p>}</div></div></div></section>;
}
