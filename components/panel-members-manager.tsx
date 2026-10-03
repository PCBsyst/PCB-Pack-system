"use client";

import { useEffect, useState } from "react";
import { Plus, UsersRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/form-fields";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";

type PanelMember = { id: string; name: string; active: boolean };

export function PanelMembersManager() {
  const [members, setMembers] = useState<PanelMember[]>([]);
  const [name, setName] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => { void load(); }, []);
  async function load() {
    if (!hasEnvVars) { setNotice("심의위원 명단 관리는 Supabase 연결 후 사용할 수 있습니다."); return; }
    const { data, error } = await createClient().from("panel_members").select("id, name, active").order("name");
    if (error) { setNotice(`심의위원 명단을 불러오지 못했습니다: ${error.message}`); return; }
    setMembers((data ?? []) as PanelMember[]);
  }
  async function add() {
    if (!hasEnvVars) { setNotice("Supabase 연결 후 등록해주세요."); return; }
    if (!name.trim()) { setNotice("심의위원 이름을 입력해 주세요."); return; }
    if (members.some((member) => member.name === name.trim())) { setNotice("이미 등록된 심의위원입니다."); return; }
    setSaving(true);
    const { error } = await createClient().from("panel_members").insert({ name: name.trim(), active: true });
    setSaving(false);
    if (error) { setNotice(`등록하지 못했습니다: ${error.message}. 관리자 권한을 확인해 주세요.`); return; }
    setName(""); setNotice("심의위원을 등록했습니다."); await load();
  }
  async function toggle(member: PanelMember) {
    if (!hasEnvVars) return;
    setSaving(true);
    const { error } = await createClient().from("panel_members").update({ active: !member.active }).eq("id", member.id);
    setSaving(false);
    if (error) { setNotice(`상태를 변경하지 못했습니다: ${error.message}`); return; }
    setMembers((items) => items.map((item) => item.id === member.id ? { ...item, active: !item.active } : item));
    setNotice(`${member.name} 위원을 ${member.active ? "비활성화" : "활성화"}했습니다.`);
  }

  return <section id="reviewers" className="scroll-mt-20 rounded-lg border bg-white shadow-sm"><div className="border-b px-5 py-4"><h2 className="font-semibold">심의위원 명단</h2><p className="mt-1 text-sm text-slate-500">별도 계정 없이 인증심의에서 선택할 위원을 관리합니다. 비활성 위원은 새 심의에서 제외되고 기존 기록에는 유지됩니다.</p></div><div className="p-5"><div className="flex flex-col gap-3 sm:flex-row"><input className={controlClass} value={name} onChange={(event) => setName(event.target.value)} placeholder="심의위원 이름"/><Button type="button" disabled={saving} onClick={add}><Plus/>{saving ? "처리 중..." : "위원 등록"}</Button></div>{notice && <p className="mt-3 rounded-md bg-blue-50 px-3 py-2 text-sm text-blue-900">{notice}</p>}<div className="mt-5 overflow-hidden rounded-lg border"><div className="divide-y">{members.map((member) => <div key={member.id} className="flex items-center gap-3 px-4 py-3"><span className="grid h-9 w-9 place-items-center rounded-full bg-slate-100 text-slate-600"><UsersRound className="h-4 w-4"/></span><p className="flex-1 font-medium">{member.name}</p><span className={`rounded-full px-2 py-1 text-xs font-semibold ${member.active ? "bg-emerald-50 text-emerald-800" : "bg-slate-100 text-slate-500"}`}>{member.active ? "사용" : "비활성"}</span><Button size="sm" variant="outline" disabled={saving} onClick={() => toggle(member)}>{member.active ? "비활성" : "활성"}</Button></div>)}{members.length === 0 && <p className="p-6 text-center text-sm text-slate-500">등록된 심의위원이 없습니다.</p>}</div></div></div></section>;
}
