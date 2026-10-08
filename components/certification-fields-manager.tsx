"use client";
import { useState } from "react";
import { useCertificationFields } from "@/components/use-certification-fields";
import { createCertificationField } from "@/lib/certification-fields";
import { Button } from "@/components/ui/button";
import { Field, controlClass } from "@/components/form-fields";
const initial = { businessArea: "ISO", scheme: "IAS", accreditationTrack: "ACCREDITED", field: "", jobPrefix: "", certificateCode: "" };
export function CertificationFieldsManager() {
  const store = useCertificationFields(), [draft, setDraft] = useState(initial), [inputError, setInputError] = useState("");
  const add = async () => {
    setInputError("");
    try { const rule = createCertificationField(draft); if (await store.add(rule)) setDraft({ ...draft, field: "", jobPrefix: "", certificateCode: "" }); }
    catch (issue) { setInputError(issue instanceof Error ? issue.message : "입력을 확인해 주세요."); }
  };
  return <section className="mt-5 rounded-xl border bg-card p-5" id="certification-fields">
    <h3 className="font-semibold">인증분야·표준 추가</h3>
    <p className="mt-2 text-sm text-muted-foreground">새 표준과 K뷰티 세부 분야를 추가합니다. 번호 규칙을 확인한 뒤 등록하세요. 기존 이력과 이미 부여된 번호는 변경하지 않습니다.</p>
    <div className="mt-3 flex flex-wrap items-center justify-between gap-3"><p role="status" className="text-sm">{store.loading ? "인증분야 조회 중" : store.error || `기존·추가 분야 ${store.catalog.length}개 규칙`}</p><Button variant="outline" disabled={store.loading || store.saving} onClick={store.reload}>다시 조회</Button></div>
    <fieldset disabled={store.loading || store.saving || Boolean(store.error)} className="mt-4 grid gap-4 md:grid-cols-3">
      <Field label="사업 분야"><select className={controlClass} value={draft.businessArea} onChange={event => setDraft({ ...draft, businessArea: event.target.value })}><option value="ISO">ISO 심사원</option><option value="K_BEAUTY">K뷰티 전문가</option></select></Field>
      <Field label="인정기구"><select className={controlClass} value={draft.scheme} onChange={event => setDraft({ ...draft, scheme: event.target.value })}><option>IAS</option><option>PJLA</option></select></Field>
      <Field label="인정 구분"><select className={controlClass} value={draft.accreditationTrack} onChange={event => setDraft({ ...draft, accreditationTrack: event.target.value })}><option value="ACCREDITED">인정</option><option value="NON_ACCREDITED">비인정</option></select></Field>
      <Field label="표준·세부 분야명"><input className={controlClass} value={draft.field} placeholder="추가할 표준 또는 분야" onChange={event => setDraft({ ...draft, field: event.target.value })}/></Field>
      <Field label="Job 접두어"><input className={controlClass} value={draft.jobPrefix} placeholder="기관에서 정한 영문 코드" onChange={event => setDraft({ ...draft, jobPrefix: event.target.value })}/></Field>
      <Field label="인증번호 분야 코드"><input className={controlClass} value={draft.certificateCode} placeholder="ISO/IAS: 숫자 한 자리" onChange={event => setDraft({ ...draft, certificateCode: event.target.value })}/></Field>
      <p className="text-xs text-muted-foreground md:col-span-2">ISO/IAS의 8자리 인증번호는 표준 코드가 한 자리이므로 코드가 소진되면 번호체계 확장이 필요합니다. 기존 번호 형식을 자동으로 바꾸지는 않습니다. 신규 분야의 교육·심의·문서 요구사항은 별도 확인이 필요합니다.</p>
      <Button onClick={add}>{store.saving ? "저장 중..." : "인증분야 추가"}</Button>
    </fieldset>
    {(inputError || store.notice) && <p role="status" className="mt-3 text-sm">{inputError || store.notice}</p>}
    <div className="mt-4 max-h-96 overflow-auto"><table className="w-full text-sm"><thead><tr>{["분야", "인정기구", "구분", "표준·세부 분야", "Job 형식", "인증번호 형식"].map(label => <th key={label} className="p-2 text-left">{label}</th>)}</tr></thead><tbody>{!store.loading && !store.error && store.catalog.map((rule,index) => <tr key={index} className="border-t"><td className="p-2">{rule.businessArea === "ISO" ? "ISO" : "K뷰티"}</td><td className="p-2">{rule.scheme}</td><td className="p-2">{rule.accreditationTrack === "ACCREDITED" ? "인정" : rule.accreditationTrack === "NON_ACCREDITED" ? "비인정" : "공통"}</td><td className="p-2">{rule.field}</td><td className="p-2">{rule.jobPattern}</td><td className="p-2">{rule.certificatePattern}</td></tr>)}</tbody></table></div>
  </section>;
}
