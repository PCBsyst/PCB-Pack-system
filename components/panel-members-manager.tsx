"use client";

import { useState } from "react";
import { Plus, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/form-fields";
import { useBasicDirectory } from "@/components/use-basic-directory";


export function PanelMembersManager() {
  const [name, setName] = useState("");
  const { items: members, loading, saving, error, notice, register, toggle, reload } = useBasicDirectory("panel_members");
  const add = async () => { if (await register(name)) setName(""); };
  return <section id="reviewers" className="scroll-mt-20 rounded-lg border bg-white shadow-sm"><div className="border-b px-5 py-4"><h2 className="font-semibold">심의위원 명단</h2><p className="mt-1 text-sm text-slate-500">별도 계정 없이 인증심의에서 선택할 위원을 관리합니다. 비활성 위원은 새 심의에서 제외되고 기존 기록에는 유지됩니다.</p></div><div className="p-5"><div className="flex flex-col gap-3 sm:flex-row"><input disabled={saving || loading || Boolean(error)} className={controlClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="심의위원 이름"/><Button type="button" disabled={saving || loading || Boolean(error)} onClick={add}><Plus/>{saving ? "처리 중..." : "위원 등록"}</Button></div><div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm text-muted-foreground">{loading ? "명단 조회 중 · 건수 미확정" : error || `명단 ${members.length}건 조회 완료`}</p><Button variant="outline" disabled={saving || loading} onClick={reload}>명단 다시 조회</Button></div>{notice && <p className="mt-3 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">{notice}</p>}<div className="mt-5 overflow-hidden rounded-lg border"><div className="divide-y">{members.map((member) => <div key={member.id} className="flex items-center gap-3 px-4 py-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600"><UsersRound className="h-4 w-4"/></span><p className="flex-1 font-medium">{member.name}</p><span className={`rounded-full px-2 py-1 text-xs font-semibold ${member.active ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>{member.active ? "사용" : "비활성"}</span><Button size="sm" variant="outline" disabled={saving || loading || Boolean(error)} onClick={() => toggle(member)}>{member.active ? "비활성" : "활성"}</Button></div>)}{members.length === 0 && <p className="p-6 text-center text-sm text-slate-500">{loading ? "심의위원 조회 중입니다." : error ? "명단 미확인 · 재조회가 필요합니다." : "등록된 심의위원이 없습니다."}</p>}</div></div></div></section>;
}
