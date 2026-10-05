"use client";
import { packageDateDifferences } from "@/lib/package-date-consistency";
import { certificateDateIssues } from "@/lib/package-request-validation";
import { downloadDeliveryConfirmationDraftDocx } from "@/lib/prototype-package";

import Link from "next/link";
import { corporateTemplateRegistry } from "@/lib/document-template-registry";
import { documentTranslationIssues, documentTranslationMessage } from "@/lib/document-translation-checks";
import { useEffect, useMemo, useRef, useState } from "react";
import { DocumentDownloadButton } from "@/components/document-download-button";
import { PackageTemplateReadiness } from "@/components/package-template-readiness";
import { canAttachPackageGeneration } from "@/lib/package-completion-policy";
import { confirmPackageReadiness, isTemplateReadinessRows } from "@/lib/template-readiness";
import { documentErrorMessage } from "@/lib/document-errors";
import { packageDocumentIssues } from "@/lib/package-document-checks";
import { Check, Copy, Download, FileArchive, FileText, FolderOpen, PackageCheck, Printer, RotateCcw, Save } from "lucide-react";
import type { Candidate, CertificationApplication, Invoice, Job } from "@/types/certification";
import { accreditationLabels, businessAreaLabels } from "@/data/workflow-data";
import { ApplicationStatusBadge } from "@/components/application-status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, controlClass, textareaClass } from "@/components/form-fields";
import { buildDocuments, deliveryDocumentRows, downloadApplicationReviewDocx, downloadCorporatePackageZip, downloadDecisionReportDocx, downloadDeliveryConfirmationDocx, printAsPdf, type AssessmentResult, type DeliveryDocumentKey, type DemoAssessment, type DemoCertificate, type DemoDecision, type DemoDeliveryDocuments, type DemoEnglishText, type DemoPanelMember, type DemoReview, type DocumentApplicability, type DocumentLanguage } from "@/lib/prototype-package";
import { getCertificationNumber, getCertificationNumberPrefix } from "@/lib/certification-number";
import { defaultApplicability, profileKey, readStoredProfiles } from "@/lib/document-requirement-rules";
import { addKoreanBusinessDays, nextKoreanBusinessDay } from "@/lib/business-days";
import { jobs as allJobs } from "@/data/mock-data";
import { readTrainingInstitutions, type TrainingInstitution } from "@/lib/training-institutions";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";
import { SupabaseAuditTrail } from "@/components/supabase-audit-trail";
import type { PackageGenerationReceipt } from "@/lib/package-generation";
import { PackageGenerationHistory } from "@/components/package-generation-history";

const tabs = ["신청 개요", "자료보관", "서류검토", "인보이스·입금", "인증심의", "Job·패키지", "처리이력"] as const;
type Tab = (typeof tabs)[number];
const tabSlugs: Record<Tab, string> = { "신청 개요": "overview", "자료보관": "storage", "서류검토": "review", "인보이스·입금": "invoice", "인증심의": "decision", "Job·패키지": "package", "처리이력": "history" };
const tabsBySlug = Object.fromEntries(Object.entries(tabSlugs).map(([tab, slug]) => [slug, tab])) as Record<string, Tab>;
type DemoStage = "DOCUMENT_REVIEW" | "INVOICE_PENDING" | "PAYMENT_PENDING" | "DECISION_PENDING" | "CERTIFICATE_DRAFT_PENDING" | "CERTIFICATION_INFO_PENDING" | "ORIGINAL_DELIVERY_PENDING" | "PACKAGE_READY" | "COMPLETED";
type DateAuditLog = { id: string; category: "처리" | "정정"; jobId: string; field: string; before: string; after: string; reason: string; actor: string; occurredAt: string };
type TrainingProviderType = "PARTNER" | "NON_PARTNER";
type ExamSchedule = Record<string, { providerType: TrainingProviderType; providerName: string; trainingEndDate: string; examNoticeDate: string; examDate: string }>;
type RequirementResult = "충족" | "미충족" | "해당없음";
type DateRules = { decisionDays: number; deliveryDays: number };
type EditLockState = "LOCAL" | "CHECKING" | "OWNED" | "READ_ONLY";
type DemoState = { stage: DemoStage; storedDocuments: Record<string, boolean>; reviewRequirements: Record<string, RequirementResult>; review: DemoReview; invoiceNo: string; invoiceAmount: string; invoiceRecipientType: "개인" | "파트너사"; invoiceRecipientName: string; invoiceIssuedAt: string; paidAmount: string; payerName: string; paymentConfirmedAt: string; paymentConfirmedBy: string; examSchedules: ExamSchedule; assessment: DemoAssessment; panelMembers: DemoPanelMember[]; decisionDate: string; dateOverrideReasons: { decision: string; delivery: Record<string, string> }; dateAuditLogs: DateAuditLog[]; finalApprover: string; finalApprovalDate: string; decisions: DemoDecision; certificates: DemoCertificate; deliveryDocuments: DemoDeliveryDocuments; englishText: DemoEnglishText; generated: boolean; packageGeneration?: PackageGenerationReceipt };

const assessmentItems = ["지식 시험", "인성 시험", "교육 요구사항", "학력 요구사항", "심사이력"] as const;
const panelRoster = ["박심의", "이위원", "최위원"];
const storageDocumentItems = ["신청서", "계약서", "교육 증빙", "학력 증빙", "업무경력 증빙", "심사·실무경력 증빙"] as const;
const reviewRequirementItems = ["교육요건", "학력요건", "업무경력요건", "심사·실무경력요건"] as const;

const stageOrder: DemoStage[] = ["DOCUMENT_REVIEW", "INVOICE_PENDING", "PAYMENT_PENDING", "DECISION_PENDING", "CERTIFICATE_DRAFT_PENDING", "CERTIFICATION_INFO_PENDING", "ORIGINAL_DELIVERY_PENDING", "PACKAGE_READY", "COMPLETED"];
const stageLabels: Record<DemoStage, string> = { DOCUMENT_REVIEW: "서류검토", INVOICE_PENDING: "인보이스", PAYMENT_PENDING: "입금 확인", DECISION_PENDING: "인증심의", CERTIFICATE_DRAFT_PENDING: "초안 발행", CERTIFICATION_INFO_PENDING: "전자본 발행", ORIGINAL_DELIVERY_PENDING: "원본 송부", PACKAGE_READY: "패키지", COMPLETED: "완료" };

