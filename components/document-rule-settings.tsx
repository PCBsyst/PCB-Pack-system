"use client";

import { useState } from "react";
import { jobs } from "@/data/mock-data";
import { deliveryDocumentRows, type DocumentApplicability } from "@/lib/prototype-package";
import { DOCUMENT_RULES_STORAGE_KEY, makeDefaultProfile, profileKey, readStoredProfiles, type DocumentRuleProfile } from "@/lib/document-requirement-rules";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/form-fields";

const profiles = Array.from(new Map(jobs.map((job) => { const profile = makeDefaultProfile(job); return [profileKey(profile), profile]; })).values());
const labels: Record<DocumentApplicability, string> = { REQUIRED: "필수", CONDITIONAL: "해당 시 필수", NOT_APPLICABLE: "해당 없음" };

export function DocumentRuleSettings() {
  const saved = readStoredProfiles();
  const initial = profiles.map((profile) => saved.find((item) => profileKey(item) === profileKey(profile)) ?? profile);
  const [items, setItems] = useState<DocumentRuleProfile[]>(initial);
  const [selected, setSelected] = useState(profileKey(initial[0]));
  const [savedNotice, setSavedNotice] = useState("");
  const current = items.find((item) => profileKey(item) === selected) ?? items[0];
  const update = (key: keyof typeof current.rules, value: DocumentApplicability) => setItems((list) => list.map((item) => profileKey(item) === selected ? { ...item, rules: { ...item.rules, [key]: value } } : item));
  return <section className="mt-6 rounded-lg border bg-white shadow-sm"><div className="border-b px-5 py-4"><h2 className="font-semibold">분야·표준·등급별 문서 적용 규칙</h2><p className="mt-1 text-sm text-slate-500">저장한 기본값은 이후 새로 시작하는 Job 기록에 적용되며, Job에서 예외 변경할 수 있습니다.</p></div><div className="p-5"><div className="mb-4 max-w-xl"><select className={controlClass} value={selected} onChange={(event) => setSelected(event.target.value)}>{items.map((item) => <option key={profileKey(item)} value={profileKey(item)}>{item.businessArea === "ISO" ? "ISO" : "K-Beauty"} · {item.standard} · {item.grade}</option>)}</select></div><div className="overflow-x-auto"><table className="w-full min-w-[680px] text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-3 text-left">Form</th><th className="px-3 py-3 text-left">문서</th><th className="px-3 py-3 text-left">기본 적용 구분</th></tr></thead><tbody className="divide-y">{deliveryDocumentRows.map((row) => <tr key={row.key}><td className="px-3 py-2 text-xs text-slate-500">{row.form}</td><td className="px-3 py-2 font-medium">{row.document}</td><td className="px-3 py-2"><select className={controlClass} value={current.rules[row.key]} onChange={(event) => update(row.key, event.target.value as DocumentApplicability)}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select></td></tr>)}</tbody></table></div><div className="mt-4 flex items-center justify-between gap-3"><p role="status" className="text-sm font-medium text-emerald-700">{savedNotice}</p><Button onClick={() => { window.localStorage.setItem(DOCUMENT_RULES_STORAGE_KEY, JSON.stringify(items)); setSavedNotice("문서 규칙을 저장했습니다."); }}>문서 규칙 저장</Button></div></div></section>;
}
