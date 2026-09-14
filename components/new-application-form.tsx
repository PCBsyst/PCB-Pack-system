"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, FolderPlus, Plus, Save } from "lucide-react";
import { candidates, jobs } from "@/data/mock-data";
import { getJobNumber } from "@/lib/job-number";
import { getNumberingRule, getNumberingRules, type NumberingScheme } from "@/lib/numbering-rules";
import type { BusinessArea } from "@/types/certification";
import { Field, controlClass } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { readPrototypeApplications, savePrototypeApplication } from "@/lib/prototype-storage";
import type { ApplicationType } from "@/types/certification";

export function NewApplicationForm() {
  const [receivedAt, setReceivedAt] = useState("2026-09-02");
  const [businessArea, setBusinessArea] = useState<BusinessArea>("ISO");
  const [scheme, setScheme] = useState<NumberingScheme>("GPC");
  const [standard, setStandard] = useState("ISO 9001");
  const [accreditationTrack, setAccreditationTrack] = useState<"ACCREDITED" | "NON_ACCREDITED">("ACCREDITED");
  const [accreditationHidden, setAccreditationHidden] = useState(false);
  const [candidateId, setCandidateId] = useState(candidates[0].id);
  const [applicationType, setApplicationType] = useState<ApplicationType>("최초");
  const [partnerCompany, setPartnerCompany] = useState("직접접수");
  const [grade, setGrade] = useState("Auditor");
  const [notice, setNotice] = useState("");
  const [storedCount, setStoredCount] = useState(0);
  const rules = useMemo(() => getNumberingRules(businessArea, scheme, accreditationTrack), [businessArea, scheme, accreditationTrack]);
  const selectedRule = getNumberingRule(businessArea, scheme, accreditationTrack, standard) ?? rules[0];
  const activeStandard = selectedRule?.field ?? "";
  const jobNo = useMemo(() => getJobNumber(businessArea, scheme, accreditationTrack, activeStandard, receivedAt, jobs), [businessArea, scheme, accreditationTrack, activeStandard, receivedAt]);
  const sequence = selectedRule && jobNo ? jobNo.replace(selectedRule.jobPrefix, "").slice(2) : "";
  const candidate = candidates.find((item) => item.id === candidateId) ?? candidates[0];
  const managementNo = 1295 + storedCount;
  const applicationNo = `APP-${businessArea === "ISO" ? "ISO" : "KB"}-${receivedAt.slice(0, 4)}-${String(82 + storedCount).padStart(3, "0")}`;

  function changeRuleContext(area: BusinessArea, nextScheme: NumberingScheme, track: "ACCREDITED" | "NON_ACCREDITED") {
    const nextRules = getNumberingRules(area, nextScheme, track);
    setBusinessArea(area); setScheme(nextScheme); setAccreditationTrack(track); setStandard(nextRules[0]?.field ?? "");
  }

  useEffect(() => setStoredCount(readPrototypeApplications().length), []);

  function registerApplication() {
    if (!receivedAt || !jobNo || !selectedRule?.verified) {
      setNotice("확정된 번호 규칙과 접수일을 확인해 주세요.");
      return;
    }
    savePrototypeApplication({ id: `local-${Date.now()}`, applicationNo, receivedAt, candidateName: candidate.name, businessArea, accreditationTrack, accreditationHidden, applicationType, managementNo, jobNo, standard: activeStandard, grade, partnerCompany, primaryOwner: "김담당", status: "INTAKE_REVIEW", createdAt: new Date().toISOString() });
    setStoredCount((count) => count + 1);
    setNotice(`${applicationNo} 신청이 브라우저에 등록되었습니다.`);
  }

  return <div className="max-w-5xl"><Link href="/applications" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500"><ArrowLeft className="h-4 w-4"/>신청 목록으로</Link>
    <form className="space-y-5">
      <section className="rounded-lg border bg-white shadow-sm"><div className="border-b px-6 py-5"><h2 className="font-semibold">접수 기본정보</h2><p className="mt-1 text-sm text-slate-500">최초 자료가 대표메일에 도착한 날짜를 접수일로 사용합니다.</p></div><div className="grid gap-5 p-6 sm:grid-cols-2"><Field label="공식 접수일" required><input type="date" className={controlClass} value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)}/></Field><Field label="후보자" required><select className={controlClass} value={candidateId} onChange={(event) => setCandidateId(event.target.value)}>{candidates.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field><Field label="발행 분야" required><select className={controlClass} value={businessArea} onChange={(event) => { const value = event.target.value as BusinessArea; changeRuleContext(value, scheme, accreditationTrack); setGrade(value === "ISO" ? "Auditor" : "Pre-master"); }}><option value="ISO">ISO 경영시스템 심사원</option><option value="K_BEAUTY">K-Beauty 전문가 자격</option></select></Field><Field label="관리 체계" required><select className={controlClass} value={scheme} onChange={(event) => changeRuleContext(businessArea, event.target.value as NumberingScheme, accreditationTrack)}><option value="GPC">GPC 기존 체계</option><option value="PJLA">PJLA 체계</option></select></Field><Field label="인정 구분" required><div className="space-y-3"><select className={controlClass} value={accreditationTrack} onChange={(event) => { const value = event.target.value as "ACCREDITED" | "NON_ACCREDITED"; changeRuleContext(businessArea, scheme, value); if (value === "NON_ACCREDITED") setAccreditationHidden(false); }}><option value="ACCREDITED">인정</option><option value="NON_ACCREDITED">비인정</option></select>{accreditationTrack === "ACCREDITED" && <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={accreditationHidden} onChange={(event) => setAccreditationHidden(event.target.checked)}/><span><strong>인정 표시 숨김</strong><span className="mt-1 block text-xs text-amber-800">인정 고객으로 관리하되 외부 표시와 생성 문서에서는 인정 정보를 숨깁니다.</span></span></label>}</div></Field><Field label="신청구분" required><select className={controlClass} value={applicationType} onChange={(event) => setApplicationType(event.target.value as ApplicationType)}><option>최초</option><option>갱신</option><option>등급변경</option><option>기타</option></select></Field><Field label="파트너사"><select className={controlClass} value={partnerCompany} onChange={(event) => setPartnerCompany(event.target.value)}><option>직접접수</option><option>한국품질파트너스</option><option>케이뷰티전문가연합회</option></select></Field></div>{accreditationTrack === "ACCREDITED" && accreditationHidden && <div className="mx-6 mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">내부 분류: 인정 · 표시 방식: 숨김</div>}</section>
      <section className="rounded-lg border bg-white shadow-sm"><div className="flex items-center justify-between border-b px-6 py-5"><div><h2 className="font-semibold">신청 세부 분야</h2><p className="mt-1 text-sm text-slate-500">선택한 분야·관리 체계·인정 구분에 맞는 시트 규칙만 표시합니다.</p></div><Button type="button" variant="outline" onClick={() => setNotice("다중 분야는 다음 단계에서 여러 Job으로 확장됩니다. 현재는 1개 Job을 등록합니다.")}><Plus/>분야 추가</Button></div><div className="p-6"><div className="grid gap-4 rounded-lg border bg-slate-50 p-4 sm:grid-cols-4"><Field label="세부 분야"><select className={controlClass} value={activeStandard} onChange={(event) => setStandard(event.target.value)}>{rules.map((rule) => <option key={rule.field} value={rule.field}>{rule.field}{rule.verified ? "" : " (확인 필요)"}</option>)}</select></Field><Field label="등급"><select className={controlClass} value={grade} onChange={(event) => setGrade(event.target.value)}>{businessArea === "ISO" ? <><option>Auditor</option><option>Lead Auditor</option><option>Provisional Auditor</option><option>Internal Auditor</option><option>Verification Auditor</option></> : <><option>Pre-master</option><option>Master</option><option>Global Master</option></>}</select></Field><Field label="관리 No."><input className={controlClass} value={managementNo} readOnly/></Field><Field label="예상 Job No."><input className={controlClass} value={jobNo || "규칙 확인 필요"} readOnly/></Field></div>
        <div className="mt-4 grid gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 text-center sm:grid-cols-4"><div><p className="text-xs text-blue-700">Job 코드</p><p className="mt-1 font-semibold text-blue-950">{selectedRule?.jobPrefix ?? "-"}</p></div><div><p className="text-xs text-blue-700">접수연도 (YY)</p><p className="mt-1 font-semibold text-blue-950">{receivedAt.slice(2, 4) || "-"}</p></div><div><p className="text-xs text-blue-700">다음 순번 (NNNN)</p><p className="mt-1 font-semibold text-blue-950">{sequence || "-"}</p></div><div><p className="text-xs text-blue-700">인증번호 형식</p><p className="mt-1 font-semibold text-blue-950">{selectedRule?.certificatePattern ?? "-"}</p></div></div>
        <p className="mt-3 text-xs text-slate-500">근거 시트: {selectedRule?.sourceSheet ?? "-"} · G는 등급 코드입니다. {selectedRule && !selectedRule.verified && "현재 시트에서 번호 예시를 확정하지 못해 자동 부여를 차단했습니다."}</p></div></section>
      <section className="rounded-lg border border-blue-100 bg-blue-50 p-5"><div className="flex items-start gap-3"><FolderPlus className="mt-0.5 h-5 w-5 text-blue-800"/><div><p className="font-semibold text-blue-950">권장 Dropbox 폴더명</p><p className="mt-2 rounded-md bg-white px-4 py-3 font-mono text-sm text-slate-800">{managementNo} {candidate.name} ({grade} {activeStandard} {applicationType})</p><p className="mt-2 text-xs text-blue-700">현재는 폴더명을 복사해 수동 생성하고, 향후 Dropbox 연결 시 버튼으로 생성할 수 있습니다.</p></div></div></section>
      {notice && <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"><CheckCircle2 className="h-4 w-4"/>{notice}{notice.includes("등록되었습니다") && <Link href="/applications" className="ml-auto underline">목록에서 확인</Link>}</div>}
      <div className="flex justify-end gap-2"><Button variant="outline" asChild><Link href="/applications">취소</Link></Button><Button type="button" className="bg-blue-800 hover:bg-blue-900" onClick={registerApplication}><Save/>번호 확정 및 신청 등록</Button></div>
    </form>
  </div>;
}