function escapeRegExp(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"); }

function officialApplicationStatus(stage: DemoStage) {
  if (["DOCUMENT_REVIEW", "INVOICE_PENDING", "PAYMENT_PENDING", "DECISION_PENDING", "COMPLETED"].includes(stage)) return stage;
  return "PARTIALLY_COMPLETED";
}

function officialCycleStatus(stage: DemoStage) {
  if (stage === "ORIGINAL_DELIVERY_PENDING" || stage === "PACKAGE_READY") return "DELIVERY_PENDING";
  return stage;
}

function makeInitial(application: CertificationApplication, jobs: Job[]): DemoState {
  const isLeeRenewal = application.id === "app-003";
  return {
    stage: isLeeRenewal ? (application.packageStatus === "GENERATED" ? "COMPLETED" : "PACKAGE_READY") : application.id === "app-001" ? "DOCUMENT_REVIEW" : application.status === "COMPLETED" ? "COMPLETED" : "DOCUMENT_REVIEW",
    storedDocuments: Object.fromEntries(storageDocumentItems.map((item) => [item, true])),
    reviewRequirements: Object.fromEntries(reviewRequirementItems.map((item) => [item, "충족" as RequirementResult])),
    review: { result: "적합", reviewer: application.primaryOwner, reviewedAt: isLeeRenewal ? "2026-08-15" : "2026-09-12", comment: isLeeRenewal ? "갱신 신청 제출자료 및 자격유지 요건을 확인함." : "제출자료 및 자격요건 관련 기록을 확인함.", verifier: isLeeRenewal ? "오검증" : "", verifiedAt: isLeeRenewal ? "2026-08-16" : "2026-09-12", verificationResult: "확인", verificationComment: isLeeRenewal ? "검토내용 및 제출 증빙을 확인함." : "" },
    invoiceNo: `INV-DEMO-${application.managementNoFrom}`,
    invoiceAmount: String(jobs.length * 450000),
    invoiceRecipientType: application.partnerCompany === "직접접수" ? "개인" : "파트너사",
    invoiceRecipientName: application.partnerCompany === "직접접수" ? "후보자 본인" : application.partnerCompany,
    invoiceIssuedAt: isLeeRenewal ? "2026-08-18" : "2026-09-12",
    paidAmount: isLeeRenewal ? String(jobs.length * 450000) : "",
    payerName: isLeeRenewal ? "이영희" : "",
    paymentConfirmedAt: isLeeRenewal ? "2026-08-19" : "",
    paymentConfirmedBy: isLeeRenewal ? application.primaryOwner : "",
    examSchedules: Object.fromEntries(jobs.map((job) => [job.id, { providerType: "NON_PARTNER", providerName: "외부 교육기관", trainingEndDate: "", examNoticeDate: "", examDate: "" }])),
    assessment: Object.fromEntries(jobs.map((job) => [job.id, Object.fromEntries(assessmentItems.map((item) => [item, isLeeRenewal ? "적합" : ""]))])),
    panelMembers: panelRoster.map((name, index) => ({ name, selected: isLeeRenewal && index < 2, decision: isLeeRenewal && index < 2 ? "재승인" : "", comment: isLeeRenewal && index < 2 ? "갱신요건 충족 확인" : "" })),
    decisionDate: isLeeRenewal ? "2026-08-24" : "2026-09-14",
    dateOverrideReasons: { decision: "", delivery: Object.fromEntries(jobs.map((job) => [job.id, ""])) },
    dateAuditLogs: isLeeRenewal ? [
      { id: "seed-review", category: "처리", jobId: jobs[0]?.id ?? "", field: "서류검토", before: "서류검토", after: "인보이스", reason: "1·2차 서류검토 완료", actor: application.primaryOwner, occurredAt: "2026. 8. 16. 10:20" },
      { id: "seed-decision", category: "처리", jobId: jobs[0]?.id ?? "", field: "인증심의", before: "인증심의", after: "초안 발행", reason: "패널 심의 및 대표자 최종 승인", actor: application.primaryOwner, occurredAt: "2026. 8. 24. 14:10" },
    ] : [],
    finalApprover: "대표자",
    finalApprovalDate: isLeeRenewal ? "2026-08-22" : "2026-09-12",
    decisions: Object.fromEntries(jobs.map((job) => [job.id, { result: isLeeRenewal ? "재승인" : "", comment: isLeeRenewal ? "갱신 재승인" : "" }])),
    certificates: Object.fromEntries(jobs.map((job) => { const issueDate = isLeeRenewal ? "2026-08-31" : "2026-09-14"; return [job.id, { certificationNo: getCertificationNumber(job.standard, job.currentGrade, issueDate, allJobs), draftIssuedAt: isLeeRenewal ? "2026-08-24" : "", issueDate: isLeeRenewal ? issueDate : "", expiryDate: isLeeRenewal ? "2029-08-28" : "", originalSentAt: isLeeRenewal ? issueDate : "", trackingNumber: isLeeRenewal ? "DEMO-45001-0829" : "" }]; })),
    deliveryDocuments: Object.fromEntries(jobs.map((job) => [job.id, Object.fromEntries(deliveryDocumentRows.map(({ key }) => {
      const date = ["application", "career", "education", "diploma", "auditLog", "agreement"].includes(key) ? (isLeeRenewal ? "2026-08-18" : application.receivedAt) : key === "decisionReport" ? (isLeeRenewal ? "2026-08-24" : "") : key === "certificate" ? (isLeeRenewal ? "2026-08-31" : "") : key === "deliveryConfirmation" ? (isLeeRenewal ? "2026-09-01" : "") : "";
      const applicability = defaultApplicability(job.businessArea ?? application.businessArea, key);
      return [key, { applicability, received: Boolean(date), date, comment: "" }];
    }))])) as DemoDeliveryDocuments,
    englishText: { reviewComment: isLeeRenewal ? "Renewal application documents and continued certification requirements were verified." : "", verificationComment: isLeeRenewal ? "The review and supporting evidence were verified." : "", panelComments: Object.fromEntries(panelRoster.map((name, index) => [name, isLeeRenewal && index < 2 ? "Renewal requirements verified." : ""])), decisionComments: Object.fromEntries(jobs.map((job) => [job.id, isLeeRenewal ? "Renewal reapproved." : ""])) },
    generated: application.packageStatus === "GENERATED",
  };
}

export function ApplicationDetail({ application, candidate, linkedJobs, invoices }: { application: CertificationApplication; candidate: Candidate; linkedJobs: Job[]; invoices: Invoice[] }) {
  const [active, setActive] = useState<Tab>("신청 개요");
  const [demo, setDemo] = useState(() => makeInitial(application, linkedJobs));
  const [languages, setLanguages] = useState<Record<DocumentLanguage, boolean>>({ KR: true, EN: false });
  const [generating, setGenerating] = useState(false);
  const generationBusy = useRef(false);
  const [notice, setNotice] = useState("서류검토 탭에서 샘플 업무를 시작하세요.");
  const [trainingInstitutions, setTrainingInstitutions] = useState<TrainingInstitution[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [workspaceLoadError, setWorkspaceLoadError] = useState("");
  const [workspaceLoadRevision, setWorkspaceLoadRevision] = useState(0);
  const [lastSavedAt, setLastSavedAt] = useState("");
  const [correctionTarget, setCorrectionTarget] = useState("review.result");
  const [correctionValue, setCorrectionValue] = useState("");
  const [correctionReason, setCorrectionReason] = useState("");
  const [dateRules, setDateRules] = useState<DateRules>({ decisionDays: 5, deliveryDays: 1 });
  const [cycleIds, setCycleIds] = useState<Record<string, string>>({});
  const [panelMemberIds, setPanelMemberIds] = useState<Record<string, string>>({});
  const storageKey = `certification-demo:v4:${application.id}`;
  const usesSupabaseWorkspace = Boolean(hasEnvVars && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(application.id));
  const [editLock, setEditLock] = useState<EditLockState>(usesSupabaseWorkspace ? "CHECKING" : "LOCAL");
  const [lockOwner, setLockOwner] = useState("");
  const canEdit = hydrated && (editLock === "LOCAL" || editLock === "OWNED");

  useEffect(() => {
    if (!usesSupabaseWorkspace) { setEditLock("LOCAL"); return; }
    const supabase = createClient();
    let active = true;
    const acquire = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!active) return;
      if (!user) { setEditLock("READ_ONLY"); setLockOwner("로그인하지 않은 사용자"); return; }
      const { data, error } = await supabase.rpc("acquire_record_lock", { target_type: "application", target_id: application.id, lock_minutes: 15 });
      if (!active) return;
      if (!error && data) { setEditLock("OWNED"); setLockOwner(""); return; }
      const { data: lock } = await supabase.from("record_locks").select("locked_by").eq("resource_type", "application").eq("resource_id", application.id).maybeSingle();
      let owner = "다른 직원";
      if (lock?.locked_by) {
        const { data: profile } = await supabase.from("profiles").select("display_name").eq("id", lock.locked_by).maybeSingle();
        owner = profile?.display_name || owner;
      }
      if (active) { setEditLock("READ_ONLY"); setLockOwner(owner); }
    };
    void acquire();
    const renewal = window.setInterval(() => void acquire(), 10 * 60 * 1000);
    return () => {
      active = false;
      window.clearInterval(renewal);
      void supabase.from("record_locks").delete().eq("resource_type", "application").eq("resource_id", application.id);
    };
  }, [application.id, usesSupabaseWorkspace]);

  useEffect(() => {
    let cancelled = false;
    setHydrated(false); setWorkspaceLoadError(""); setLastSavedAt("");
    if (usesSupabaseWorkspace) {
      const load = async () => {
        try {
          const { data, error } = await createClient().from("application_workspaces").select("state").eq("application_id", application.id).maybeSingle();
          if (cancelled) return;
          if (error) throw new Error("업무기록 조회 실패");
          if (data && (!data.state || typeof data.state !== "object" || Array.isArray(data.state))) throw new Error("업무기록 형식 확인 필요");
          const initial = makeInitial(application, linkedJobs);
          setDemo(data?.state ? { ...initial, ...(data.state as Partial<DemoState>) } : initial);
          setLastSavedAt(data?.state ? "Supabase 저장 내용을 불러왔습니다." : "새 공유 업무기록입니다.");
          setHydrated(true);
        } catch {
          if (!cancelled) { setHydrated(false); setWorkspaceLoadError("저장된 공유 업무기록을 읽지 못했습니다. 기존 기록 보호를 위해 편집·저장을 중단했습니다. 다시 조회해 주세요."); }
        }
      };
      void load();
      return () => { cancelled = true; };
    }
    try { const stored = window.localStorage.getItem(storageKey); if (stored) { const initial = makeInitial(application, linkedJobs); const saved = JSON.parse(stored) as Partial<DemoState>; const certificates = Object.fromEntries(linkedJobs.map((job) => [job.id, { ...initial.certificates[job.id], ...saved.certificates?.[job.id] }])); const deliveryDocuments = Object.fromEntries(linkedJobs.map((job) => [job.id, { ...initial.deliveryDocuments[job.id], ...saved.deliveryDocuments?.[job.id], education: { ...initial.deliveryDocuments[job.id].education, ...saved.deliveryDocuments?.[job.id]?.education, applicability: "REQUIRED" as DocumentApplicability } }])) as DemoDeliveryDocuments; const dateAuditLogs = (saved.dateAuditLogs ?? initial.dateAuditLogs).map((log) => ({ ...log, category: log.category ?? "정정" as const })); setDemo({ ...initial, ...saved, storedDocuments: { ...initial.storedDocuments, ...saved.storedDocuments }, reviewRequirements: { ...initial.reviewRequirements, ...saved.reviewRequirements }, review: { ...initial.review, ...saved.review }, englishText: { ...initial.englishText, ...saved.englishText }, examSchedules: { ...initial.examSchedules, ...saved.examSchedules }, assessment: saved.assessment ?? initial.assessment, panelMembers: saved.panelMembers ?? initial.panelMembers, certificates, deliveryDocuments, dateAuditLogs }); setLastSavedAt("저장된 내용을 불러왔습니다."); } else { const profiles = readStoredProfiles(); if (profiles.length) setDemo((current) => ({ ...current, deliveryDocuments: Object.fromEntries(linkedJobs.map((job) => { const profile = profiles.find((item) => profileKey(item) === profileKey({ businessArea: job.businessArea ?? application.businessArea, standard: job.standard, grade: job.currentGrade })); return [job.id, Object.fromEntries(deliveryDocumentRows.map(({ key }) => [key, { ...current.deliveryDocuments[job.id][key], applicability: key === "education" ? "REQUIRED" : profile?.rules[key] ?? current.deliveryDocuments[job.id][key].applicability }]))]; })) as DemoDeliveryDocuments })); } } catch { setWorkspaceLoadError("브라우저 업무기록을 읽지 못했습니다. 원본 확인 전에는 편집·저장하지 않습니다."); return; } setHydrated(true); return () => { cancelled = true; }; }, [application, linkedJobs, storageKey, usesSupabaseWorkspace, workspaceLoadRevision]);
  useEffect(() => { if (!hydrated || (usesSupabaseWorkspace && editLock !== "OWNED")) return; if (usesSupabaseWorkspace) { const timeout = window.setTimeout(() => { const supabase = createClient(); void supabase.from("application_workspaces").upsert({ application_id: application.id, state: demo }, { onConflict: "application_id" }).then(({ error }) => { if (error) setNotice(`공유 저장에 실패했습니다: ${error.message}`); }); }, 800); return () => window.clearTimeout(timeout); } try { window.localStorage.setItem(storageKey, JSON.stringify(demo)); } catch { setNotice("브라우저 저장공간에 기록하지 못했습니다."); } }, [application.id, demo, editLock, hydrated, storageKey, usesSupabaseWorkspace]);
  useEffect(() => {
    if (!hydrated || !usesSupabaseWorkspace || editLock !== "OWNED") return;
    const supabase = createClient();
    const sync = async () => {
      const packageStatus = demo.stage === "COMPLETED" && demo.generated ? "GENERATED" : demo.stage === "PACKAGE_READY" ? "READY" : "NOT_READY";
      const { error: applicationError } = await supabase.from("applications").update({ status: officialApplicationStatus(demo.stage), package_status: packageStatus }).eq("id", application.id);
      const jobIds = linkedJobs.map((job) => job.id);
      const { error: cycleError } = jobIds.length ? await supabase.from("processing_cycles").update({ status: officialCycleStatus(demo.stage), completed_at: demo.stage === "COMPLETED" ? new Date().toISOString() : null }).in("job_id", jobIds) : { error: null };
      const issued = linkedJobs.filter((job) => demo.certificates[job.id]?.issueDate).map((job) => job.id);
      const { error: jobError } = issued.length && ["ORIGINAL_DELIVERY_PENDING", "PACKAGE_READY", "COMPLETED"].includes(demo.stage) ? await supabase.from("jobs").update({ certification_state: "ACTIVE" }).in("id", issued) : { error: null };
      const error = applicationError ?? cycleError ?? jobError;
      if (error) setNotice(`공식 업무상태 동기화에 실패했습니다: ${error.message}`);
    };
    void sync();
  }, [application.id, demo.certificates, demo.generated, demo.stage, editLock, hydrated, linkedJobs, usesSupabaseWorkspace]);
  useEffect(() => {
    const requested = new URLSearchParams(window.location.search).get("tab");
    if (requested && tabsBySlug[requested]) setActive(tabsBySlug[requested]);
  }, []);
  useEffect(() => {
    setTrainingInstitutions(readTrainingInstitutions());
    if (!hasEnvVars) return;
    const supabase = createClient();
    void supabase.from("training_institutions").select("*").order("name").then(({ data }) => {
      if (!data) return;
      setTrainingInstitutions(data.map((item) => ({ id: item.id, name: item.name, designationNo: item.designation_no, validFrom: item.valid_from, validUntil: item.valid_until, standards: item.standards ?? [], active: item.active })));
    });
  }, []);
  useEffect(() => {
    if (!hasEnvVars || !hydrated) return;
    const supabase = createClient();
    void supabase.from("panel_members").select("id, name").eq("active", true).order("name").then(({ data }) => {
      if (!data?.length) return;
      const activeNames = data.map((item) => item.name);
      setPanelMemberIds(Object.fromEntries(data.map((item) => [item.name, item.id])));
      setDemo((current) => {
        const existing = new Map(current.panelMembers.map((member) => [member.name, member]));
        const panelMembers = [...activeNames.map((name) => existing.get(name) ?? { name, selected: false, decision: "" as const, comment: "" }), ...current.panelMembers.filter((member) => member.selected && !activeNames.includes(member.name))];
        const panelComments = { ...current.englishText.panelComments, ...Object.fromEntries(activeNames.map((name) => [name, current.englishText.panelComments[name] ?? ""])) };
        return { ...current, panelMembers, englishText: { ...current.englishText, panelComments } };
      });
    });
  }, [hydrated]);
  useEffect(() => {
    if (!hasEnvVars) return;
    const supabase = createClient();
    void supabase.from("system_settings").select("value").eq("key", "workflow_rules").maybeSingle().then(({ data }) => {
      const value = data?.value as { decisionDays?: string | number; deliveryDays?: string | number } | undefined;
      if (!value) return;
      setDateRules({ decisionDays: Math.max(0, Number(value.decisionDays ?? 5)), deliveryDays: Math.max(0, Number(value.deliveryDays ?? 1)) });
    });
  }, []);
  useEffect(() => {
    if (!usesSupabaseWorkspace || linkedJobs.length === 0) return;
    const supabase = createClient();
    void supabase.from("processing_cycles").select("id, job_id, sequence").in("job_id", linkedJobs.map((job) => job.id)).order("sequence", { ascending: false }).then(({ data }) => {
      if (!data) return;
      const latest: Record<string, string> = {};
      for (const row of data) if (!latest[row.job_id]) latest[row.job_id] = row.id;
      setCycleIds(latest);
    });
  }, [linkedJobs, usesSupabaseWorkspace]);
  useEffect(() => { setDemo((current) => { let changed = false; const examSchedules = { ...current.examSchedules }; const deliveryDocuments = { ...current.deliveryDocuments }; for (const job of linkedJobs) { const schedule = examSchedules[job.id]; if (!schedule || schedule.examNoticeDate || schedule.examDate) continue; const examNoticeDate = addKoreanBusinessDays(application.receivedAt, -10); const examDate = addKoreanBusinessDays(application.receivedAt, -5); examSchedules[job.id] = { ...schedule, examNoticeDate, examDate }; deliveryDocuments[job.id] = { ...deliveryDocuments[job.id], examNotice: { ...deliveryDocuments[job.id].examNotice, received: true, date: examNoticeDate }, examAnswers: { ...deliveryDocuments[job.id].examAnswers, received: true, date: examDate } }; changed = true; } return changed ? { ...current, examSchedules, deliveryDocuments } : current; }); }, [application.receivedAt, linkedJobs]);
  useEffect(() => { setDemo((current) => { const normalize = (value: string) => value ? nextKoreanBusinessDay(value) : value; const review = { ...current.review, reviewedAt: normalize(current.review.reviewedAt), verifiedAt: normalize(current.review.verifiedAt) }; const certificates = Object.fromEntries(Object.entries(current.certificates).map(([jobId, item]) => [jobId, { ...item, draftIssuedAt: normalize(item.draftIssuedAt), issueDate: normalize(item.issueDate), expiryDate: normalize(item.expiryDate), originalSentAt: normalize(item.originalSentAt) }])); const deliveryDocuments = Object.fromEntries(Object.entries(current.deliveryDocuments).map(([jobId, rows]) => [jobId, Object.fromEntries(Object.entries(rows).map(([key, item]) => [key, { ...item, date: key === "examNotice" || key === "examAnswers" ? item.date : normalize(item.date) }]))])); const next = { ...current, review, invoiceIssuedAt: normalize(current.invoiceIssuedAt), paymentConfirmedAt: normalize(current.paymentConfirmedAt), decisionDate: normalize(current.decisionDate), finalApprovalDate: normalize(current.finalApprovalDate), certificates, deliveryDocuments } as DemoState; return JSON.stringify(next) === JSON.stringify(current) ? current : next; }); }, [demo]);

  const packageContext = useMemo(() => ({ application, candidate, jobs: linkedJobs, reviewRequirements: demo.reviewRequirements, review: demo.review, invoiceNo: demo.invoiceNo, invoiceAmount: demo.invoiceAmount, invoiceIssuedAt: demo.invoiceIssuedAt, paidAmount: demo.paidAmount, paymentConfirmedAt: demo.paymentConfirmedAt, assessment: demo.assessment, panelMembers: demo.panelMembers, decisions: demo.decisions, certificates: demo.certificates, deliveryDocuments: demo.deliveryDocuments, examSchedules: demo.examSchedules, decisionDate: demo.decisionDate, finalApprover: demo.finalApprover, finalApprovalDate: demo.finalApprovalDate, englishText: demo.englishText }), [application, candidate, linkedJobs, demo]);
  const latestPackageContext = useRef(packageContext);
  useEffect(() => { latestPackageContext.current = packageContext; }, [packageContext]);
  const currentIndex = stageOrder.indexOf(demo.stage);
  const saveDraft = async () => { if (!canEdit) { setNotice("다른 직원이 편집 중이므로 현재 화면은 조회 전용입니다."); return; } try { if (usesSupabaseWorkspace) { const supabase = createClient(); const { error } = await supabase.from("application_workspaces").upsert({ application_id: application.id, state: demo }, { onConflict: "application_id" }); if (error) throw error; } else window.localStorage.setItem(storageKey, JSON.stringify(demo)); const savedAt = new Date().toLocaleTimeString("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit" }); setLastSavedAt(`${savedAt} 저장 완료`); setNotice(usesSupabaseWorkspace ? "공유 업무 입력값을 Supabase에 저장했습니다." : "현재 화면의 업무 입력값을 저장했습니다."); } catch (error) { setNotice(`업무기록을 저장하지 못했습니다: ${error instanceof Error ? error.message : "알 수 없는 오류"}`); } };
  const move = (stage: DemoStage, tab: Tab, message: string) => { setDemo((current) => ({ ...current, stage, dateAuditLogs: [...current.dateAuditLogs, createAuditLog("처리", "", "업무 단계", stageLabels[current.stage], stageLabels[stage], message, application.primaryOwner)] })); setActive(tab); setNotice(message); };
  const reset = () => { setDemo(makeInitial(application, linkedJobs)); window.localStorage.removeItem(storageKey); setActive("서류검토"); setNotice("샘플 진행상태를 처음으로 되돌렸습니다."); };
  const allocateCertificationNo = async (job: Job) => {
    const issueDate = demo.certificates[job.id]?.issueDate;
    if (!issueDate) { setNotice("인증번호를 부여하기 전에 전자본 발행일을 입력해 주세요."); return; }
    if (!usesSupabaseWorkspace) { setNotice("공유 DB 신청에서만 인증번호 순번을 확정할 수 있습니다."); return; }
    const scheme = application.scheme ?? "IAS";
    const area = job.businessArea ?? application.businessArea;
    const track = job.accreditationTrack ?? application.accreditationTrack;
    const prefix = getCertificationNumberPrefix(area, scheme, track, job.standard, job.currentGrade, issueDate);
    if (!prefix) { setNotice(`${job.standard} · ${job.currentGrade}의 인증번호 규칙이 확정되지 않았습니다.`); return; }
    const scope = `${area}:${scheme}:${track}:${job.standard}:${job.currentGrade}:${issueDate.slice(0, 4)}`;
    const { data, error } = await createClient().rpc("allocate_certification_number", { p_number_prefix: prefix, p_sequence_scope: scope });
    if (error || !data) { setNotice(`인증번호를 부여하지 못했습니다: ${error?.message ?? "번호 없음"}`); return; }
    changeCertificate(job.id, "certificationNo", String(data), dateRules, setDemo);
    setNotice(`${job.jobNo} 인증번호 ${String(data)}을(를) 확정했습니다. 예약된 번호는 재사용되지 않습니다.`);
  };

  const finishReview = async () => {
    if (!demo.review.reviewer || !demo.review.reviewedAt) { setNotice("1차 검토자와 검토일을 입력해 주세요."); return; }
    if (!demo.review.verifier || !demo.review.verifiedAt) { setNotice("2차 검증인과 검증일을 입력해 주세요."); return; }
    if (demo.review.verificationResult === "재검토요청") { setNotice("검증인이 재검토를 요청했습니다. 검토내용을 보완한 뒤 다시 검증해 주세요."); return; }
    if (usesSupabaseWorkspace) {
      if (linkedJobs.some((job) => !cycleIds[job.id])) { setNotice("Job 처리 회차를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요."); return; }
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const rows = linkedJobs.map((job) => ({ cycle_id: cycleIds[job.id], round: 1, stored_documents: demo.storedDocuments, requirements: demo.reviewRequirements, overall_result: demo.review.result, comment: demo.review.comment, reviewer_id: userData.user?.id ?? null, reviewer_name_snapshot: demo.review.reviewer, reviewed_at: demo.review.reviewedAt, verification_result: demo.review.verificationResult, verification_comment: demo.review.verificationComment, verifier_id: userData.user?.id ?? null, verifier_name_snapshot: demo.review.verifier, verified_at: demo.review.verifiedAt }));
      const { error } = await supabase.from("document_reviews").upsert(rows, { onConflict: "cycle_id,round" });
      if (error) { setNotice(`서류검토 정식 기록 저장에 실패했습니다: ${error.message}`); return; }
      await supabase.from("processing_cycles").update({ document_review_date: demo.review.reviewedAt }).in("id", Object.values(cycleIds));
    }
    move("INVOICE_PENDING", "인보이스·입금", "검토자와 검증인의 확인이 완료되었습니다. 인보이스를 발행하세요.");
  };
  const recordInvoice = async () => {
    if (!demo.invoiceNo || !demo.invoiceAmount || !demo.invoiceRecipientName || !demo.invoiceIssuedAt) { setNotice("인보이스 번호, 금액, 수신자와 발행일을 모두 입력해 주세요."); return; }
    if (usesSupabaseWorkspace) {
      const supabase = createClient();
      const { data: invoice, error } = await supabase.from("invoices").upsert({ invoice_no: demo.invoiceNo, recipient_type: demo.invoiceRecipientType === "개인" ? "INDIVIDUAL" : "PARTNER", recipient_name: demo.invoiceRecipientName, amount: Number(demo.invoiceAmount), issued_at: demo.invoiceIssuedAt, payment_status: "UNPAID" }, { onConflict: "invoice_no" }).select("id").single();
      if (error || !invoice) { setNotice(`인보이스 정식 기록 저장에 실패했습니다: ${error?.message ?? "인보이스 ID 없음"}`); return; }
      const { error: linkError } = await supabase.from("invoice_jobs").upsert(linkedJobs.map((job) => ({ invoice_id: invoice.id, job_id: job.id })), { onConflict: "invoice_id,job_id" });
      if (linkError) { setNotice(`인보이스와 Job 연결에 실패했습니다: ${linkError.message}`); return; }
    }
    move("PAYMENT_PENDING", "인보이스·입금", "인보이스 발행을 기록했습니다. 입금내역을 확인해 주세요.");
  };
  const confirmPayment = async () => {
    if (!demo.paidAmount || !demo.payerName || !demo.paymentConfirmedAt || !demo.paymentConfirmedBy) { setNotice("입금액, 입금자, 입금 확인일과 확인 담당자를 모두 입력해 주세요."); return; }
    if (Number(demo.paidAmount) < Number(demo.invoiceAmount)) { setNotice("입금액이 청구금액보다 적습니다. 전액 입금을 확인한 뒤 진행해 주세요."); return; }
    if (usesSupabaseWorkspace) {
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const { error } = await supabase.from("invoices").update({ payment_status: "PAID", paid_amount: Number(demo.paidAmount), paid_at: demo.paymentConfirmedAt, payer_name: demo.payerName, confirmed_by: userData.user?.id ?? null }).eq("invoice_no", demo.invoiceNo);
      if (error) { setNotice(`입금 정식 기록 저장에 실패했습니다: ${error.message}`); return; }
    }
    move("DECISION_PENDING", "인증심의", "전액 입금 확인이 완료되었습니다. 인증심의를 진행하세요.");
  };

  const finishDecision = async () => {
    if (linkedJobs.some((job) => assessmentItems.some((item) => !demo.assessment[job.id]?.[item]))) { setNotice("모든 Job의 5개 평가항목을 직접 판정해 주세요."); return; }
    const selectedMembers = demo.panelMembers.filter((member) => member.selected);
    if (selectedMembers.length < 2) { setNotice("활성 심의위원 중 최소 2명을 선택해 주세요."); return; }
    if (selectedMembers.some((member) => !member.decision)) { setNotice("선택한 모든 심의위원의 개별 결정을 입력해 주세요."); return; }
    if (!demo.decisionDate) { setNotice("패널 심의일을 입력해 주세요."); return; }
    if (!demo.finalApprover || !demo.finalApprovalDate || linkedJobs.some((job) => !demo.decisions[job.id]?.result)) { setNotice("대표자, 최종 승인일과 모든 Job의 최종 승인 결과를 입력해 주세요."); return; }
    if (usesSupabaseWorkspace) {
      if (linkedJobs.some((job) => !cycleIds[job.id])) { setNotice("Job 처리 회차를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요."); return; }
      if (selectedMembers.some((member) => !panelMemberIds[member.name])) { setNotice("선택한 심의위원이 관리자 명단과 연결되지 않았습니다. 명단을 확인해 주세요."); return; }
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const decisionRows = linkedJobs.map((job) => ({ cycle_id: cycleIds[job.id], result: demo.decisions[job.id].result, comment: demo.decisions[job.id].comment, decision_date: demo.decisionDate, final_approver: demo.finalApprover, final_approval_date: demo.finalApprovalDate, entered_by: userData.user?.id ?? null }));
      const { data: savedDecisions, error } = await supabase.from("certification_decisions").upsert(decisionRows, { onConflict: "cycle_id" }).select("id, cycle_id");
      if (error || !savedDecisions) { setNotice(`인증심의 정식 기록 저장에 실패했습니다: ${error?.message ?? "심의 ID 없음"}`); return; }
      const panelRows = savedDecisions.flatMap((decision) => selectedMembers.map((member) => ({ decision_id: decision.id, panel_member_id: panelMemberIds[member.name], result: member.decision, comment: member.comment })));
      const { error: panelError } = await supabase.from("decision_panel_entries").upsert(panelRows, { onConflict: "decision_id,panel_member_id" });
      if (panelError) { setNotice(`심의위원 개별결정 저장에 실패했습니다: ${panelError.message}`); return; }
      const { error: dateError } = await supabase.from("processing_cycles").update({ decision_date: demo.decisionDate }).in("id", Object.values(cycleIds));
      if (dateError) { setNotice(`처리 회차 심의일 저장에 실패했습니다: ${dateError.message}`); return; }
    }
    move("CERTIFICATE_DRAFT_PENDING", "Job·패키지", "심의와 대표자 승인이 완료되었습니다. 기본 신청정보가 기재된 인증서 초안을 발행하세요.");
  };
  const finishDraft = () => {
    const approved = linkedJobs.filter((job) => ["승인", "재승인"].includes(demo.decisions[job.id]?.result));
    if (approved.some((job) => !demo.certificates[job.id]?.draftIssuedAt)) { setNotice("승인된 모든 Job의 초안 발행일을 입력해 주세요."); return; }
    move("CERTIFICATION_INFO_PENDING", "Job·패키지", "초안 발행을 기록했습니다. 인증번호와 전자본 PDF 발행정보를 입력하세요.");
  };
  const finishCertification = async () => {
    const approved = linkedJobs.filter((job) => ["승인", "재승인"].includes(demo.decisions[job.id]?.result));
    if (!approved.length) { setNotice("승인된 Job이 없어 패키지 생성 단계로 진행할 수 없습니다."); return; }
    if (approved.some((job) => !demo.certificates[job.id]?.certificationNo || !demo.certificates[job.id]?.issueDate || !demo.certificates[job.id]?.expiryDate)) { setNotice("승인 Job의 인증번호·발행일·만료일을 입력해 주세요."); return; }
    if (approved.some((job) => { const certificate = demo.certificates[job.id]; const prefix = getCertificationNumberPrefix(job.businessArea ?? application.businessArea, application.scheme ?? "IAS", job.accreditationTrack ?? application.accreditationTrack, job.standard, job.currentGrade, certificate?.issueDate ?? ""); return !prefix || !new RegExp(`^${escapeRegExp(prefix)}\\d{4}$`).test(certificate?.certificationNo ?? ""); })) { setNotice("인증번호가 해당 분야·등급·발행연도의 규칙과 일치하지 않습니다."); return; }
    if (usesSupabaseWorkspace) {
      if (approved.some((job) => !cycleIds[job.id])) { setNotice("Job 처리 회차를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요."); return; }
      const supabase = createClient();
      const previousJobIds = approved.map((job) => job.previousJobId).filter((id): id is string => Boolean(id));
      const { data: previousRecords, error: previousError } = previousJobIds.length ? await supabase.from("certification_records").select("id, job_id").in("job_id", previousJobIds).eq("history_state", "CURRENT") : { data: [], error: null };
      if (previousError) { setNotice(`기존 인증이력을 불러오지 못했습니다: ${previousError.message}`); return; }
      const previousRecordByJob = new Map((previousRecords ?? []).map((record) => [record.job_id, record.id]));
      const rows = approved.map((job) => { const certificate = demo.certificates[job.id]; return { job_id: job.id, cycle_id: cycleIds[job.id], certification_no: certificate.certificationNo, revision: 0, draft_issued_at: certificate.draftIssuedAt || null, issue_date: certificate.issueDate, valid_from: certificate.issueDate, valid_until: certificate.expiryDate, state: "ACTIVE", history_state: "CURRENT", replaced_record_id: job.previousJobId ? previousRecordByJob.get(job.previousJobId) ?? null : null }; });
      const { error } = await supabase.from("certification_records").upsert(rows, { onConflict: "cycle_id" });
      if (error) { setNotice(`인증정보 정식 기록 저장에 실패했습니다: ${error.message}`); return; }
      if (previousRecords?.length) {
        const historyState = application.applicationType === "갱신" ? "REPLACED_BY_RENEWAL" : "REPLACED_BY_GRADE_CHANGE";
        const { error: historyError } = await supabase.from("certification_records").update({ history_state: historyState }).in("id", previousRecords.map((record) => record.id));
        if (historyError) { setNotice(`기존 인증이력 상태를 변경하지 못했습니다: ${historyError.message}`); return; }
      }
      const cycleUpdates = await Promise.all(approved.map((job) => supabase.from("processing_cycles").update({ planned_issue_date: demo.certificates[job.id].issueDate }).eq("id", cycleIds[job.id])));
      const cycleError = cycleUpdates.find((result) => result.error)?.error;
      if (cycleError) { setNotice(`처리 회차 인증발행일 저장에 실패했습니다: ${cycleError.message}`); return; }
      const { error: jobError } = await supabase.from("jobs").update({ certification_state: "ACTIVE" }).in("id", approved.map((job) => job.id));
      if (jobError) { setNotice(`Job 인증상태 저장에 실패했습니다: ${jobError.message}`); return; }
    }
    move("ORIGINAL_DELIVERY_PENDING", "Job·패키지", "전자본 PDF 발행을 기록했습니다. 원본 송부정보를 입력하세요.");
  };
  const finishOriginalDelivery = async () => {
    const approved = linkedJobs.filter((job) => ["승인", "재승인"].includes(demo.decisions[job.id]?.result));
    if (approved.some((job) => !demo.certificates[job.id]?.originalSentAt || !demo.certificates[job.id]?.trackingNumber)) { setNotice("승인된 모든 Job의 원본 송부일과 운송장 번호를 입력해 주세요."); return; }
    if (usesSupabaseWorkspace) {
      if (approved.some((job) => !cycleIds[job.id])) { setNotice("Job 처리 회차를 불러오지 못했습니다. 새로고침 후 다시 시도해 주세요."); return; }
      const supabase = createClient();
      const { data: userData } = await supabase.auth.getUser();
      const rows = approved.map((job) => { const certificate = demo.certificates[job.id]; const delivery = demo.deliveryDocuments[job.id]; return { cycle_id: cycleIds[job.id], document_checklist: delivery, delivery_method: "이메일·우편", electronic_issued_at: certificate.issueDate, original_sent_at: certificate.originalSentAt, tracking_number: certificate.trackingNumber, delivered_by: userData.user?.id ?? null, note: delivery?.deliveryConfirmation?.comment || null }; });
      const { error } = await supabase.from("document_deliveries").upsert(rows, { onConflict: "cycle_id" });
      if (error) { setNotice(`문서전달 정식 기록 저장에 실패했습니다: ${error.message}`); return; }
      const cycleUpdates = await Promise.all(approved.map((job) => supabase.from("processing_cycles").update({ delivery_date: demo.deliveryDocuments[job.id]?.deliveryConfirmation?.date || demo.certificates[job.id].originalSentAt }).eq("id", cycleIds[job.id])));
      const cycleError = cycleUpdates.find((result) => result.error)?.error;
      if (cycleError) { setNotice(`처리 회차 문서전달일 저장에 실패했습니다: ${cycleError.message}`); return; }
    }
    move("PACKAGE_READY", "Job·패키지", "원본 송부정보까지 확인했습니다. 기록 패키지를 생성하세요.");
  };
  const generate = async () => {
    if (!languages.KR && !languages.EN) { setNotice("생성할 언어를 하나 이상 선택해 주세요."); return; }
    const issues = packageDocumentIssues(linkedJobs, demo.deliveryDocuments, deliveryDocumentRows);
    if (!linkedJobs.length) { setNotice("연결된 Job이 없어 패키지를 생성할 수 없습니다."); return; }
    if (issues.length) { setNotice(`문서전달 기록을 확인해 주세요: ${issues.map((issue) => `${linkedJobs.find((job) => job.id === issue.jobId)?.jobNo} ${issue.label} (${issue.reason})`).join(", ")}`); return; }
    const decisionOverride = linkedJobs.some((job) => { const issueDate = demo.certificates[job.id]?.issueDate; return issueDate && demo.decisionDate !== addKoreanBusinessDays(issueDate, -dateRules.decisionDays); });
    const deliveryOverrideMissing = linkedJobs.some((job) => { const issueDate = demo.certificates[job.id]?.issueDate; const deliveryDate = demo.deliveryDocuments[job.id]?.deliveryConfirmation.date; return issueDate && deliveryDate !== addKoreanBusinessDays(issueDate, dateRules.deliveryDays) && !demo.dateOverrideReasons.delivery[job.id]?.trim(); });
    if (decisionOverride && !demo.dateOverrideReasons.decision.trim()) { setNotice("자동 계산된 심의일을 변경한 사유를 입력해 주세요."); return; }
    if (deliveryOverrideMissing) { setNotice("자동 계산된 문서전달확인서 작성일을 변경한 사유를 입력해 주세요."); return; }
    const unrecordedOverride = linkedJobs.some((job) => { const issueDate = demo.certificates[job.id]?.issueDate; if (!issueDate) return false; const expectedDecision = addKoreanBusinessDays(issueDate, -dateRules.decisionDays); const expectedDelivery = addKoreanBusinessDays(issueDate, dateRules.deliveryDays); const decisionRecorded = demo.decisionDate === expectedDecision || demo.dateAuditLogs.some((log) => log.jobId === job.id && log.field === "심의일" && log.after === demo.decisionDate); const deliveryDate = demo.deliveryDocuments[job.id]?.deliveryConfirmation.date; const deliveryRecorded = deliveryDate === expectedDelivery || demo.dateAuditLogs.some((log) => log.jobId === job.id && log.field === "문서전달확인서 작성일" && log.after === deliveryDate); return !decisionRecorded || !deliveryRecorded; });
    if (unrecordedOverride) { setNotice("변경한 날짜의 사유를 처리이력에 기록해 주세요."); return; }
    await downloadZip();
  };
  const downloadZip = async () => {
    if (generationBusy.current) return;
    const selected = (["KR", "EN"] as DocumentLanguage[]).filter((language) => languages[language]);
    if (!selected.length) { setNotice("생성할 언어를 선택해 주세요."); return; }
    generationBusy.current = true;
      setGenerating(true);
      try {
        setNotice("선택한 양식의 준비 상태를 다시 확인하고 있습니다.");
        const readinessResponse = await fetch("/api/documents/template-readiness", { cache: "no-store" });
        if (!readinessResponse.ok) throw new Error(await documentErrorMessage(readinessResponse));
        const readiness = await readinessResponse.json();
        if (!isTemplateReadinessRows(readiness.templates)) throw new Error("양식 준비 상태를 확인하지 못했습니다. 다시 시도해 주세요.");
        if (selected.includes("EN")) {
          const types = corporateTemplateRegistry.filter((template) => template.language === "EN" && readiness.templates.some((row: { id: string; source: string }) => row.id === template.id && row.source !== "MISSING")).map((template) => template.documentType);
          const issues = documentTranslationIssues(packageContext, linkedJobs.map((job) => job.id), types);
          if (issues.length) { setNotice(documentTranslationMessage(issues)); return; }
        }
        const choice = confirmPackageReadiness(readiness.templates, { KR: selected.includes("KR"), EN: selected.includes("EN") }, linkedJobs.length, (message) => window.confirm(message));
        if (choice === "EMPTY") { setNotice("선택한 언어로 생성할 수 있는 양식이 없습니다. 양식을 등록한 뒤 다시 진행해 주세요."); return; }
        if (choice === "CANCEL") { setNotice("패키지 생성을 취소했습니다. 파일 생성이나 완료 처리는 하지 않았습니다."); return; }
        if (!canAttachPackageGeneration(packageContext, latestPackageContext.current)) { setNotice("확인 중 업무 입력이 변경되었습니다. 입력 저장 후 다시 생성해 주세요."); return; }
        setNotice("실제 기업 양식 DOCX ZIP을 생성하고 있습니다.");
      const receipt = await downloadCorporatePackageZip(packageContext, linkedJobs, selected);
      if (!canAttachPackageGeneration(packageContext, latestPackageContext.current)) {
        setNotice("생성 중 업무 입력이 변경되었습니다. 파일 다운로드는 요청됐지만 현재 업무를 새로 완료 처리하지 않았습니다. 입력 저장 후 다시 생성해 주세요.");
        return;
      }
      setDemo((current) => canAttachPackageGeneration(packageContext, { ...latestPackageContext.current, ...current }) ? ({ ...current, stage: receipt.complete ? "COMPLETED" : "PACKAGE_READY", generated: true, packageGeneration: receipt, dateAuditLogs: [...current.dateAuditLogs, createAuditLog("처리", "", "기록 패키지", "생성 준비", receipt.complete ? "DOCX ZIP 생성" : "일부 DOCX 생성", `실제 ${receipt.fileCount}개 DOCX 생성 응답 확인. PDF 생성·사용자 저장 완료는 별도 확인 필요.`, application.primaryOwner)] }) : current);
      setNotice(`${receipt.fileCount}개 DOCX를 포함한 ZIP을 생성하고 다운로드를 요청했습니다. ${receipt.complete ? "" : "일부 양식이 미등록되어 전체 패키지 완료로 처리하지 않았습니다. "}PDF 생성 및 PC 저장 완료를 의미하지 않습니다. ${receipt.receiptStatus === "RECORDED" ? "서버 생성기록 저장 확인." : "서버 생성기록은 DB 적용 대기 또는 로컬 미리보기입니다."} 업무단계 공유 저장은 별도로 확인해 주세요.`);
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "기업 양식 ZIP 생성에 실패했습니다. 완료로 기록하지 않았습니다.");
    } finally { generationBusy.current = false; setGenerating(false); }
  };
  const correctionOptions = [
    { key: "review.result", label: "1차 검토결과", value: demo.review.result },
    { key: "review.comment", label: "1차 검토의견", value: demo.review.comment },
    { key: "review.verificationResult", label: "2차 검증결과", value: demo.review.verificationResult },
    { key: "invoiceNo", label: "인보이스 번호", value: demo.invoiceNo },
    { key: "invoiceIssuedAt", label: "인보이스 발행일", value: demo.invoiceIssuedAt, type: "date" },
    { key: "paymentConfirmedAt", label: "입금 확인일", value: demo.paymentConfirmedAt, type: "date" },
    { key: "decisionDate", label: "패널 심의일", value: demo.decisionDate, type: "date" },
    { key: "finalApprovalDate", label: "최종 승인일", value: demo.finalApprovalDate, type: "date" },
    ...linkedJobs.flatMap((job) => [
      { key: `certificateNo:${job.id}`, label: `${job.jobNo} · 인증번호`, value: demo.certificates[job.id]?.certificationNo ?? "" },
      { key: `expiryDate:${job.id}`, label: `${job.jobNo} · 만료일`, value: demo.certificates[job.id]?.expiryDate ?? "", type: "date" },
      { key: `draftIssuedAt:${job.id}`, label: `${job.jobNo} · 초안 발행일`, value: demo.certificates[job.id]?.draftIssuedAt ?? "", type: "date" },
      { key: `originalSentAt:${job.id}`, label: `${job.jobNo} · 원본 송부일`, value: demo.certificates[job.id]?.originalSentAt ?? "", type: "date" },
      { key: `trackingNumber:${job.id}`, label: `${job.jobNo} · 운송장 번호`, value: demo.certificates[job.id]?.trackingNumber ?? "" },
    ]),
  ];
  const selectedCorrection = correctionOptions.find((item) => item.key === correctionTarget) ?? correctionOptions[0];
  const applyCorrection = () => {
    const after = correctionValue.trim();
    const before = selectedCorrection.value ?? "";
    if (!after || !correctionReason.trim()) { setNotice("정정값과 정정 사유를 모두 입력해 주세요."); return; }
    if (after === before) { setNotice("변경 전과 다른 값을 입력해 주세요."); return; }
    setDemo((current) => {
      let next = applyCorrectionValue(current, correctionTarget, after);
      const jobId = correctionTarget.includes(":") ? correctionTarget.split(":")[1] : "";
      next = { ...next, dateAuditLogs: [...next.dateAuditLogs, createAuditLog("정정", jobId, selectedCorrection.label, before, after, correctionReason.trim(), application.primaryOwner)] };
      return next;
    });
    setCorrectionValue("");
    setCorrectionReason("");
    setNotice(`${selectedCorrection.label}을(를) 정정하고 변경이력을 기록했습니다.`);
  };

  return <div className="space-y-5">
    {usesSupabaseWorkspace && editLock === "CHECKING" && <div className="rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">편집 가능 여부를 확인하고 있습니다.</div>}
    {usesSupabaseWorkspace && editLock === "OWNED" && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-900"><strong>편집 가능</strong> · 현재 신청 건의 편집 권한을 확보했습니다. 작업 중에는 자동으로 연장됩니다.</div>}
    {usesSupabaseWorkspace && editLock === "READ_ONLY" && <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-950"><strong>조회 전용</strong> · {lockOwner}이(가) 현재 편집 중입니다. 해당 직원이 화면을 닫거나 15분 동안 갱신하지 않으면 편집할 수 있습니다.</div>}
    <section className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="flex-1"><p className="text-sm font-semibold text-blue-950">샘플 업무 진행</p><p className="mt-1 text-sm text-blue-800">{notice}</p>{lastSavedAt && <p className="mt-1 text-xs font-medium text-emerald-700">{lastSavedAt}</p>}</div><div className="flex gap-2"><Button size="sm" variant="outline" disabled={!canEdit} onClick={saveDraft}><Save/>현재 입력 저장</Button><Button size="sm" variant="outline" disabled={!canEdit} onClick={reset}><RotateCcw/>처음부터 다시</Button></div></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-4 xl:grid-cols-7">{stageOrder.map((stage, index) => <div key={stage} className={`rounded-md border px-2 py-2 text-center text-xs font-semibold ${index < currentIndex || demo.stage === "COMPLETED" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : index === currentIndex ? "border-blue-700 bg-blue-800 text-white" : "border-slate-200 bg-white text-slate-400"}`}>{index < currentIndex || demo.stage === "COMPLETED" ? "✓ " : ""}{stageLabels[stage]}</div>)}</div>
    </section>

    <section className="rounded-lg border bg-white p-5 shadow-sm"><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-6"><Summary label="후보자" value={candidate.name}/><Summary label="분야" value={businessAreaLabels[application.businessArea]}/><Summary label="인정 구분" value={accreditationLabels[application.accreditationTrack]}/><Summary label="공식 접수일" value={application.receivedAt}/><Summary label="관리 No." value={`${application.managementNoFrom}${application.managementNoFrom === application.managementNoTo ? "" : `~${application.managementNoTo}`}`}/><div><p className="text-xs font-medium text-slate-500">기준상태</p><div className="mt-1.5"><ApplicationStatusBadge status={application.status}/></div></div></div></section>
    <div className="overflow-x-auto rounded-lg border bg-white px-2"><div className="flex min-w-max">{tabs.map((tab) => <Link key={tab} href={`?tab=${tabSlugs[tab]}`} onClick={() => setActive(tab)} aria-current={active === tab ? "page" : undefined} className={`border-b-2 px-4 py-3 text-sm font-medium ${active === tab ? "border-blue-800 text-blue-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{tab}</Link>)}</div></div>

    {!hydrated && <div role="status" className="rounded-lg border border-amber-300 bg-card p-4 text-sm text-amber-700 dark:text-amber-300"><p>{workspaceLoadError || "저장된 업무기록을 확인하고 있습니다. 확인 전에는 편집·저장·업무 처리를 할 수 없습니다."}</p>{workspaceLoadError && <Button type="button" className="mt-3" variant="outline" onClick={() => setWorkspaceLoadRevision((value) => value + 1)}><RotateCcw/>저장된 업무기록 다시 조회</Button>}</div>}
    <fieldset disabled={!canEdit} className="space-y-5 border-0 p-0 disabled:opacity-80">

    {active === "신청 개요" && <div className="grid gap-5 xl:grid-cols-2">
      <Section title="접수정보"><dl className="grid gap-5 sm:grid-cols-2"><Info label="신청번호" value={application.applicationNo}/><Info label="신청구분" value={application.applicationType}/><Info label="파트너사" value={application.partnerCompany}/><Info label="주 담당자" value={application.primaryOwner}/><Info label="공식 접수일" value={application.receivedAt}/><Info label="시스템 등록일시" value={application.registeredAt}/></dl></Section>
      <Section title="후보자 신청정보"><dl className="grid gap-5 sm:grid-cols-2"><Info label="성명" value={candidate.name}/><Info label="영문명" value={candidate.nameEn}/><Info label="생년월일" value={candidate.birthDate}/><Info label="국적" value={candidate.nationality}/><Info label="전자메일" value={candidate.email}/><Info label="전화번호" value={candidate.phone}/></dl></Section>
      <Section title="신청 분야 및 자격정보"><div className="space-y-3">{linkedJobs.map((job) => <div key={job.id} className="rounded-md border p-3"><p className="font-semibold">{job.standard} · {job.currentGrade}</p><p className="mt-1 text-xs text-slate-500">{job.jobNo} · {application.applicationType} · {accreditationLabels[application.accreditationTrack]}</p></div>)}</div><dl className="mt-5 grid gap-5 sm:grid-cols-2"><Info label="최종학력" value="증빙 접수"/><Info label="심사원 교육" value="수료증 접수"/><Info label="업무경력" value="경력증빙 접수"/><Info label="심사이력" value="심사이력 증빙 접수"/><Info label="특별 요구사항" value="없음"/><Info label="등록 Job 수" value={`${linkedJobs.length}건`}/></dl></Section>
      <div className="xl:col-span-2"><Section title="교육기관 및 시험일정" description="교육기관 지정 여부에 따라 시험통보일과 시험일을 자동 계산합니다."><div className="space-y-4">{linkedJobs.map((job) => { const schedule = demo.examSchedules[job.id]; const availableInstitutions = trainingInstitutions.filter((item) => item.active && item.validFrom <= application.receivedAt && item.validUntil >= application.receivedAt && item.standards.includes(job.standard)); const selectedInstitution = trainingInstitutions.find((item) => item.name === schedule.providerName); return <div key={job.id} className="rounded-lg border bg-slate-50 p-4"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><p className="font-semibold">{job.jobNo} · {job.standard}</p><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-800">{schedule.providerType === "PARTNER" ? "지정 연수기관" : "비지정 교육기관"}</span></div><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5"><Field label="교육기관 구분"><select className={controlClass} value={schedule.providerType} onChange={(event) => changeExamSchedule(job.id, { providerType: event.target.value as TrainingProviderType, providerName: event.target.value === "PARTNER" ? "" : schedule.providerName }, application.receivedAt, setDemo)}><option value="PARTNER">지정 연수기관</option><option value="NON_PARTNER">비지정 교육기관</option></select></Field><Field label="교육기관명">{schedule.providerType === "PARTNER" ? <select className={controlClass} value={schedule.providerName} onChange={(event) => changeExamSchedule(job.id, { providerName: event.target.value }, application.receivedAt, setDemo)}><option value="">유효 연수기관 선택</option>{availableInstitutions.map((item) => <option key={item.id} value={item.name}>{item.name} · {item.designationNo}</option>)}</select> : <input className={controlClass} value={schedule.providerName} onChange={(event) => changeExamSchedule(job.id, { providerName: event.target.value }, application.receivedAt, setDemo)}/>}</Field><Field label="교육 종료일"><input type="date" className={controlClass} value={schedule.trainingEndDate} onChange={(event) => changeExamSchedule(job.id, { trainingEndDate: event.target.value }, application.receivedAt, setDemo)}/></Field><Field label="시험통보일"><input type="date" className={controlClass} value={schedule.examNoticeDate} onChange={(event) => changeExamSchedule(job.id, { examNoticeDate: event.target.value }, application.receivedAt, setDemo)}/></Field><Field label="시험일"><input type="date" className={controlClass} value={schedule.examDate} onChange={(event) => changeExamSchedule(job.id, { examDate: event.target.value }, application.receivedAt, setDemo)}/></Field></div>{selectedInstitution && schedule.providerType === "PARTNER" && <p className="mt-3 text-xs text-blue-700">지정번호 {selectedInstitution.designationNo} · 유효기간 {selectedInstitution.validFrom} ~ {selectedInstitution.validUntil} · 신청표준 {selectedInstitution.standards.join(", ")}</p>}<p className="mt-2 text-xs text-slate-500">{schedule.providerType === "PARTNER" ? "교육 종료일을 시험일로 적용하고 시험통보일은 5영업일 전으로 계산합니다." : `신청서류 접수일 ${application.receivedAt} 기준 · 시험통보 10영업일 전 · 시험 5영업일 전`}</p></div>; })}</div></Section></div>
      <Section title="Dropbox 신청 폴더"><div className="rounded-md bg-slate-50 p-4"><div className="flex gap-3"><FolderOpen className="h-5 w-5 text-blue-800"/><div><p className="font-semibold">{application.dropboxFolderName}</p><p className="mt-1 break-all text-xs text-slate-500">{application.dropboxPath}</p></div></div></div><Button className="mt-4" variant="outline" onClick={() => navigator.clipboard.writeText(application.dropboxFolderName)}><Copy/>폴더명 복사</Button></Section>
    </div>}

    {active === "자료보관" && <Section title="대표메일 수신 및 Dropbox 보관"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{storageDocumentItems.map((item) => <label key={item} className="flex items-center gap-3 rounded-md border p-3 text-sm"><Checkbox checked={demo.storedDocuments[item]} onCheckedChange={(checked) => setDemo((current) => ({ ...current, storedDocuments: { ...current.storedDocuments, [item]: Boolean(checked) } }))}/>{item}<span className={`ml-auto text-xs ${demo.storedDocuments[item] ? "text-emerald-700" : "text-slate-400"}`}>{demo.storedDocuments[item] ? "보관 완료" : "미보관"}</span></label>)}</div><div className="mt-5 flex justify-end"><Button onClick={saveDraft}><Save/>보관상태 저장</Button></div></Section>}

    {active === "서류검토" && <div className="space-y-5"><Section title="자격요건 및 제출문서 검토" description="후보자 신청정보와 제출 증빙을 기준으로 실무자가 항목별 결과를 직접 기록합니다."><div className="grid gap-3 sm:grid-cols-2">{reviewRequirementItems.map((item) => <div key={item} className="rounded-md border p-4"><p className="text-sm font-semibold">{item}</p><div className="mt-3 flex gap-4 text-sm">{(["충족", "미충족", "해당없음"] as RequirementResult[]).map((value) => <label key={value}><input type="radio" name={item} checked={demo.reviewRequirements[item] === value} onChange={() => setDemo((current) => ({ ...current, reviewRequirements: { ...current.reviewRequirements, [item]: value } }))}/> {value}</label>)}</div></div>)}</div></Section>
      <Section title="1차 검토" description="검토자가 증빙자료와 자격요건을 확인합니다."><div className="grid gap-4 sm:grid-cols-2"><Field label="종합 검토결과"><select className={controlClass} value={demo.review.result} onChange={(event) => setDemo((current) => ({ ...current, review: { ...current.review, result: event.target.value as DemoReview["result"] } }))}><option>적합</option><option>보완필요</option><option>부적합</option></select></Field><Field label="검토자"><input className={controlClass} value={demo.review.reviewer} onChange={(event) => setDemo((current) => ({ ...current, review: { ...current.review, reviewer: event.target.value } }))}/></Field><Field label="검토일"><input type="date" className={controlClass} value={demo.review.reviewedAt} onChange={(event) => setDemo((current) => ({ ...current, review: { ...current.review, reviewedAt: event.target.value } }))}/></Field><Field label="검토의견" className="sm:col-span-2"><textarea className={textareaClass} value={demo.review.comment} onChange={(event) => setDemo((current) => ({ ...current, review: { ...current.review, comment: event.target.value } }))}/></Field></div></Section>
      <Section title="2차 검증" description="검증인이 1차 검토내용과 제출 증빙의 일치 여부를 확인합니다."><div className="grid gap-4 sm:grid-cols-2"><Field label="검증 결과"><select className={controlClass} value={demo.review.verificationResult} onChange={(event) => setDemo((current) => ({ ...current, review: { ...current.review, verificationResult: event.target.value as DemoReview["verificationResult"] } }))}><option>확인</option><option>재검토요청</option></select></Field><Field label="검증인"><input className={controlClass} value={demo.review.verifier} onChange={(event) => setDemo((current) => ({ ...current, review: { ...current.review, verifier: event.target.value } }))}/></Field><Field label="검증일"><input type="date" className={controlClass} value={demo.review.verifiedAt} onChange={(event) => setDemo((current) => ({ ...current, review: { ...current.review, verifiedAt: event.target.value } }))}/></Field><Field label="검증의견" className="sm:col-span-2"><textarea className={textareaClass} value={demo.review.verificationComment} onChange={(event) => setDemo((current) => ({ ...current, review: { ...current.review, verificationComment: event.target.value } }))}/></Field></div><div className="mt-5 flex flex-wrap items-center justify-end gap-2">{lastSavedAt && <span className="mr-auto text-xs font-medium text-emerald-700">{lastSavedAt}</span>}<Button variant="outline" onClick={saveDraft}><Save/>임시저장</Button><Button onClick={finishReview}><Check/>검토·검증 완료</Button></div></Section>
    </div>}

    {active === "인보이스·입금" && <div className="space-y-5">
      <Section title="청구 대상 Job" description="한 신청에 포함된 Job은 하나의 인보이스로 통합 청구합니다."><div className="space-y-2">{linkedJobs.map((job) => <div key={job.id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"><div><p className="text-sm font-semibold">{job.jobNo} · {job.standard}</p><p className="mt-1 text-xs text-slate-500">{job.currentGrade} · {accreditationLabels[application.accreditationTrack]}</p></div><span className="rounded-full bg-blue-50 px-2.5 py-1 text-xs font-semibold text-blue-800">청구 포함</span></div>)}</div></Section>
      <Section title="1. 인보이스 발행 기록" description="시스템은 발행 사실만 기록하며 실제 인보이스 생성과 이메일 발송은 현재 범위에 포함하지 않습니다."><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"><Field label="수신자 구분"><select className={controlClass} value={demo.invoiceRecipientType} onChange={(event) => setDemo((current) => ({ ...current, invoiceRecipientType: event.target.value as DemoState["invoiceRecipientType"] }))}><option>개인</option><option>파트너사</option></select></Field><Field label="수신자"><input className={controlClass} value={demo.invoiceRecipientName} onChange={(event) => setDemo((current) => ({ ...current, invoiceRecipientName: event.target.value }))}/></Field><Field label="인보이스 번호"><input className={controlClass} value={demo.invoiceNo} onChange={(event) => setDemo((current) => ({ ...current, invoiceNo: event.target.value }))}/></Field><Field label="청구금액"><input type="number" className={controlClass} value={demo.invoiceAmount} onChange={(event) => setDemo((current) => ({ ...current, invoiceAmount: event.target.value }))}/></Field><Field label="인보이스 발행일"><input type="date" className={controlClass} value={demo.invoiceIssuedAt} onChange={(event) => setDemo((current) => ({ ...current, invoiceIssuedAt: event.target.value }))}/></Field></div>{invoices.length > 0 && <p className="mt-3 text-xs text-slate-500">기존 가상 인보이스: {invoices.map((invoice) => invoice.invoiceNo).join(", ")}</p>}<div className="mt-5 flex justify-end"><Button variant="outline" onClick={recordInvoice}><FileText/>인보이스 발행 기록</Button></div></Section>
      <Section title="2. 입금 확인" description="청구금액 전액의 입금일과 확인 담당자를 기록해야 인증심의로 진행할 수 있습니다."><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><Field label="입금액"><input type="number" className={controlClass} value={demo.paidAmount} onChange={(event) => setDemo((current) => ({ ...current, paidAmount: event.target.value }))}/></Field><Field label="입금자"><input className={controlClass} value={demo.payerName} onChange={(event) => setDemo((current) => ({ ...current, payerName: event.target.value }))}/></Field><Field label="실제 입금일"><input type="date" className={controlClass} value={demo.paymentConfirmedAt} onChange={(event) => setDemo((current) => ({ ...current, paymentConfirmedAt: event.target.value }))}/></Field><Field label="입금 확인 담당자"><input className={controlClass} value={demo.paymentConfirmedBy} onChange={(event) => setDemo((current) => ({ ...current, paymentConfirmedBy: event.target.value }))}/></Field></div><div className="mt-4 grid gap-3 rounded-md bg-slate-50 p-3 text-sm sm:grid-cols-2"><div><span className="text-slate-500">인보이스 발행일 </span><strong>{demo.invoiceIssuedAt || "미입력"}</strong></div><div><span className="text-slate-500">실제 입금일 </span><strong>{demo.paymentConfirmedAt || "미입력"}</strong></div><div><span className="text-slate-500">청구금액 </span><strong>{Number(demo.invoiceAmount || 0).toLocaleString()}원</strong></div><div><span className="text-slate-500">입금액 </span><strong>{Number(demo.paidAmount || 0).toLocaleString()}원</strong></div></div><div className="mt-5 flex justify-end"><Button disabled={demo.stage === "INVOICE_PENDING"} onClick={confirmPayment}><Check/>전액 입금 확인</Button></div></Section>
    </div>}

    {active === "인증심의" && <div className="space-y-5">
      <Section title="1. 개인인증 문서 및 기록 평가" description="보고서 생성 전에 Job별 5개 항목을 실무자가 직접 판정합니다. 시스템은 결과를 추천하지 않습니다.">
        <div className="space-y-5">{linkedJobs.map((job) => <div key={job.id} className="overflow-hidden rounded-lg border">
          <div className="border-b bg-slate-50 px-4 py-3"><p className="font-semibold">{job.jobNo} · {job.standard} / {job.currentGrade}</p></div>
          <div className="divide-y">{assessmentItems.map((item, index) => <div key={item} className="grid gap-3 px-4 py-4 md:grid-cols-[1fr_auto] md:items-center">
            <p className="text-sm font-medium">{index + 1}) {item}은(는) 기준을 충족했습니까?</p>
            <div className="flex flex-wrap gap-4 text-sm">{["적합", "부적합", "해당없음"].map((value) => <label key={value} className="flex cursor-pointer items-center gap-2"><input type="radio" name={`${job.id}-${item}`} checked={demo.assessment[job.id]?.[item] === value} onChange={() => changeAssessment(job.id, item, value as AssessmentResult, setDemo)}/>{value}</label>)}</div>
          </div>)}</div>
        </div>)}</div>
      </Section>

      <Section title="2. 인증패널 구성 및 개별 결정" description="관리자가 등록한 활성 심의위원 중 실제 심의에 참여한 위원을 최소 2명 선택하고, 각 위원의 결정을 기록합니다.">
        <div className="mb-5 max-w-sm"><Field label="패널 심의일"><input type="date" className={controlClass} value={demo.decisionDate} onChange={(event) => setDemo((current) => ({ ...current, decisionDate: event.target.value }))}/></Field></div>
        <div className="grid gap-4 lg:grid-cols-3">{demo.panelMembers.map((member, index) => <div key={member.name} className={`rounded-lg border p-4 ${member.selected ? "border-blue-300 bg-blue-50/50" : "bg-white"}`}>
          <label className="flex cursor-pointer items-center gap-3 font-semibold"><input type="checkbox" checked={member.selected} onChange={(event) => changePanelMember(index, { selected: event.target.checked }, setDemo)}/>{member.name}</label>
          <div className="mt-4 space-y-3"><Field label="개별 결정"><select className={controlClass} disabled={!member.selected} value={member.decision} onChange={(event) => changePanelMember(index, { decision: event.target.value as DemoPanelMember["decision"] }, setDemo)}><option value="">직접 선택</option><option>승인</option><option>불승인</option><option>재승인</option></select></Field><Field label="위원 의견"><textarea className={textareaClass} disabled={!member.selected} value={member.comment} onChange={(event) => changePanelMember(index, { comment: event.target.value }, setDemo)}/></Field></div>
        </div>)}</div>
        <p className="mt-4 text-xs text-slate-500">현재 선택: {demo.panelMembers.filter((member) => member.selected).length}명 / 최소 2명</p>
      </Section>

      <Section title="3. 대표자 최종 승인" description="심의위원의 결정을 확인한 대표자가 Job별 최종 승인을 확정합니다.">
        <div className="mb-5 grid gap-4 sm:grid-cols-2"><Field label="최종 승인자"><input className={controlClass} value={demo.finalApprover} onChange={(event) => setDemo((current) => ({ ...current, finalApprover: event.target.value }))}/></Field><Field label="최종 승인일"><input type="date" className={controlClass} value={demo.finalApprovalDate} onChange={(event) => setDemo((current) => ({ ...current, finalApprovalDate: event.target.value }))}/></Field></div>
        <div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">Job No.</th><th className="px-4 py-3">분야 / 등급</th><th className="px-4 py-3">최종 승인 결과</th><th className="px-4 py-3">승인 의견</th></tr></thead><tbody className="divide-y">{linkedJobs.map((job) => <tr key={job.id}><td className="px-4 py-3 font-medium text-blue-800">{job.jobNo}</td><td className="px-4 py-3">{job.standard} / {job.currentGrade}</td><td className="px-4 py-3"><select className={controlClass} value={demo.decisions[job.id]?.result ?? ""} onChange={(event) => setDemo((current) => ({ ...current, decisions: { ...current.decisions, [job.id]: { ...current.decisions[job.id], result: event.target.value as DemoDecision[string]["result"] } } }))}><option value="">직접 선택</option><option>승인</option><option>불승인</option><option>재승인</option></select></td><td className="px-4 py-3"><input className={controlClass} value={demo.decisions[job.id]?.comment ?? ""} onChange={(event) => setDemo((current) => ({ ...current, decisions: { ...current.decisions, [job.id]: { ...current.decisions[job.id], comment: event.target.value } } }))}/></td></tr>)}</tbody></table></div>
        <div className="mt-5 flex justify-end"><Button onClick={finishDecision}><Check/>최종 승인 및 보고서 준비</Button></div>
      </Section>
    </div>}

    {active === "Job·패키지" && <Section title="Job별 인증정보 및 기록 패키지" description="화면은 한글로 운영하며, 기록 문서는 국문·영문으로 각각 생성합니다.">
      <PackageGenerationHistory applicationId={application.id} />
      <PackageTemplateReadiness languages={languages} jobCount={linkedJobs.length}/>
      <PackageDateConsistency jobs={linkedJobs} context={packageContext}/>
      <PackagePreflight jobs={linkedJobs} certificates={demo.certificates} documents={demo.deliveryDocuments} />
      <div className="mb-5 rounded-lg border p-4"><p className="text-sm font-semibold">국문 문서전달확인서 검토용 초안</p><p className="mt-1 text-xs text-muted-foreground">출력 배치 검증 전입니다. 현재 입력을 저장한 후 내려받으세요. 정식 ZIP과 패키지 완료에는 포함되지 않습니다.</p><div className="mt-3 flex flex-wrap gap-2">{linkedJobs.map((job) => <DocumentDownloadButton key={`delivery-draft-${job.id}`} label={`${job.jobNo} · 국문 초안 DOCX`} task={() => downloadDeliveryConfirmationDraftDocx(packageContext, job)} setNotice={setNotice} successMessage="국문 검토용 초안 다운로드를 요청했습니다. 정식 패키지 완료에는 포함되지 않습니다."/>)}</div></div>
      <DeliveryDocumentChecklist jobs={linkedJobs} records={demo.deliveryDocuments} decisionDate={demo.decisionDate} certificates={demo.certificates} reasons={demo.dateOverrideReasons} auditLogs={demo.dateAuditLogs} actor={application.primaryOwner} dateRules={dateRules} setDemo={setDemo}/>
      <div className="mb-5 rounded-lg border border-indigo-200 bg-indigo-50 p-4"><div><p className="text-sm font-semibold text-indigo-950">기업 양식 DOCX 생성</p><p className="mt-1 text-xs text-indigo-800">현재 입력 저장 후 생성하세요. 생성 및 파일 확인 중에는 해당 버튼을 다시 누를 수 없습니다.</p></div><div className="mt-4 space-y-3">{linkedJobs.map((job) => <div key={`corporate-documents-${job.id}`} className="flex flex-wrap items-center gap-2 rounded-md border border-indigo-100 bg-white p-3"><span className="mr-auto text-sm font-semibold text-slate-800">{job.jobNo} · {job.standard}</span>{(["KR", "EN"] as DocumentLanguage[]).filter((language) => languages[language]).map((language) => <div key={language} className="flex flex-wrap items-center gap-2"><span className="text-xs font-medium">{language === "KR" ? "국문" : "영문"}</span><DocumentDownloadButton label="서류검토서 DOCX" task={() => downloadApplicationReviewDocx(packageContext, job, language)} setNotice={setNotice} successMessage={`${job.jobNo} 서류검토서 파일을 확인하고 다운로드를 요청했습니다.`}/><DocumentDownloadButton label="인증결정보고서 DOCX" task={() => downloadDecisionReportDocx(packageContext, job, language)} setNotice={setNotice} successMessage={`${job.jobNo} 인증결정보고서 파일을 확인하고 다운로드를 요청했습니다.`}/><DocumentDownloadButton label="문서전달확인서 DOCX" task={() => downloadDeliveryConfirmationDocx(packageContext, job, language)} setNotice={setNotice} successMessage={`${job.jobNo} 문서전달확인서 파일을 확인하고 다운로드를 요청했습니다.`}/></div>)}</div>)}</div></div>
      <div className="mb-5 rounded-lg border border-blue-100 bg-blue-50 p-4"><p className="text-sm font-semibold text-blue-950">생성 언어</p><div className="mt-3 flex gap-5 text-sm">{(["KR", "EN"] as DocumentLanguage[]).map((language) => <label key={language} className="flex cursor-pointer items-center gap-2"><input type="checkbox" checked={languages[language]} onChange={(event) => setLanguages((current) => ({ ...current, [language]: event.target.checked }))}/>{language === "KR" ? "국문" : "영문"}</label>)}</div></div>
      <div id="certificate-information" className="scroll-mt-24" tabIndex={-1}><h4 className="mb-3 text-sm font-semibold">인증정보 입력</h4></div>
      {languages.EN && <div className="mb-5 rounded-lg border p-4"><h4 className="font-semibold">영문 자유서술 확인</h4><p className="mt-1 text-xs text-slate-500">공식 문서 생성 전에 번역 내용을 직접 확인하고 수정합니다.</p><div className="mt-4 grid gap-4 md:grid-cols-2"><Field label="서류검토 의견 (영문)"><textarea className={textareaClass} value={demo.englishText.reviewComment} onChange={(event) => changeEnglishText("reviewComment", event.target.value, setDemo)}/></Field><Field label="검증 의견 (영문)"><textarea className={textareaClass} value={demo.englishText.verificationComment} onChange={(event) => changeEnglishText("verificationComment", event.target.value, setDemo)}/></Field>{demo.panelMembers.filter((member) => member.selected).map((member) => <Field key={member.name} label={`${member.name} 위원 의견 (영문)`}><textarea className={textareaClass} value={demo.englishText.panelComments[member.name] ?? ""} onChange={(event) => changeEnglishPanelComment(member.name, event.target.value, setDemo)}/></Field>)}{linkedJobs.map((job) => <Field key={job.id} label={`${job.jobNo} 최종 승인 의견 (영문)`}><textarea className={textareaClass} value={demo.englishText.decisionComments[job.id] ?? ""} onChange={(event) => changeEnglishDecisionComment(job.id, event.target.value, setDemo)}/></Field>)}</div></div>}
      <div className="space-y-4">{linkedJobs.map((job) => { const certificate = demo.certificates[job.id]; const koreanDocuments = buildDocuments(packageContext, job, "KR"); const englishDocuments = buildDocuments(packageContext, job, "EN"); return <div key={job.id} className="rounded-lg border"><div className="flex flex-col gap-3 border-b bg-slate-50 p-4 sm:flex-row sm:items-center"><div className="flex-1"><p className="font-semibold">{job.standard} / {job.currentGrade}</p><p className="mt-1 text-xs text-slate-500">{job.jobNo} · 최종 승인 {demo.decisions[job.id]?.result || "미입력"}</p></div><Button variant="outline" asChild><Link href={`/jobs/${job.id}`}>Job 열기</Link></Button></div><div className="grid gap-4 p-4 xl:grid-cols-3"><div className="rounded-md border p-4"><p className="text-sm font-semibold">1. 인증서 초안</p><p className="mt-1 text-xs leading-5 text-slate-500">후보자·규격·등급 등 기본 신청정보만 표시하며 인증번호와 유효기간 등 핵심 발행정보는 제외합니다.</p><div className="mt-4"><CertificateField type="date" label="초안 발행일" value={certificate?.draftIssuedAt} onChange={(value) => changeCertificate(job.id, "draftIssuedAt", value, dateRules, setDemo)}/></div></div><div className="rounded-md border p-4"><p className="text-sm font-semibold">2. 인증서 전자본 PDF</p><div className="mt-4 space-y-4"><CertificateField type="date" label="전자본 발행일" value={certificate?.issueDate} onChange={(value) => changeCertificate(job.id, "issueDate", value, dateRules, setDemo)}/><div><CertificateField label="인증번호" value={certificate?.certificationNo} onChange={(value) => changeCertificate(job.id, "certificationNo", value, dateRules, setDemo)}/>{usesSupabaseWorkspace && !certificate?.certificationNo && <Button type="button" size="sm" variant="outline" className="mt-2 w-full" onClick={() => void allocateCertificationNo(job)}>인증번호 자동 부여</Button>}</div><CertificateField type="date" label="만료일" value={certificate?.expiryDate} onChange={(value) => changeCertificate(job.id, "expiryDate", value, dateRules, setDemo)}/></div></div><div className="rounded-md border p-4"><p className="text-sm font-semibold">3. 인증서 원본 송부</p><div className="mt-4 space-y-4"><CertificateField type="date" label="원본 송부일" value={certificate?.originalSentAt} onChange={(value) => changeCertificate(job.id, "originalSentAt", value, dateRules, setDemo)}/><CertificateField label="운송장 번호" value={certificate?.trackingNumber} placeholder="필수 입력" onChange={(value) => changeCertificate(job.id, "trackingNumber", value, dateRules, setDemo)}/></div></div></div>{demo.generated && <div className="border-t p-4"><div className="overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-3 py-3 text-left">문서</th><th className="px-3 py-3 text-left">국문</th><th className="px-3 py-3 text-left">영문</th></tr></thead><tbody className="divide-y">{koreanDocuments.map((document, index) => <tr key={document.fileName}><td className="px-3 py-3 font-medium">{document.title}</td><td className="px-3 py-3"><DocumentButtons document={document} enabled={languages.KR} setNotice={setNotice} onWord={document.title === "서류검토서" ? () => downloadApplicationReviewDocx(packageContext, job, "KR") : document.title === "인증결정보고서" ? () => downloadDecisionReportDocx(packageContext, job, "KR") : document.title === "문서전달확인서" ? () => downloadDeliveryConfirmationDocx(packageContext, job, "KR") : undefined}/></td><td className="px-3 py-3"><DocumentButtons document={englishDocuments[index]} enabled={languages.EN} setNotice={setNotice} onWord={document.title === "서류검토서" ? () => downloadApplicationReviewDocx(packageContext, job, "EN") : document.title === "인증결정보고서" ? () => downloadDecisionReportDocx(packageContext, job, "EN") : document.title === "문서전달확인서" ? () => downloadDeliveryConfirmationDocx(packageContext, job, "EN") : undefined}/></td></tr>)}</tbody></table></div></div>}</div>; })}</div>
      {demo.generated && <p className="mt-4 rounded-md border bg-slate-50 p-3 text-sm text-slate-700">{demo.packageGeneration ? `서버 생성 확인: ${demo.packageGeneration.fileCount}개 DOCX · ${demo.packageGeneration.languages.join(" / ")} · ${new Date(demo.packageGeneration.generatedAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" })} · ${demo.packageGeneration.complete ? "선택 양식 포함" : "일부 양식 미등록"}. PDF·PC 저장 완료는 별도 확인합니다.` : "기존 생성 표시는 실제 파일 생성 증거가 아닙니다. DOCX ZIP을 다시 생성하여 확인해 주세요."}</p>}
      <div className="mt-5 flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={demo.stage !== "CERTIFICATE_DRAFT_PENDING"} onClick={finishDraft}><FileText/>초안 발행 기록</Button><Button variant="outline" disabled={demo.stage !== "CERTIFICATION_INFO_PENDING"} onClick={finishCertification}><Check/>전자본 PDF 발행 확정</Button><Button variant="outline" disabled={demo.stage !== "ORIGINAL_DELIVERY_PENDING"} onClick={finishOriginalDelivery}><Check/>원본 송부 확인</Button><Button disabled={generating || demo.stage !== "PACKAGE_READY"} onClick={generate}><PackageCheck/>실제 DOCX ZIP 생성</Button><Button variant="outline" disabled={generating || !demo.generated || (!languages.KR && !languages.EN)} onClick={() => void generate()}><FileArchive/>기업 양식 DOCX ZIP 다운로드</Button></div>
    </Section>}

    {active === "처리이력" && <div className="space-y-5">
      <Section title="업무정보 정정" description="완료된 업무정보를 수정할 때 변경 전·후 값과 사유를 함께 보존합니다.">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950"><p className="font-semibold">변경 불가 기준값</p><p className="mt-1">인증서 발행일은 확정 후 정정 대상에서 제외됩니다. 변경이 필요한 경우 신규 회차 또는 별도 승인 절차로 처리합니다.</p></div>
        <div className="mt-5 grid gap-4 lg:grid-cols-2"><Field label="정정 항목"><select className={controlClass} value={correctionTarget} onChange={(event) => { const target = event.target.value; setCorrectionTarget(target); setCorrectionValue(""); }}>{correctionOptions.map((item) => <option key={item.key} value={item.key}>{item.label}</option>)}</select></Field><Field label="현재 값"><input className={`${controlClass} bg-slate-50`} readOnly value={selectedCorrection.value ?? ""}/></Field><Field label="정정 후 값"><input type={selectedCorrection.type ?? "text"} className={controlClass} value={correctionValue} onChange={(event) => setCorrectionValue(event.target.value)} placeholder="변경할 값을 입력"/></Field><Field label="정정 사유"><input className={controlClass} value={correctionReason} onChange={(event) => setCorrectionReason(event.target.value)} placeholder="필수 입력"/></Field></div>
        <div className="mt-5 flex justify-end"><Button disabled={!correctionValue.trim() || !correctionReason.trim()} onClick={applyCorrection}><Save/>정정 적용 및 이력 저장</Button></div>
      </Section>
      <Section title="처리·정정 이력" description="업무 단계 진행과 핵심정보 정정 내역을 시간순으로 추적합니다.">
        {demo.dateAuditLogs.length === 0 ? <div className="py-10 text-center text-sm text-slate-500">아직 기록된 처리이력이 없습니다.</div> : <div className="relative ml-2 border-l border-slate-200 pl-6">{demo.dateAuditLogs.slice().reverse().map((log) => <div key={log.id} className="relative pb-6 last:pb-0"><span className={`absolute -left-[31px] top-1 h-3 w-3 rounded-full ring-4 ring-white ${log.category === "정정" ? "bg-amber-500" : "bg-blue-700"}`}/><div className="flex flex-wrap items-center gap-2"><span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${log.category === "정정" ? "bg-amber-100 text-amber-900" : "bg-blue-50 text-blue-800"}`}>{log.category}</span><p className="font-semibold">{log.field}</p>{log.jobId && <span className="text-xs text-slate-500">{linkedJobs.find((job) => job.id === log.jobId)?.jobNo}</span>}</div><p className="mt-2 text-sm"><span className="text-slate-500">변경 전 </span>{log.before || "미입력"}<span className="mx-2 text-slate-300">→</span><span className="text-slate-500">변경 후 </span>{log.after || "미입력"}</p><p className="mt-1 text-sm text-slate-700">{log.reason}</p><p className="mt-1 text-xs text-slate-500">{log.actor} · {log.occurredAt}</p></div>)}</div>}
      </Section>
      {usesSupabaseWorkspace && <Section title="시스템 감사이력" description="Supabase 정식 업무 테이블의 등록·변경·삭제 기록과 실제 시스템 시각입니다."><SupabaseAuditTrail applicationId={application.id} candidateId={candidate.id} jobIds={linkedJobs.map((job) => job.id)} cycleIds={Object.values(cycleIds)}/></Section>}
    </div>}
    </fieldset>
    <div className="flex flex-col gap-3 rounded-lg border bg-white p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-slate-800">현재 업무 입력 저장</p><p className="mt-1 text-xs text-slate-500">화면 하단에서도 현재 입력값을 즉시 저장할 수 있습니다.{usesSupabaseWorkspace ? " 저장값은 다른 기기에도 공유됩니다." : ""}</p>{lastSavedAt && <p className="mt-1 text-xs font-medium text-emerald-700">{lastSavedAt}</p>}</div><Button disabled={!canEdit} onClick={saveDraft} className="bg-blue-800 hover:bg-blue-900"><Save/>현재 입력 저장</Button></div>
  </div>;
}

function DeliveryDocumentChecklist({ jobs, records, decisionDate, certificates, reasons, auditLogs, actor, dateRules, setDemo }: { jobs: Job[]; records: DemoDeliveryDocuments; decisionDate: string; certificates: DemoCertificate; reasons: DemoState["dateOverrideReasons"]; auditLogs: DateAuditLog[]; actor: string; dateRules: DateRules; setDemo: React.Dispatch<React.SetStateAction<DemoState>> }) {
  const labels: Record<DocumentApplicability, string> = { REQUIRED: "필수", CONDITIONAL: "해당 시 필수", NOT_APPLICABLE: "해당 없음" };
  return <div className="mb-5 space-y-4">{jobs.map((job) => { const entries = deliveryDocumentRows.map((row) => ({ row, record: records[job.id]?.[row.key] })); const required = entries.filter(({ record }) => record?.applicability === "REQUIRED"); const requiredDone = required.filter(({ record }) => record?.received && record.date).length; const conditional = entries.filter(({ record }) => record?.applicability === "CONDITIONAL" && record.received); const missing = entries.filter(({ record }) => (record?.applicability === "REQUIRED" && (!record.received || !record.date)) || (record?.applicability === "CONDITIONAL" && record.received && !record.date)); const notApplicable = entries.filter(({ record }) => record?.applicability === "NOT_APPLICABLE").length; return <div key={`delivery-${job.id}`} className="rounded-lg border">
    <div className="border-b bg-slate-50 px-4 py-3"><p className="text-sm font-semibold">{job.jobNo} · 문서전달확인서 기록 목록</p><p className="mt-1 text-xs text-slate-500">분야·등급에 따라 적용 여부를 선택하며 자동 날짜는 필요시 수정할 수 있습니다.</p></div>
    <DateOverrideFields job={job} issueDate={certificates[job.id]?.issueDate ?? ""} decisionDate={decisionDate} deliveryDate={records[job.id]?.deliveryConfirmation.date ?? ""} reasons={reasons} actor={actor} dateRules={dateRules} setDemo={setDemo}/>
    <div className="grid gap-3 border-b p-4 sm:grid-cols-2 xl:grid-cols-5"><ReadinessCard label="필수 문서" value={`${requiredDone}/${required.length}건 확인`} alert={requiredDone < required.length}/><ReadinessCard label="날짜 누락" value={`${missing.length}건`} alert={missing.length > 0}/><ReadinessCard label="조건부 적용" value={`${conditional.length}건`}/><ReadinessCard label="해당 없음" value={`${notApplicable}건`}/><ReadinessCard label="패키지 상태" value={missing.length ? "생성 불가" : "생성 가능"} alert={missing.length > 0}/></div>
    {missing.length > 0 && <div className="flex flex-wrap gap-2 border-b border-amber-200 bg-amber-50 px-4 py-3">{missing.map(({ row }) => <button key={row.key} type="button" className="rounded-full border border-amber-300 bg-white px-3 py-1 text-xs font-medium text-amber-900" onClick={() => document.getElementById(`delivery-${job.id}-${row.key}`)?.scrollIntoView({ behavior: "smooth", block: "center" })}>{row.document} 확인</button>)}</div>}
    <div className="overflow-x-auto"><table className="w-full min-w-[980px] text-sm"><thead className="text-xs text-slate-500"><tr><th className="px-3 py-3 text-left">Form</th><th className="px-3 py-3 text-left">문서</th><th className="px-3 py-3 text-left">적용 구분</th><th className="px-3 py-3 text-center">확인</th><th className="px-3 py-3 text-left">기록일</th><th className="px-3 py-3 text-left">비고</th></tr></thead>
      <tbody className="divide-y">{deliveryDocumentRows.map((row) => { const record = records[job.id]?.[row.key]; const disabled = record?.applicability === "NOT_APPLICABLE"; const incomplete = (record?.applicability === "REQUIRED" && (!record.received || !record.date)) || (record?.applicability === "CONDITIONAL" && record.received && !record.date); return <tr id={`delivery-${job.id}-${row.key}`} key={row.key} className={disabled ? "bg-slate-50 text-slate-400" : incomplete ? "bg-amber-50/60" : ""}>
        <td className="px-3 py-2 text-xs">{row.form}</td><td className="px-3 py-2 font-medium">{row.document}</td>
        <td className="px-3 py-2"><select disabled={row.key === "education"} className={controlClass} value={row.key === "education" ? "REQUIRED" : record?.applicability ?? "REQUIRED"} onChange={(event) => { const applicability = event.target.value as DocumentApplicability; changeDeliveryDocument(job.id, row.key, { applicability, ...(applicability === "NOT_APPLICABLE" ? { received: false, date: "" } : {}) }, setDemo); }}>{Object.entries(labels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>{row.key === "education" && <p className="mt-1 text-xs text-blue-700">항상 필수</p>}</td>
        <td className="px-3 py-2 text-center"><input type="checkbox" disabled={disabled} checked={record?.received ?? false} onChange={(event) => changeDeliveryDocument(job.id, row.key, { received: event.target.checked }, setDemo)}/></td>
        <td className="px-3 py-2"><input type="date" disabled={disabled} className={controlClass} value={record?.date ?? ""} onChange={(event) => changeDeliveryDocument(job.id, row.key, { date: event.target.value }, setDemo)}/></td>
        <td className="px-3 py-2"><input disabled={disabled} className={controlClass} value={record?.comment ?? ""} placeholder="선택 입력" onChange={(event) => changeDeliveryDocument(job.id, row.key, { comment: event.target.value }, setDemo)}/></td>
      </tr>; })}</tbody></table></div>
  </div>; })}{auditLogs.length > 0 && <div className="rounded-lg border"><div className="border-b bg-slate-50 px-4 py-3"><p className="text-sm font-semibold">날짜 변경 처리이력</p></div><div className="divide-y">{auditLogs.slice().reverse().map((log) => <div key={log.id} className="grid gap-1 px-4 py-3 text-sm md:grid-cols-[150px_1fr_auto]"><div><p className="font-semibold">{log.field}</p><p className="text-xs text-slate-500">{jobs.find((job) => job.id === log.jobId)?.jobNo}</p></div><div><p><span className="text-slate-500">변경 전 </span>{log.before} <span className="mx-1 text-slate-300">→</span> <span className="text-slate-500">변경 후 </span>{log.after}</p><p className="mt-1 text-xs text-slate-600">사유: {log.reason}</p></div><div className="text-xs text-slate-500 md:text-right"><p>{log.actor}</p><p>{log.occurredAt}</p></div></div>)}</div></div>}</div>;
}

function DateOverrideFields({ job, issueDate, decisionDate, deliveryDate, reasons, actor, dateRules, setDemo }: { job: Job; issueDate: string; decisionDate: string; deliveryDate: string; reasons: DemoState["dateOverrideReasons"]; actor: string; dateRules: DateRules; setDemo: React.Dispatch<React.SetStateAction<DemoState>> }) {
  if (!issueDate) return null;
  const expectedDecision = addKoreanBusinessDays(issueDate, -dateRules.decisionDays); const expectedDelivery = addKoreanBusinessDays(issueDate, dateRules.deliveryDays); const decisionChanged = decisionDate !== expectedDecision; const deliveryChanged = deliveryDate !== expectedDelivery;
  return <div className="grid gap-4 border-b border-blue-100 bg-blue-50/50 p-4 lg:grid-cols-2"><div><Field label="심의일"><input type="date" className={controlClass} value={decisionDate} onChange={(event) => setDemo((current) => ({ ...current, decisionDate: nextKoreanBusinessDay(event.target.value) }))}/></Field><p className="mt-1 text-xs text-slate-500">자동 계산값: {expectedDecision}</p>{decisionChanged && <div className="mt-3 space-y-2"><Field label="심의일 변경 사유"><input className={controlClass} value={reasons.decision} placeholder="필수 입력" onChange={(event) => setDemo((current) => ({ ...current, dateOverrideReasons: { ...current.dateOverrideReasons, decision: event.target.value } }))}/></Field><Button size="sm" variant="outline" disabled={!reasons.decision.trim()} onClick={() => recordDateAudit(job.id, "심의일", expectedDecision, decisionDate, reasons.decision, actor, setDemo)}>변경이력 기록</Button></div>}</div><div><Field label="문서전달확인서 작성일"><input type="date" className={controlClass} value={deliveryDate} onChange={(event) => changeDeliveryDocument(job.id, "deliveryConfirmation", { date: event.target.value }, setDemo)}/></Field><p className="mt-1 text-xs text-slate-500">자동 계산값: {expectedDelivery}</p>{deliveryChanged && <div className="mt-3 space-y-2"><Field label="작성일 변경 사유"><input className={controlClass} value={reasons.delivery[job.id] ?? ""} placeholder="필수 입력" onChange={(event) => setDemo((current) => ({ ...current, dateOverrideReasons: { ...current.dateOverrideReasons, delivery: { ...current.dateOverrideReasons.delivery, [job.id]: event.target.value } } }))}/></Field><Button size="sm" variant="outline" disabled={!reasons.delivery[job.id]?.trim()} onClick={() => recordDateAudit(job.id, "문서전달확인서 작성일", expectedDelivery, deliveryDate, reasons.delivery[job.id], actor, setDemo)}>변경이력 기록</Button></div>}</div></div>;
}

function ReadinessCard({ label, value, alert = false }: { label: string; value: string; alert?: boolean }) { return <div className={`rounded-md border p-3 ${alert ? "border-amber-300 bg-amber-50" : "bg-white"}`}><p className="text-xs text-slate-500">{label}</p><p className={`mt-1 text-sm font-semibold ${alert ? "text-amber-900" : "text-slate-900"}`}>{value}</p></div>; }
function PackagePreflight({ jobs, certificates, documents }: { jobs: Job[]; certificates: DemoCertificate; documents: DemoDeliveryDocuments }) {
  const issues = packageDocumentIssues(jobs, documents, deliveryDocumentRows);
  return <div className="mb-5 space-y-3 rounded-lg border bg-card p-4 text-card-foreground"><h4 className="text-sm font-semibold">패키지 생성 전 업무 점검</h4><p className="text-xs text-muted-foreground">문서 적용 기준·확인 여부·날짜를 점검합니다. 입력 저장 여부와 실제 양식 파일은 생성 시 서버에서 별도로 확인합니다.</p>{!jobs.length && <p className="text-sm text-amber-700 dark:text-amber-300">연결된 Job이 없습니다.</p>}{jobs.map((job) => {
    const pending = issues.filter((issue) => issue.jobId === job.id);
    const certificate = certificates[job.id];
    const fields = [!certificate?.issueDate?.trim() && "전자본 발행일", !certificate?.certificationNo?.trim() && "인증번호", !certificate?.expiryDate?.trim() && "만료일"].filter(Boolean);
    const dateIssues = certificateDateIssues(certificate);
    return <div key={job.id} className="rounded-md border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><span className="text-sm font-semibold">{job.jobNo} · {job.standard}</span><span className="text-xs text-muted-foreground">{pending.length || fields.length || dateIssues.length ? "입력 확인 필요" : "문서 입력 점검 통과"}</span></div>
      {fields.length > 0 && <p className="mt-2 text-xs text-amber-700 dark:text-amber-300">인증정보 누락: {fields.join(", ")} · <a className="underline underline-offset-2" href="#certificate-information">인증정보 입력 위치</a></p>}
      {dateIssues.length > 0 && <ul className="mt-2 space-y-1 text-xs text-amber-700 dark:text-amber-300">{dateIssues.map(message => <li key={message}><a className="underline underline-offset-2" href="#certificate-information">{message} → 인증정보 확인</a></li>)}</ul>}
      {pending.length > 0 && <ul className="mt-2 space-y-1 text-xs">{pending.map((issue) => <li key={issue.key}><a className="text-amber-700 underline underline-offset-2 dark:text-amber-300" href={`#delivery-${job.id}-${issue.key}`}>{issue.label} · {issue.reason} → 입력 위치</a></li>)}</ul>}
      <p className="mt-2 text-xs text-muted-foreground">원본 추적: {certificate?.originalSentAt || "송부일 미입력"} · {certificate?.trackingNumber || "운송장 미입력"} (인증 완료 기준과 별도)</p>
    </div>;
  })}</div>;
}


function createAuditLog(category: DateAuditLog["category"], jobId: string, field: string, before: string, after: string, reason: string, actor: string): DateAuditLog { return { id: `${Date.now()}-${Math.random().toString(36).slice(2)}`, category, jobId, field, before, after, reason, actor, occurredAt: new Date().toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) }; }
function recordDateAudit(jobId: string, field: string, before: string, after: string, reason: string, actor: string, setDemo: React.Dispatch<React.SetStateAction<DemoState>>) { setDemo((current) => ({ ...current, dateAuditLogs: [...current.dateAuditLogs, createAuditLog("정정", jobId, field, before, after, reason, actor)] })); }

function applyCorrectionValue(current: DemoState, key: string, value: string): DemoState {
  if (key === "review.result") return { ...current, review: { ...current.review, result: value as DemoReview["result"] } };
  if (key === "review.comment") return { ...current, review: { ...current.review, comment: value } };
  if (key === "review.verificationResult") return { ...current, review: { ...current.review, verificationResult: value as DemoReview["verificationResult"] } };
  if (key === "invoiceNo") return { ...current, invoiceNo: value };
  if (key === "invoiceIssuedAt" || key === "paymentConfirmedAt" || key === "decisionDate" || key === "finalApprovalDate") return { ...current, [key]: nextKoreanBusinessDay(value) };
  const [field, jobId] = key.split(":");
  if (!jobId || !current.certificates[jobId]) return current;
  const adjusted = ["expiryDate", "draftIssuedAt", "originalSentAt"].includes(field) ? nextKoreanBusinessDay(value) : value;
  return { ...current, certificates: { ...current.certificates, [jobId]: { ...current.certificates[jobId], [field]: adjusted } } };
}

function changeDeliveryDocument(jobId: string, key: DeliveryDocumentKey, patch: Partial<DemoDeliveryDocuments[string][DeliveryDocumentKey]>, setDemo: React.Dispatch<React.SetStateAction<DemoState>>) { const adjusted = patch.date ? { ...patch, date: nextKoreanBusinessDay(patch.date) } : patch; setDemo((current) => ({ ...current, deliveryDocuments: { ...current.deliveryDocuments, [jobId]: { ...current.deliveryDocuments[jobId], [key]: { ...current.deliveryDocuments[jobId][key], ...adjusted } } } })); }
function PackageDateConsistency({ jobs, context }: { jobs: Job[]; context: Parameters<typeof packageDateDifferences>[1] }) {
  const differences = packageDateDifferences(jobs, context);
  if (!differences.length) return null;
  return <div className="mb-5 rounded-lg border border-amber-300 p-4"><p className="text-sm font-semibold">문서 날짜 대조 필요</p><p className="mt-1 text-xs text-muted-foreground">업무 일정과 문서전달확인서의 기록일이 다릅니다. 날짜의 의미가 다르면 그대로 유지해도 됩니다. 자동 수정하거나 다운로드를 차단하지 않습니다.</p><ul className="mt-3 space-y-2 text-sm">{differences.map((item) => <li key={`${item.jobId}-${item.key}`}><a className="underline" href={`#delivery-${item.jobId}-${item.key}`}>{jobs.find((job) => job.id === item.jobId)?.jobNo} · {item.label}</a>: 업무 일정 {item.sourceDate} / 문서 기록일 {item.documentDate}</li>)}</ul></div>;
}
function changeExamSchedule(jobId: string, patch: Partial<ExamSchedule[string]>, receivedAt: string, setDemo: React.Dispatch<React.SetStateAction<DemoState>>) { setDemo((current) => { const schedule = { ...current.examSchedules[jobId], ...patch }; if ("providerType" in patch || "trainingEndDate" in patch) { if (schedule.providerType === "NON_PARTNER") { schedule.examNoticeDate = addKoreanBusinessDays(receivedAt, -10); schedule.examDate = addKoreanBusinessDays(receivedAt, -5); } else if (schedule.trainingEndDate) { schedule.examDate = schedule.trainingEndDate; schedule.examNoticeDate = addKoreanBusinessDays(schedule.trainingEndDate, -5); } else { schedule.examNoticeDate = ""; schedule.examDate = ""; } } const jobDocuments = current.deliveryDocuments[jobId]; return { ...current, examSchedules: { ...current.examSchedules, [jobId]: schedule }, deliveryDocuments: { ...current.deliveryDocuments, [jobId]: { ...jobDocuments, examNotice: { ...jobDocuments.examNotice, received: Boolean(schedule.examNoticeDate), date: schedule.examNoticeDate }, examAnswers: { ...jobDocuments.examAnswers, received: Boolean(schedule.examDate), date: schedule.examDate } } } }; }); }
function changeIssueDate(jobId: string, value: string, dateRules: DateRules, setDemo: React.Dispatch<React.SetStateAction<DemoState>>) { const issueDate = nextKoreanBusinessDay(value); setDemo((current) => ({ ...current, decisionDate: addKoreanBusinessDays(issueDate, -dateRules.decisionDays), certificates: { ...current.certificates, [jobId]: { ...current.certificates[jobId], issueDate } }, deliveryDocuments: { ...current.deliveryDocuments, [jobId]: { ...current.deliveryDocuments[jobId], certificate: { ...current.deliveryDocuments[jobId].certificate, received: true, date: issueDate }, deliveryConfirmation: { ...current.deliveryDocuments[jobId].deliveryConfirmation, received: true, date: addKoreanBusinessDays(issueDate, dateRules.deliveryDays) } } } })); }
function changeCertificate(jobId: string, field: keyof DemoCertificate[string], value: string, dateRules: DateRules, setDemo: React.Dispatch<React.SetStateAction<DemoState>>) { if (field === "issueDate") { changeIssueDate(jobId, value, dateRules, setDemo); return; } const adjusted = ["draftIssuedAt", "expiryDate", "originalSentAt"].includes(field) ? nextKoreanBusinessDay(value) : value; setDemo((current) => ({ ...current, certificates: { ...current.certificates, [jobId]: { ...current.certificates[jobId], [field]: adjusted } } })); }
function changeAssessment(jobId: string, item: string, value: AssessmentResult, setDemo: React.Dispatch<React.SetStateAction<DemoState>>) { setDemo((current) => ({ ...current, assessment: { ...current.assessment, [jobId]: { ...current.assessment[jobId], [item]: value } } })); }
function changePanelMember(index: number, patch: Partial<DemoPanelMember>, setDemo: React.Dispatch<React.SetStateAction<DemoState>>) { setDemo((current) => ({ ...current, panelMembers: current.panelMembers.map((member, memberIndex) => memberIndex === index ? { ...member, ...patch, ...(patch.selected === false ? { decision: "" as const, comment: "" } : {}) } : member) })); }
function changeEnglishText(field: "reviewComment" | "verificationComment", value: string, setDemo: React.Dispatch<React.SetStateAction<DemoState>>) { setDemo((current) => ({ ...current, englishText: { ...current.englishText, [field]: value } })); }
function changeEnglishPanelComment(name: string, value: string, setDemo: React.Dispatch<React.SetStateAction<DemoState>>) { setDemo((current) => ({ ...current, englishText: { ...current.englishText, panelComments: { ...current.englishText.panelComments, [name]: value } } })); }
function changeEnglishDecisionComment(jobId: string, value: string, setDemo: React.Dispatch<React.SetStateAction<DemoState>>) { setDemo((current) => ({ ...current, englishText: { ...current.englishText, decisionComments: { ...current.englishText.decisionComments, [jobId]: value } } })); }
function DocumentButtons({ document, enabled, setNotice, onWord }: { document: ReturnType<typeof buildDocuments>[number]; enabled: boolean; setNotice: (message: string) => void; onWord?: () => void | Promise<void> }) { if (!enabled) return <span className="text-xs text-slate-400">생성 제외</span>; return <div className="flex flex-wrap gap-2">{onWord ? <DocumentDownloadButton label="DOCX" task={async () => { await onWord(); }} setNotice={setNotice} successMessage="실제 DOCX 파일을 확인하고 다운로드를 요청했습니다."/> : <span className="self-center text-xs text-slate-500">개발용 요약</span>}<Button size="sm" variant="outline" onClick={() => { try { printAsPdf(document.title, document.html); setNotice("개발용 미리보기입니다. 공식 DOCX 변환 PDF가 아니며 생성 완료 증거로 사용하지 않습니다."); } catch { setNotice("미리보기 창이 차단되었습니다. 이 사이트의 팝업을 허용하세요."); } }}><Printer/>개발용 미리보기·인쇄</Button></div>; }
function CertificateField({ label, value = "", type = "text", placeholder, onChange }: { label: string; value?: string; type?: string; placeholder?: string; onChange: (value: string) => void }) { return <Field label={label}><input type={type} className={controlClass} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)}/></Field>; }
function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) { return <section className="rounded-lg border bg-white shadow-sm"><div className="border-b px-5 py-4"><h3 className="font-semibold">{title}</h3>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div><div className="p-5">{children}</div></section>; }
function Summary({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1.5 text-sm font-semibold text-slate-900">{value}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1.5 text-sm font-medium text-slate-900">{value}</dd></div>; }
