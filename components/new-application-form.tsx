"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, FolderPlus, Plus, Save } from "lucide-react";
import { jobs } from "@/data/mock-data";
import { getJobNumber } from "@/lib/job-number";
import { getNumberingRule, getNumberingRules, type NumberingScheme } from "@/lib/numbering-rules";
import type { BusinessArea } from "@/types/certification";
import { Field, controlClass } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { readPrototypeApplications, savePrototypeApplication, type PrototypeApplicationRecord } from "@/lib/prototype-storage";
import type { ApplicationType } from "@/types/certification";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";

type CandidateOption = { id: string; name: string; name_en: string | null; birth_date: string | null; nationality: string | null; email: string | null; phone: string | null };

export function NewApplicationForm() {
  const [receivedAt, setReceivedAt] = useState("2026-09-02");
  const [businessArea, setBusinessArea] = useState<BusinessArea>("ISO");
  const [scheme, setScheme] = useState<NumberingScheme>("IAS");
  const [standard, setStandard] = useState("ISO 9001");
  const [accreditationTrack, setAccreditationTrack] = useState<"ACCREDITED" | "NON_ACCREDITED">("ACCREDITED");
  const [accreditationHidden, setAccreditationHidden] = useState(false);
  const [candidateName, setCandidateName] = useState("");
  const [candidateNameEn, setCandidateNameEn] = useState("");
  const [candidateBirthDate, setCandidateBirthDate] = useState("");
  const [candidateNationality, setCandidateNationality] = useState("대한민국");
  const [candidateEmail, setCandidateEmail] = useState("");
  const [candidatePhone, setCandidatePhone] = useState("");
  const [candidateMode, setCandidateMode] = useState<"NEW" | "EXISTING">("NEW");
  const [existingCandidateId, setExistingCandidateId] = useState("");
  const [candidateOptions, setCandidateOptions] = useState<CandidateOption[]>([]);
  const [applicationType, setApplicationType] = useState<ApplicationType>("최초");
  const [partnerCompany, setPartnerCompany] = useState("직접접수");
  const [grade, setGrade] = useState("Auditor");
  const [notice, setNotice] = useState("");
  const [storedCount, setStoredCount] = useState(0);
  const [storedApplications, setStoredApplications] = useState<PrototypeApplicationRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const rules = useMemo(() => getNumberingRules(businessArea, scheme, accreditationTrack), [businessArea, scheme, accreditationTrack]);
  const selectedRule = getNumberingRule(businessArea, scheme, accreditationTrack, standard) ?? rules[0];
  const activeStandard = selectedRule?.field ?? "";
  const jobNo = useMemo(() => getJobNumber(businessArea, scheme, accreditationTrack, activeStandard, receivedAt, [...jobs, ...storedApplications.map((record) => ({ jobNo: record.jobNo }))]), [businessArea, scheme, accreditationTrack, activeStandard, receivedAt, storedApplications]);
  const sequence = selectedRule && jobNo ? jobNo.replace(selectedRule.jobPrefix, "").slice(2) : "";
  const managementNo = Math.max(1294, ...storedApplications.map((record) => record.managementNo)) + 1;
  const applicationNo = `APP-${businessArea === "ISO" ? "ISO" : "KB"}-${receivedAt.slice(0, 4)}-${String(82 + storedCount).padStart(3, "0")}`;

  function changeRuleContext(area: BusinessArea, nextScheme: NumberingScheme, track: "ACCREDITED" | "NON_ACCREDITED") {
    const nextRules = getNumberingRules(area, nextScheme, track);
    setBusinessArea(area); setScheme(nextScheme); setAccreditationTrack(track); setStandard(nextRules[0]?.field ?? "");
  }

  useEffect(() => {
    const records = readPrototypeApplications(); setStoredApplications(records); setStoredCount(records.length);
    if (!hasEnvVars) return;
    const supabase = createClient();
    void supabase.from("candidates").select("id, name, name_en, birth_date, nationality, email, phone").order("name").then(({ data }) => { if (data) setCandidateOptions(data as CandidateOption[]); });
  }, []);

  function chooseExistingCandidate(id: string) {
    setExistingCandidateId(id);
    const candidate = candidateOptions.find((item) => item.id === id);
    if (!candidate) return;
    setCandidateName(candidate.name); setCandidateNameEn(candidate.name_en ?? ""); setCandidateBirthDate(candidate.birth_date ?? ""); setCandidateNationality(candidate.nationality ?? ""); setCandidateEmail(candidate.email ?? ""); setCandidatePhone(candidate.phone ?? "");
  }

  function changeCandidateMode(mode: "NEW" | "EXISTING") {
    setCandidateMode(mode); setExistingCandidateId(""); setCandidateName(""); setCandidateNameEn(""); setCandidateBirthDate(""); setCandidateNationality(mode === "NEW" ? "대한민국" : ""); setCandidateEmail(""); setCandidatePhone("");
  }

  async function registerApplication() {
    if (!candidateName.trim()) {
      setNotice("후보자 이름을 입력해 주세요.");
      return;
    }
    if (candidateMode === "EXISTING" && !existingCandidateId) { setNotice("기등록 후보자를 선택해 주세요."); return; }
    if (!receivedAt || !jobNo || !selectedRule?.verified) {
      setNotice("확정된 번호 규칙과 접수일을 확인해 주세요.");
      return;
    }
    const record: PrototypeApplicationRecord = { id: `local-${Date.now()}`, applicationNo, receivedAt, candidateName: candidateName.trim(), candidateNameEn: candidateNameEn.trim(), candidateBirthDate, candidateNationality: candidateNationality.trim(), candidateEmail: candidateEmail.trim(), candidatePhone: candidatePhone.trim(), businessArea, scheme, accreditationTrack, accreditationHidden, applicationType, managementNo, jobNo, standard: activeStandard, grade, partnerCompany, primaryOwner: "김담당", status: "INTAKE_REVIEW", createdAt: new Date().toISOString() };
    if (hasEnvVars) {
      setSaving(true);
      try {
        const supabase = createClient();
        const { data, error } = await supabase.rpc("create_application_bundle_v2", { existing_candidate_id: candidateMode === "EXISTING" ? existingCandidateId : null, candidate_name: record.candidateName, candidate_name_en: record.candidateNameEn || "", candidate_birth_date: record.candidateBirthDate || null, candidate_nationality: record.candidateNationality || "", candidate_email: record.candidateEmail || "", candidate_phone: record.candidatePhone || "", application_no: record.applicationNo, received_at: record.receivedAt, business_area: record.businessArea, accreditation_scheme: record.scheme ?? "IAS", accreditation_track: record.accreditationTrack, accreditation_hidden: record.accreditationHidden, application_type: record.applicationType, partner_name: record.partnerCompany, management_no: record.managementNo, job_no: record.jobNo, standard: record.standard, grade: record.grade });
        if (error) throw error;
        const bundle = data as { application_id?: string; candidate_id?: string; job_id?: string } | null;
        record.id = String(bundle?.application_id ?? record.id);
        record.candidateId = bundle?.candidate_id;
        record.jobId = bundle?.job_id;
        setStoredApplications((records) => [record, ...records]);
        setStoredCount((count) => count + 1);
        setNotice(`${applicationNo} 신청이 Supabase DB에 등록되었습니다.`);
        return;
      } catch (error) {
        setNotice(`DB 등록에 실패했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
        return;
      } finally { setSaving(false); }
    }
    savePrototypeApplication(record);
    setStoredApplications((records) => [record, ...records]);
    setStoredCount((count) => count + 1);
    setNotice(`${applicationNo} 신청이 브라우저에 등록되었습니다.`);
  }

  return <div className="max-w-5xl"><Link href="/applications" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500"><ArrowLeft className="h-4 w-4"/>신청 목록으로</Link>
    <form className="space-y-5">
      <section className="rounded-lg border bg-white shadow-sm"><div className="border-b px-6 py-5"><h2 className="font-semibold">후보자 기본정보</h2><p className="mt-1 text-sm text-slate-500">기등록 후보자는 기존 정보에 신청과 Job만 추가되며 중복 후보자로 생성되지 않습니다.</p></div><div className="border-b px-6 py-4"><div className="inline-flex rounded-md border bg-slate-50 p-1"><button type="button" onClick={() => changeCandidateMode("NEW")} className={`rounded px-4 py-2 text-sm font-medium ${candidateMode === "NEW" ? "bg-white text-blue-800 shadow-sm" : "text-slate-500"}`}>신규 후보자</button><button type="button" onClick={() => changeCandidateMode("EXISTING")} className={`rounded px-4 py-2 text-sm font-medium ${candidateMode === "EXISTING" ? "bg-white text-blue-800 shadow-sm" : "text-slate-500"}`}>기등록 후보자</button></div></div>{candidateMode === "EXISTING" && <div className="border-b bg-blue-50 px-6 py-4"><Field label="기등록 후보자 선택" required><select className={controlClass} value={existingCandidateId} onChange={(event) => chooseExistingCandidate(event.target.value)}><option value="">후보자를 선택하세요</option>{candidateOptions.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}{candidate.name_en ? ` (${candidate.name_en})` : ""}</option>)}</select></Field></div>}<div className="grid gap-5 p-6 sm:grid-cols-2"><Field label="후보자명" required><input className={controlClass} value={candidateName} onChange={(event) => setCandidateName(event.target.value)} disabled={candidateMode === "EXISTING"} placeholder="예: 홍길동"/></Field><Field label="영문명"><input className={controlClass} value={candidateNameEn} onChange={(event) => setCandidateNameEn(event.target.value)} disabled={candidateMode === "EXISTING"} placeholder="예: HONG GIL DONG"/></Field><Field label="생년월일"><input type="date" className={controlClass} value={candidateBirthDate} onChange={(event) => setCandidateBirthDate(event.target.value)} disabled={candidateMode === "EXISTING"}/></Field><Field label="국적"><input className={controlClass} value={candidateNationality} onChange={(event) => setCandidateNationality(event.target.value)} disabled={candidateMode === "EXISTING"} placeholder="예: 대한민국"/></Field><Field label="이메일"><input type="email" className={controlClass} value={candidateEmail} onChange={(event) => setCandidateEmail(event.target.value)} disabled={candidateMode === "EXISTING"} placeholder="name@example.com"/></Field><Field label="전화번호"><input type="tel" className={controlClass} value={candidatePhone} onChange={(event) => setCandidatePhone(event.target.value)} disabled={candidateMode === "EXISTING"} placeholder="010-0000-0000"/></Field></div>{candidateMode === "EXISTING" && <p className="mx-6 mb-6 rounded-md bg-slate-50 px-4 py-3 text-xs text-slate-600">후보자 정보 변경은 후보자 상세화면에서 변경 사유와 함께 처리합니다.</p>}</section>
      <section className="rounded-lg border bg-white shadow-sm"><div className="border-b px-6 py-5"><h2 className="font-semibold">접수 기본정보</h2><p className="mt-1 text-sm text-slate-500">최초 자료가 대표메일에 도착한 날짜를 접수일로 사용합니다.</p></div><div className="grid gap-5 p-6 sm:grid-cols-2"><Field label="공식 접수일" required><input type="date" className={controlClass} value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)}/></Field><Field label="발행 분야" required><select className={controlClass} value={businessArea} onChange={(event) => { const value = event.target.value as BusinessArea; changeRuleContext(value, scheme, accreditationTrack); setGrade(value === "ISO" ? "Auditor" : "Pre-master"); }}><option value="ISO">ISO 경영시스템 심사원</option><option value="K_BEAUTY">K-Beauty 전문가 자격</option></select></Field><Field label="인정기구" required><select className={controlClass} value={scheme} onChange={(event) => changeRuleContext(businessArea, event.target.value as NumberingScheme, accreditationTrack)}><option value="IAS">IAS</option><option value="PJLA">PJLA</option></select></Field><Field label="인정 구분" required><div className="space-y-3"><select className={controlClass} value={accreditationTrack} onChange={(event) => { const value = event.target.value as "ACCREDITED" | "NON_ACCREDITED"; changeRuleContext(businessArea, scheme, value); if (value === "NON_ACCREDITED") setAccreditationHidden(false); }}><option value="ACCREDITED">인정</option><option value="NON_ACCREDITED">비인정</option></select>{accreditationTrack === "ACCREDITED" && <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={accreditationHidden} onChange={(event) => setAccreditationHidden(event.target.checked)}/><span><strong>인정 표시 숨김</strong><span className="mt-1 block text-xs text-amber-800">인정 고객으로 관리하되 외부 표시와 생성 문서에서는 인정 정보를 숨깁니다.</span></span></label>}</div></Field><Field label="신청구분" required><select className={controlClass} value={applicationType} onChange={(event) => setApplicationType(event.target.value as ApplicationType)}><option>최초</option><option>갱신</option><option>등급변경</option><option>전환</option><option>기타</option></select></Field><Field label="파트너사"><select className={controlClass} value={partnerCompany} onChange={(event) => setPartnerCompany(event.target.value)}><option>직접접수</option><option>한국품질파트너스</option><option>케이뷰티전문가연합회</option></select></Field></div>{accreditationTrack === "ACCREDITED" && accreditationHidden && <div className="mx-6 mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">내부 분류: 인정 · 표시 방식: 숨김</div>}</section>
      <section className="rounded-lg border bg-white shadow-sm"><div className="flex items-center justify-between border-b px-6 py-5"><div><h2 className="font-semibold">신청 세부 분야</h2><p className="mt-1 text-sm text-slate-500">선택한 분야·인정기구·인정 구분에 맞는 시트 규칙만 표시합니다.</p></div><Button type="button" variant="outline" onClick={() => setNotice("다중 분야는 다음 단계에서 여러 Job으로 확장됩니다. 현재는 1개 Job을 등록합니다.")}><Plus/>분야 추가</Button></div><div className="p-6"><div className="grid gap-4 rounded-lg border bg-slate-50 p-4 sm:grid-cols-4"><Field label="세부 분야"><select className={controlClass} value={activeStandard} onChange={(event) => setStandard(event.target.value)}>{rules.map((rule) => <option key={rule.field} value={rule.field}>{rule.field}{rule.verified ? "" : " (확인 필요)"}</option>)}</select></Field><Field label="등급"><select className={controlClass} value={grade} onChange={(event) => setGrade(event.target.value)}>{businessArea === "ISO" ? <><option>Auditor</option><option>Lead Auditor</option><option>Provisional Auditor</option><option>Internal Auditor</option><option>Verification Auditor</option></> : <><option>Pre-master</option><option>Master</option><option>Global Master</option></>}</select></Field><Field label="관리 No."><input className={controlClass} value={managementNo} readOnly/></Field><Field label="예상 Job No."><input className={controlClass} value={jobNo || "규칙 확인 필요"} readOnly/></Field></div>
        <div className="mt-4 grid gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 text-center sm:grid-cols-4"><div><p className="text-xs text-blue-700">Job 코드</p><p className="mt-1 font-semibold text-blue-950">{selectedRule?.jobPrefix ?? "-"}</p></div><div><p className="text-xs text-blue-700">접수연도 (YY)</p><p className="mt-1 font-semibold text-blue-950">{receivedAt.slice(2, 4) || "-"}</p></div><div><p className="text-xs text-blue-700">다음 순번 (NNNN)</p><p className="mt-1 font-semibold text-blue-950">{sequence || "-"}</p></div><div><p className="text-xs text-blue-700">인증번호 형식</p><p className="mt-1 font-semibold text-blue-950">{selectedRule?.certificatePattern ?? "-"}</p></div></div>
        <p className="mt-3 text-xs text-slate-500">근거 시트: {selectedRule?.sourceSheet ?? "-"} · G는 등급 코드입니다. {selectedRule && !selectedRule.verified && "현재 시트에서 번호 예시를 확정하지 못해 자동 부여를 차단했습니다."}</p></div></section>
      <section className="rounded-lg border border-blue-100 bg-blue-50 p-5"><div className="flex items-start gap-3"><FolderPlus className="mt-0.5 h-5 w-5 text-blue-800"/><div><p className="font-semibold text-blue-950">권장 Dropbox 폴더명</p><p className="mt-2 rounded-md bg-white px-4 py-3 font-mono text-sm text-slate-800">{managementNo} {candidateName.trim() || "후보자명"} ({grade} {activeStandard} {applicationType})</p><p className="mt-2 text-xs text-blue-700">현재는 폴더명을 복사해 수동 생성하고, 향후 Dropbox 연결 시 버튼으로 생성할 수 있습니다.</p></div></div></section>
      {notice && <div role="status" className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-medium text-emerald-900"><CheckCircle2 className="h-4 w-4"/>{notice}{notice.includes("등록되었습니다") && <Link href="/applications" className="ml-auto underline">목록에서 확인</Link>}</div>}
      <div className="flex justify-end gap-2"><Button variant="outline" asChild><Link href="/applications">취소</Link></Button><Button type="button" disabled={saving} className="bg-blue-800 hover:bg-blue-900" onClick={registerApplication}><Save/>{saving ? "DB 저장 중..." : "번호 확정 및 신청 등록"}</Button></div>
    </form>
  </div>;
}
