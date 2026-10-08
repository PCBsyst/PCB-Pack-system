"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, FolderPlus, Plus, Save, Trash2 } from "lucide-react";
import { jobs } from "@/data/mock-data";
import { applications as sampleApplications } from "@/data/workflow-data";
import { allocateAreaManagementNumbers } from "@/lib/management-number-policy";
import { getJobNumber } from "@/lib/job-number";
import { getNumberingRule, getNumberingRules, type NumberingScheme } from "@/lib/numbering-rules";
import type { BusinessArea } from "@/types/certification";
import { Field, controlClass } from "@/components/form-fields";
import { Button } from "@/components/ui/button";
import { readPrototypeApplications, savePrototypeApplication, type PrototypeApplicationRecord } from "@/lib/prototype-storage";
import type { ApplicationType } from "@/types/certification";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";
import { readStoredPartners, type PartnerItem } from "@/components/partners-manager";
import { useCertificationFields } from "@/components/use-certification-fields";
import { isAllocatedNumber } from "@/lib/allocated-number-validation";
import { readApplicationBundle, hasUniqueRegistrationIds } from "@/lib/application-registration-checks";
import { hasExactRecordValues } from "@/lib/workflow-record-checks";

type CandidateOption = { id: string; name: string; name_en: string | null; birth_date: string | null; nationality: string | null; email: string | null; phone: string | null };
type JobDraft = { id: string; standard: string; grade: string; previousJobId: string };
type StaffOption = { id: string; display_name: string; role: "STAFF" | "ADMIN" };
type PreviousJobOption = { id: string; jobNo: string; standard: string; grade: string; certificationNo: string; issueDate: string };

export function NewApplicationForm() {
  const { catalog, loading: fieldsLoading, error: fieldsError } = useCertificationFields();
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
  const [partnerOptions, setPartnerOptions] = useState<PartnerItem[]>([]);
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [primaryOwnerId, setPrimaryOwnerId] = useState("");
  const [grade, setGrade] = useState("Auditor");
  const [jobDrafts, setJobDrafts] = useState<JobDraft[]>([]);
  const [previousJobs, setPreviousJobs] = useState<PreviousJobOption[]>([]);
  const [notice, setNotice] = useState("");
  const [storedCount, setStoredCount] = useState(0);
  const [storedApplications, setStoredApplications] = useState<PrototypeApplicationRecord[]>([]);
  const [saving, setSaving] = useState(false);
  const registrationBusy = useRef(false);
  const registrationUncertain = useRef(false);
  const [registrationNeedsReview, setRegistrationNeedsReview] = useState(false);
  const [registrationCheckNo, setRegistrationCheckNo] = useState("");
  const [registrationCheckCount, setRegistrationCheckCount] = useState(0);
  const rules = useMemo(() => getNumberingRules(businessArea, scheme, accreditationTrack, catalog), [businessArea, scheme, accreditationTrack, catalog]);
  const selectedRule = getNumberingRule(businessArea, scheme, accreditationTrack, standard, catalog) ?? rules[0];
  const activeStandard = selectedRule?.field ?? "";
  const existingJobNumbers = useMemo(() => [...jobs, ...storedApplications.map((record) => ({ jobNo: record.jobNo }))], [storedApplications]);
  const jobNo = useMemo(() => fieldsLoading || fieldsError ? "" : getJobNumber(businessArea, scheme, accreditationTrack, activeStandard, receivedAt, existingJobNumbers, catalog), [businessArea, scheme, accreditationTrack, activeStandard, receivedAt, existingJobNumbers, catalog, fieldsLoading, fieldsError]);
  const sequence = selectedRule && jobNo ? jobNo.replace(selectedRule.jobPrefix, "").slice(2) : "";
  const managementNo = Math.max(0, ...jobs.filter(record => record.businessArea === businessArea).map(record => record.managementNo ?? 0), ...sampleApplications.filter(record => record.businessArea === businessArea).map(record => record.managementNoTo), ...storedApplications.filter(record => record.businessArea === businessArea).map(record => record.managementNo)) + 1;
  const jobEntries = useMemo(() => {
    const assigned: Array<JobDraft & { managementNo: number; jobNo: string }> = [];
    for (const [index, draft] of jobDrafts.entries()) {
      const generated = getJobNumber(businessArea, scheme, accreditationTrack, draft.standard, receivedAt, [...existingJobNumbers, ...assigned.map((item) => ({ jobNo: item.jobNo }))], catalog);
      assigned.push({ ...draft, managementNo: managementNo + index, jobNo: generated });
    }
    return assigned;
  }, [accreditationTrack, businessArea, existingJobNumbers, jobDrafts, managementNo, receivedAt, scheme, catalog]);
  const applicationNo = `APP-${businessArea === "ISO" ? "ISO" : "KB"}-${receivedAt.slice(0, 4)}-${String(82 + storedCount).padStart(3, "0")}`;

  function changeRuleContext(area: BusinessArea, nextScheme: NumberingScheme, track: "ACCREDITED" | "NON_ACCREDITED") {
    const nextRules = getNumberingRules(area, nextScheme, track, catalog);
    setBusinessArea(area); setScheme(nextScheme); setAccreditationTrack(track); setStandard(nextRules[0]?.field ?? ""); setJobDrafts([]);
  }

  function addJob() {
    if (fieldsLoading || fieldsError) { setNotice(fieldsError || "인증분야 설정을 불러오는 중입니다."); return; }
    if (!selectedRule?.verified || !jobNo) { setNotice("확정된 번호 규칙이 있는 세부 분야만 추가할 수 있습니다."); return; }
    if (jobDrafts.some((item) => item.standard === activeStandard)) { setNotice("같은 세부 분야는 한 신청에 중복 추가할 수 없습니다."); return; }
    const previousJobId = previousJobs.find((item) => item.standard === activeStandard)?.id ?? "";
    setJobDrafts((current) => [...current, { id: crypto.randomUUID(), standard: activeStandard, grade, previousJobId }]);
    setNotice(`${activeStandard} · ${grade} Job을 신청 목록에 추가했습니다.`);
  }

  useEffect(() => {
    const records = readPrototypeApplications(); setStoredApplications(records); setStoredCount(new Set(records.map((record) => record.id)).size);
    setPartnerOptions(readStoredPartners().filter((partner) => partner.active));
    if (!hasEnvVars) return;
    const supabase = createClient();
    void supabase.from("candidates").select("id, name, name_en, birth_date, nationality, email, phone").order("name").then(({ data }) => { if (data) setCandidateOptions(data as CandidateOption[]); });
    void supabase.from("partners").select("id, name, active").eq("active", true).order("name").then(({ data }) => { if (data) setPartnerOptions(data as PartnerItem[]); });
    void Promise.all([supabase.auth.getUser(), supabase.from("profiles").select("id, display_name, role").eq("active", true).order("display_name")]).then(([authResult, profileResult]) => { const options = (profileResult.data ?? []) as StaffOption[]; setStaffOptions(options); setPrimaryOwnerId(authResult.data.user?.id ?? options[0]?.id ?? ""); });
  }, []);

  async function chooseExistingCandidate(id: string) {
    setExistingCandidateId(id);
    setPreviousJobs([]);
    const candidate = candidateOptions.find((item) => item.id === id);
    if (!candidate) return;
    setCandidateName(candidate.name); setCandidateNameEn(candidate.name_en ?? ""); setCandidateBirthDate(candidate.birth_date ?? ""); setCandidateNationality(candidate.nationality ?? ""); setCandidateEmail(candidate.email ?? ""); setCandidatePhone(candidate.phone ?? "");
    if (hasEnvVars) {
      const { data } = await createClient().from("jobs").select("id, job_no, standard, grade, certification_records(certification_no, issue_date, history_state), processing_cycles(status)").eq("candidate_id", id);
      const options = (data ?? []).flatMap((row) => {
        const certificates = Array.isArray(row.certification_records) ? row.certification_records : [];
        const cycles = Array.isArray(row.processing_cycles) ? row.processing_cycles : [];
        const certificate = certificates.find((item) => item.history_state === "CURRENT");
        if (!certificate || !cycles.some((item) => item.status === "COMPLETED")) return [];
        return [{ id: row.id, jobNo: row.job_no, standard: row.standard, grade: row.grade, certificationNo: certificate.certification_no, issueDate: certificate.issue_date }];
      });
      setPreviousJobs(options);
    }
  }

  function changeCandidateMode(mode: "NEW" | "EXISTING") {
    setCandidateMode(mode); setExistingCandidateId(""); setPreviousJobs([]); setCandidateName(""); setCandidateNameEn(""); setCandidateBirthDate(""); setCandidateNationality(mode === "NEW" ? "대한민국" : ""); setCandidateEmail(""); setCandidatePhone("");
  }

  function changeApplicationType(type: ApplicationType) {
    setApplicationType(type);
    if ((type === "갱신" || type === "등급변경") && candidateMode !== "EXISTING") changeCandidateMode("EXISTING");
  }

  async function registerApplication() {
    if (registrationBusy.current) return;
    if (registrationUncertain.current) { setNotice("일부 저장 가능성이 있어 재등록을 중단합니다. 신청관리에서 기존 등록 여부와 연결 기록을 확인해 주세요."); return; }
    if (fieldsLoading || fieldsError) { setNotice(fieldsError || "인증분야 설정을 불러오는 중입니다."); return; }
    if (!candidateName.trim()) {
      setNotice("후보자 이름을 입력해 주세요.");
      return;
    }
    if (candidateMode === "EXISTING" && !existingCandidateId) { setNotice("기등록 후보자를 선택해 주세요."); return; }
    const requiresPrevious = applicationType === "갱신" || applicationType === "등급변경";
    if (requiresPrevious && (candidateMode !== "EXISTING" || jobEntries.some((item) => !item.previousJobId))) { setNotice("갱신·등급변경은 기등록 후보자의 완료된 기존 인증 Job을 분야별로 선택해야 합니다."); return; }
    if (!receivedAt || jobEntries.length === 0 || jobEntries.some((item) => !item.jobNo)) {
      setNotice("접수일을 확인하고 신청 세부 분야를 한 개 이상 추가해 주세요.");
      return;
    }
    registrationBusy.current = true;
    const sharedId = `local-${Date.now()}`;
    const ownerName = staffOptions.find((staff) => staff.id === primaryOwnerId)?.display_name ?? "김담당";
    const records: PrototypeApplicationRecord[] = jobEntries.map((entry) => ({ id: sharedId, applicationNo, receivedAt, candidateName: candidateName.trim(), candidateNameEn: candidateNameEn.trim(), candidateBirthDate, candidateNationality: candidateNationality.trim(), candidateEmail: candidateEmail.trim(), candidatePhone: candidatePhone.trim(), businessArea, scheme, accreditationTrack, accreditationHidden, applicationType, managementNo: entry.managementNo, jobNo: entry.jobNo, standard: entry.standard, grade: entry.grade, partnerCompany, primaryOwner: ownerName, status: "INTAKE_REVIEW", createdAt: new Date().toISOString() }));
    if (hasEnvVars) {
      setSaving(true);
      let bundleAttempted = false;
      try {
        const supabase = createClient();
        const { data: userData, error: authError } = await supabase.auth.getUser();
        if (authError || !userData.user) throw new Error("직원 인증 확인 실패");
        const ownerId = primaryOwnerId || userData.user?.id;
        const [{ data: allocatedApplicationNo, error: applicationNoError }, { data: allocatedManagementStart, error: managementNoError, legacy: legacyManagement }] = await Promise.all([
          supabase.rpc("allocate_application_number", { p_business_area: businessArea, p_received_at: receivedAt }),
          allocateAreaManagementNumbers(supabase, businessArea, records.length),
        ]);
        if (applicationNoError || !allocatedApplicationNo) throw applicationNoError ?? new Error("신청번호를 확보하지 못했습니다.");
        if (managementNoError || typeof allocatedManagementStart !== "number" || !Number.isInteger(allocatedManagementStart) || allocatedManagementStart < 1 || allocatedManagementStart + records.length - 1 > 2147483647) throw managementNoError ?? new Error("관리번호를 확보하지 못했습니다.");
        for (let index = 0; index < records.length; index += 1) records[index] = { ...records[index], applicationNo: String(allocatedApplicationNo), managementNo: Number(allocatedManagementStart) + index };
        for (let index = 0; index < records.length; index += 1) {
          const rule = getNumberingRule(businessArea, scheme, accreditationTrack, records[index].standard, catalog);
          if (!rule?.verified || !rule.jobPrefix) throw new Error(`${records[index].standard}의 Job No. 규칙이 확정되지 않았습니다.`);
          const { data: allocatedJobNo, error: allocationError } = await supabase.rpc("allocate_job_number", { p_job_prefix: rule.jobPrefix, p_received_at: receivedAt });
          if (allocationError) throw allocationError;
          if (!isAllocatedNumber(allocatedJobNo, `${rule.jobPrefix}${receivedAt.slice(2, 4)}`)) throw new Error(`${records[index].standard} Job No. 응답이 접수연도·접두어·네 자리 순번 규칙과 일치하지 않습니다. 신청 저장 전에 번호를 확인해 주세요.`);
          records[index] = { ...records[index], jobNo: allocatedJobNo };
        }
        const first = records[0];
        bundleAttempted = true;
        const { data, error } = await supabase.rpc("create_application_bundle_v2", { existing_candidate_id: candidateMode === "EXISTING" ? existingCandidateId : null, candidate_name: first.candidateName, candidate_name_en: first.candidateNameEn || "", candidate_birth_date: first.candidateBirthDate || null, candidate_nationality: first.candidateNationality || "", candidate_email: first.candidateEmail || "", candidate_phone: first.candidatePhone || "", application_no: first.applicationNo, received_at: first.receivedAt, business_area: first.businessArea, accreditation_scheme: first.scheme ?? "IAS", accreditation_track: first.accreditationTrack, accreditation_hidden: first.accreditationHidden, application_type: first.applicationType, partner_name: first.partnerCompany, management_no: first.managementNo, job_no: first.jobNo, standard: first.standard, grade: first.grade });
        if (error) throw error;
        const bundle = readApplicationBundle(data, candidateMode === "EXISTING" ? existingCandidateId : undefined);
        const applicationId = bundle.application_id;
        records[0] = { ...records[0], id: applicationId, candidateId: bundle?.candidate_id, jobId: bundle?.job_id };
        if (ownerId) {
          const [{ data: savedApplication, error: applicationOwnerError }, { data: savedJob, error: jobOwnerError }] = await Promise.all([supabase.from("applications").update({ primary_owner_id: ownerId }).eq("id", applicationId).select("id, primary_owner_id").single(), supabase.from("jobs").update({ primary_owner_id: ownerId, previous_job_id: jobEntries[0]?.previousJobId || null }).eq("id", bundle.job_id).eq("application_id", applicationId).eq("candidate_id", bundle.candidate_id).select("id, primary_owner_id, previous_job_id").single()]);
          if (applicationOwnerError || jobOwnerError) throw applicationOwnerError ?? jobOwnerError;
          if (!hasExactRecordValues([savedApplication], [{ id: applicationId, primary_owner_id: ownerId }], ["id", "primary_owner_id"]) || !hasExactRecordValues([savedJob], [{ id: bundle.job_id, primary_owner_id: ownerId, previous_job_id: jobEntries[0]?.previousJobId || null }], ["id", "primary_owner_id", "previous_job_id"])) throw new Error("담당자·기존 인증 연결 저장 응답 미확인");
        }
        if (records.length > 1) {
          const extraRows = records.slice(1).map((record, index) => ({ application_id: applicationId, candidate_id: bundle?.candidate_id, previous_job_id: jobEntries[index + 1]?.previousJobId || null, job_no: record.jobNo, management_no: record.managementNo, business_area: record.businessArea, accreditation_track: record.accreditationTrack, standard: record.standard, grade: record.grade, primary_owner_id: ownerId ?? null }));
          const { data: extraJobs, error: jobsError } = await supabase.from("jobs").insert(extraRows).select("id, application_id, candidate_id, previous_job_id, job_no, management_no, business_area, accreditation_track, standard, grade, primary_owner_id");
          if (jobsError) throw jobsError;
          if (!hasUniqueRegistrationIds(extraJobs, [bundle.job_id]) || !hasExactRecordValues(extraJobs, extraRows, Object.keys(extraRows[0]))) throw new Error("추가 Job 저장 응답 미확인");
          const expectedCycles = extraJobs.map((job) => ({ job_id: job.id, sequence: 1, application_type: applicationType, status: "DOCUMENT_REVIEW", application_date: receivedAt }));
          const { data: savedCycles, error: cyclesError } = await supabase.from("processing_cycles").insert(expectedCycles).select("id, job_id, sequence, application_type, status, application_date");
          if (cyclesError) throw cyclesError;
          if (!hasUniqueRegistrationIds(savedCycles) || !hasExactRecordValues(savedCycles, expectedCycles, Object.keys(expectedCycles[0]))) throw new Error("처리 회차 저장 응답 미확인");
          const jobIdByNo = new Map((extraJobs ?? []).map((job) => [job.job_no, job.id]));
          records.splice(1, records.length - 1, ...records.slice(1).map((record) => ({ ...record, id: applicationId, candidateId: bundle?.candidate_id, jobId: jobIdByNo.get(record.jobNo) })));
          const managementEnd = records.at(-1)?.managementNo ?? first.managementNo;
          const { data: savedRange, error: rangeError } = await supabase.from("applications").update({ management_no_to: managementEnd }).eq("id", applicationId).select("id, management_no_to").single();
          if (rangeError) throw rangeError;
          if (!hasExactRecordValues([savedRange], [{ id: applicationId, management_no_to: managementEnd }], ["id", "management_no_to"])) throw new Error("관리번호 범위 저장 응답 미확인");
        }
        setStoredApplications((current) => [...records, ...current]);
        setStoredCount((count) => count + 1);
        setNotice(`${records[0].applicationNo} 신청과 Job ${records.length}건이 등록되었습니다. 관리 No. ${records[0].managementNo}${records.length > 1 ? `~${records.at(-1)?.managementNo}` : ""} · 최종 Job No.: ${records.map((record) => record.jobNo).join(", ")}${legacyManagement ? " · DB 변경 028 미적용: 기존 공통 관리번호를 사용했습니다." : ""}`);
        return;
      } catch {
        if (bundleAttempted) { registrationUncertain.current = true; setRegistrationNeedsReview(true); setRegistrationCheckNo(records[0].applicationNo); setRegistrationCheckCount(records.length); }
        setNotice(bundleAttempted ? `신청 ${records[0].applicationNo}의 저장 결과를 확인하지 못했습니다. 일부 자료가 저장됐을 수 있어 재등록을 중단합니다. 신청관리에서 후보자·Job·회차·담당자 연결을 확인해 주세요. 예약 번호는 재사용하지 않습니다.` : "신청 등록 전 인증 또는 번호 확보에 실패했습니다. 연결·권한·예약 번호 상태를 확인해 주세요.");
        return;
      } finally { registrationBusy.current = false; setSaving(false); }
    }
    try {
      records.slice().reverse().forEach(savePrototypeApplication);
      setStoredApplications((current) => [...records, ...current]);
      setStoredCount((count) => count + 1);
      setNotice(`${applicationNo} 신청과 Job ${records.length}건이 브라우저에 등록되었습니다.`);
    } catch { registrationUncertain.current = true; setRegistrationNeedsReview(true); setNotice("브라우저 저장 결과를 확인하지 못했습니다. 일부 기록이 남았을 수 있어 기존 신청 확인 전에는 재등록하지 않습니다."); }
    finally { registrationBusy.current = false; }
  }

  return <div className="max-w-5xl"><Link href="/applications" className="mb-4 inline-flex items-center gap-1 text-sm text-slate-500"><ArrowLeft className="h-4 w-4"/>신청 목록으로</Link>
    <form className="space-y-5">
      <section className="rounded-lg border border-blue-100 bg-blue-50 p-5"><Field label="주 담당자" required><select className={controlClass} value={primaryOwnerId} onChange={(event) => setPrimaryOwnerId(event.target.value)} disabled={!hasEnvVars}><option value="">담당자를 선택하세요</option>{staffOptions.map((staff) => <option key={staff.id} value={staff.id}>{staff.display_name} · {staff.role === "ADMIN" ? "관리자" : "실무자"}</option>)}{!hasEnvVars && <option value="local">김담당 · 프로토타입</option>}</select></Field><p className="mt-2 text-xs text-blue-800">주 담당자를 지정해도 활성 실무자는 모두 이 업무를 조회하고 처리할 수 있습니다.</p></section>
      <section className="rounded-lg border bg-white shadow-sm"><div className="border-b px-6 py-5"><h2 className="font-semibold">후보자 기본정보</h2><p className="mt-1 text-sm text-slate-500">기등록 후보자는 기존 정보에 신청과 Job만 추가되며 중복 후보자로 생성되지 않습니다.</p></div><div className="border-b px-6 py-4"><div className="inline-flex rounded-md border bg-slate-50 p-1"><button type="button" onClick={() => changeCandidateMode("NEW")} className={`rounded px-4 py-2 text-sm font-medium ${candidateMode === "NEW" ? "bg-white text-blue-800 shadow-sm" : "text-slate-500"}`}>신규 후보자</button><button type="button" onClick={() => changeCandidateMode("EXISTING")} className={`rounded px-4 py-2 text-sm font-medium ${candidateMode === "EXISTING" ? "bg-white text-blue-800 shadow-sm" : "text-slate-500"}`}>기등록 후보자</button></div></div>{candidateMode === "EXISTING" && <div className="border-b bg-blue-50 px-6 py-4"><Field label="기등록 후보자 선택" required><select className={controlClass} value={existingCandidateId} onChange={(event) => chooseExistingCandidate(event.target.value)}><option value="">후보자를 선택하세요</option>{candidateOptions.map((candidate) => <option key={candidate.id} value={candidate.id}>{candidate.name}{candidate.name_en ? ` (${candidate.name_en})` : ""}</option>)}</select></Field></div>}<div className="grid gap-5 p-6 sm:grid-cols-2"><Field label="후보자명" required><input className={controlClass} value={candidateName} onChange={(event) => setCandidateName(event.target.value)} disabled={candidateMode === "EXISTING"} placeholder="예: 홍길동"/></Field><Field label="영문명"><input className={controlClass} value={candidateNameEn} onChange={(event) => setCandidateNameEn(event.target.value)} disabled={candidateMode === "EXISTING"} placeholder="예: HONG GIL DONG"/></Field><Field label="생년월일"><input type="date" className={controlClass} value={candidateBirthDate} onChange={(event) => setCandidateBirthDate(event.target.value)} disabled={candidateMode === "EXISTING"}/></Field><Field label="국적"><input className={controlClass} value={candidateNationality} onChange={(event) => setCandidateNationality(event.target.value)} disabled={candidateMode === "EXISTING"} placeholder="예: 대한민국"/></Field><Field label="이메일"><input type="email" className={controlClass} value={candidateEmail} onChange={(event) => setCandidateEmail(event.target.value)} disabled={candidateMode === "EXISTING"} placeholder="name@example.com"/></Field><Field label="전화번호"><input type="tel" className={controlClass} value={candidatePhone} onChange={(event) => setCandidatePhone(event.target.value)} disabled={candidateMode === "EXISTING"} placeholder="010-0000-0000"/></Field></div>{candidateMode === "EXISTING" && <p className="mx-6 mb-6 rounded-md bg-slate-50 px-4 py-3 text-xs text-slate-600">후보자 정보 변경은 후보자 상세화면에서 변경 사유와 함께 처리합니다.</p>}</section>
      <section className="rounded-lg border bg-white shadow-sm"><div className="border-b px-6 py-5"><h2 className="font-semibold">접수 기본정보</h2><p className="mt-1 text-sm text-slate-500">최초 자료가 대표메일에 도착한 날짜를 접수일로 사용합니다.</p></div><div className="grid gap-5 p-6 sm:grid-cols-2"><Field label="공식 접수일" required><input type="date" className={controlClass} value={receivedAt} onChange={(event) => setReceivedAt(event.target.value)}/></Field><Field label="발행 분야" required><select className={controlClass} value={businessArea} onChange={(event) => { const value = event.target.value as BusinessArea; changeRuleContext(value, scheme, accreditationTrack); setGrade(value === "ISO" ? "Auditor" : "Pre-master"); }}><option value="ISO">ISO 경영시스템 심사원</option><option value="K_BEAUTY">K-Beauty 전문가 자격</option></select></Field><Field label="인정기구" required><select className={controlClass} value={scheme} onChange={(event) => changeRuleContext(businessArea, event.target.value as NumberingScheme, accreditationTrack)}><option value="IAS">IAS</option><option value="PJLA">PJLA</option></select></Field><Field label="인정 구분" required><div className="space-y-3"><select className={controlClass} value={accreditationTrack} onChange={(event) => { const value = event.target.value as "ACCREDITED" | "NON_ACCREDITED"; changeRuleContext(businessArea, scheme, value); if (value === "NON_ACCREDITED") setAccreditationHidden(false); }}><option value="ACCREDITED">인정</option><option value="NON_ACCREDITED">비인정</option></select>{accreditationTrack === "ACCREDITED" && <label className="flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950"><input type="checkbox" className="mt-0.5 h-4 w-4" checked={accreditationHidden} onChange={(event) => setAccreditationHidden(event.target.checked)}/><span><strong>인정 표시 숨김</strong><span className="mt-1 block text-xs text-amber-800">인정 고객으로 관리하되 외부 표시와 생성 문서에서는 인정 정보를 숨깁니다.</span></span></label>}</div></Field><Field label="신청구분" required><select className={controlClass} value={applicationType} onChange={(event) => changeApplicationType(event.target.value as ApplicationType)}><option>최초</option><option>갱신</option><option>등급변경</option><option>전환</option><option>기타</option></select></Field><Field label="파트너사"><select className={controlClass} value={partnerCompany} onChange={(event) => setPartnerCompany(event.target.value)}><option>직접접수</option>{partnerOptions.map((partner) => <option key={partner.id} value={partner.name}>{partner.name}</option>)}</select></Field></div>{accreditationTrack === "ACCREDITED" && accreditationHidden && <div className="mx-6 mb-6 rounded-md border border-amber-300 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">내부 분류: 인정 · 표시 방식: 숨김</div>}</section>
      <section className="rounded-lg border bg-white shadow-sm"><div className="flex items-center justify-between border-b px-6 py-5"><div><h2 className="font-semibold">신청 세부 분야</h2><p className="mt-1 text-sm text-slate-500">분야를 하나씩 추가하면 각 분야에 관리 No.와 Job No.가 독립적으로 부여됩니다.</p></div><span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-800">선택 {jobDrafts.length}건</span></div><div className="p-6"><div className="grid gap-4 rounded-lg border bg-slate-50 p-4 sm:grid-cols-[1fr_1fr_1fr_auto]"><Field label="추가할 세부 분야"><select className={controlClass} value={activeStandard} onChange={(event) => setStandard(event.target.value)}>{rules.map((rule) => <option key={rule.field} value={rule.field}>{rule.field}{rule.verified ? "" : " (확인 필요)"}</option>)}</select></Field><Field label="등급"><select className={controlClass} value={grade} onChange={(event) => setGrade(event.target.value)}>{businessArea === "ISO" ? <><option>Auditor</option><option>Lead Auditor</option><option>Provisional Auditor</option><option>Internal Auditor</option><option>Verification Auditor</option></> : <><option>Pre-master</option><option>Master</option><option>Global Master</option></>}</select></Field><Field label="예상 Job No."><input className={controlClass} value={jobNo || "규칙 확인 필요"} readOnly/></Field><div className="flex items-end"><Button type="button" variant="outline" className="w-full" onClick={addJob}><Plus/>분야 추가</Button></div></div>
        <div className="mt-4 grid gap-3 rounded-lg border border-blue-100 bg-blue-50 p-4 text-center sm:grid-cols-4"><div><p className="text-xs text-blue-700">Job 코드</p><p className="mt-1 font-semibold text-blue-950">{selectedRule?.jobPrefix ?? "-"}</p></div><div><p className="text-xs text-blue-700">접수연도 (YY)</p><p className="mt-1 font-semibold text-blue-950">{receivedAt.slice(2, 4) || "-"}</p></div><div><p className="text-xs text-blue-700">다음 순번 (NNNN)</p><p className="mt-1 font-semibold text-blue-950">{sequence || "-"}</p></div><div><p className="text-xs text-blue-700">인증번호 형식</p><p className="mt-1 font-semibold text-blue-950">{selectedRule?.certificatePattern ?? "-"}</p></div></div>
        <p className="mt-3 text-xs text-slate-500">근거 시트: {selectedRule?.sourceSheet ?? "-"} · G는 등급 코드입니다. {selectedRule && !selectedRule.verified && "현재 시트에서 번호 예시를 확정하지 못해 자동 부여를 차단했습니다."}</p>
        <div className="mt-5 overflow-hidden rounded-lg border"><div className="border-b bg-slate-50 px-4 py-3 text-sm font-semibold">등록할 Job 목록</div>{jobEntries.length === 0 ? <p className="px-4 py-8 text-center text-sm text-slate-500">세부 분야를 한 개 이상 추가해 주세요.</p> : <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3 text-left">관리 No.</th><th className="px-4 py-3 text-left">세부 분야</th><th className="px-4 py-3 text-left">등급</th><th className="px-4 py-3 text-left">Job No.</th><th className="px-4 py-3 text-right">삭제</th></tr></thead><tbody className="divide-y">{jobEntries.map((entry) => <tr key={entry.id}><td className="px-4 py-3 font-semibold">{entry.managementNo}</td><td className="px-4 py-3">{entry.standard}</td><td className="px-4 py-3">{entry.grade}</td><td className="px-4 py-3 font-medium text-blue-800">{entry.jobNo}</td><td className="px-4 py-3 text-right"><Button type="button" size="sm" variant="outline" onClick={() => setJobDrafts((current) => current.filter((item) => item.id !== entry.id))}><Trash2/>삭제</Button></td></tr>)}</tbody></table></div>}</div>
      </div></section>
      {(applicationType === "갱신" || applicationType === "등급변경") && <section className="rounded-lg border border-amber-200 bg-amber-50 shadow-sm"><div className="border-b border-amber-200 px-6 py-5"><h2 className="font-semibold text-amber-950">기존 완료 인증 연결</h2><p className="mt-1 text-sm text-amber-800">각 신규 Job과 같은 분야의 기존 완료 인증을 연결해야 등록할 수 있습니다.</p></div><div className="space-y-3 p-6">{jobEntries.length === 0 && <p className="text-sm text-amber-800">먼저 신청 세부 분야를 추가해 주세요.</p>}{jobEntries.map((entry) => { const options = previousJobs.filter((item) => item.standard === entry.standard); return <Field key={entry.id} label={`${entry.standard} · ${entry.grade}`} required><select className={controlClass} value={entry.previousJobId} onChange={(event) => setJobDrafts((current) => current.map((item) => item.id === entry.id ? { ...item, previousJobId: event.target.value } : item))}><option value="">완료된 기존 인증 선택</option>{options.map((item) => <option key={item.id} value={item.id}>{item.jobNo} · 인증번호 {item.certificationNo} · {item.grade} · {item.issueDate}</option>)}</select>{options.length === 0 && <p className="mt-1 text-xs text-rose-700">이 후보자에게 연결 가능한 완료 인증이 없습니다.</p>}</Field>; })}</div></section>}
      <section className="rounded-lg border border-blue-100 bg-blue-50 p-5"><div className="flex items-start gap-3"><FolderPlus className="mt-0.5 h-5 w-5 text-blue-800"/><div className="min-w-0 flex-1"><p className="font-semibold text-blue-950">권장 Dropbox 폴더명</p><p className="mt-2 break-words rounded-md bg-white px-4 py-3 font-mono text-sm text-slate-800">{jobEntries.length ? `${jobEntries[0].managementNo}${jobEntries.length > 1 ? `~${jobEntries.at(-1)?.managementNo}` : ""} ${candidateName.trim() || "후보자명"} (${jobEntries.map((item) => `${item.grade} ${item.standard}`).join(", ")} ${applicationType})` : "세부 분야를 추가하면 폴더명이 생성됩니다."}</p><p className="mt-2 text-xs text-blue-700">여러 Job을 동시에 신청한 경우에도 신청자료는 하나의 공통 폴더에 보관합니다.</p></div></div></section>
      {notice && <div role={registrationNeedsReview ? "alert" : "status"} className={`flex flex-wrap items-center gap-2 rounded-lg border px-4 py-3 text-sm font-medium ${registrationNeedsReview ? "border-amber-300 bg-amber-50 text-amber-950" : "bg-card text-foreground"}`}>{notice.includes("등록되었습니다") && <CheckCircle2 className="h-4 w-4"/>}{notice}{(notice.includes("등록되었습니다") || registrationNeedsReview) && <Link href={registrationNeedsReview && registrationCheckNo ? `/applications?check=${encodeURIComponent(registrationCheckNo)}&checkCount=${registrationCheckCount}` : "/applications"} className="ml-auto underline">{registrationNeedsReview ? "신청관리에서 기존 기록 확인" : "목록에서 확인"}</Link>}</div>}
      <div className="flex justify-end gap-2"><Button variant="outline" asChild><Link href="/applications">취소</Link></Button><Button type="button" disabled={saving || registrationNeedsReview} className="bg-blue-800 hover:bg-blue-900" onClick={registerApplication}><Save/>{saving ? "DB 저장 중..." : "번호 확정 및 신청 등록"}</Button></div>
    </form>
  </div>;
}
