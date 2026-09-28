import type { AccreditationTrack, ApplicationStatus, ApplicationType, BusinessArea } from "@/types/certification";
import type { NumberingScheme } from "@/lib/numbering-rules";

export const PROTOTYPE_APPLICATIONS_KEY = "certification-prototype-applications";

export interface PrototypeApplicationRecord {
  id: string;
  candidateId?: string;
  jobId?: string;
  applicationNo: string;
  receivedAt: string;
  candidateName: string;
  candidateNameEn?: string;
  candidateBirthDate?: string;
  candidateNationality?: string;
  candidateEmail?: string;
  candidatePhone?: string;
  businessArea: BusinessArea;
  scheme?: NumberingScheme;
  accreditationTrack: AccreditationTrack;
  accreditationHidden: boolean;
  applicationType: ApplicationType;
  managementNo: number;
  jobNo: string;
  standard: string;
  grade: string;
  partnerCompany: string;
  primaryOwner: string;
  status: "INTAKE_REVIEW";
  createdAt: string;
  workflow?: PrototypeWorkflowSnapshot;
}

export type PrototypeWorkflowStage = "DOCUMENT_REVIEW" | "INVOICE_PENDING" | "PAYMENT_PENDING" | "DECISION_PENDING" | "CERTIFICATE_DRAFT_PENDING" | "CERTIFICATION_INFO_PENDING" | "ORIGINAL_DELIVERY_PENDING" | "PACKAGE_READY" | "COMPLETED";

export interface PrototypeWorkflowSnapshot {
  stage?: PrototypeWorkflowStage;
  invoiceNo?: string;
  invoiceAmount?: string;
  invoiceIssuedAt?: string;
  paidAmount?: string;
  paymentConfirmedAt?: string;
  generated?: boolean;
  certificates?: Record<string, { certificationNo?: string; draftIssuedAt?: string; issueDate?: string; expiryDate?: string; originalSentAt?: string; trackingNumber?: string }>;
}

export const prototypeWorkflowLabels: Record<PrototypeWorkflowStage, string> = {
  DOCUMENT_REVIEW: "서류검토",
  INVOICE_PENDING: "인보이스 발행 대기",
  PAYMENT_PENDING: "입금 확인 대기",
  DECISION_PENDING: "인증심의 대기",
  CERTIFICATE_DRAFT_PENDING: "인증서 초안 대기",
  CERTIFICATION_INFO_PENDING: "전자본 발행 대기",
  ORIGINAL_DELIVERY_PENDING: "원본 송부 대기",
  PACKAGE_READY: "패키지 생성 대기",
  COMPLETED: "완료",
};

export function prototypeCandidateId(record: PrototypeApplicationRecord) { return `candidate-${record.id}`; }
export function prototypeJobId(record: PrototypeApplicationRecord) { return `job-${record.id}`; }

export function readPrototypeWorkflow(record: PrototypeApplicationRecord): PrototypeWorkflowSnapshot {
  if (record.workflow) return record.workflow;
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(`certification-demo:v4:${record.id}`) ?? "{}") as PrototypeWorkflowSnapshot;
  } catch {
    return {};
  }
}

export function prototypeApplicationStatus(workflow: PrototypeWorkflowSnapshot): ApplicationStatus {
  if (!workflow.stage) return "INTAKE_REVIEW";
  switch (workflow.stage) {
    case "DOCUMENT_REVIEW": return "DOCUMENT_REVIEW";
    case "INVOICE_PENDING": return "INVOICE_PENDING";
    case "PAYMENT_PENDING": return "PAYMENT_PENDING";
    case "DECISION_PENDING": return "DECISION_PENDING";
    case "COMPLETED": return "COMPLETED";
    default: return "PARTIALLY_COMPLETED";
  }
}

export function findPrototypeByCandidateId(id: string) {
  return readPrototypeApplications().find((record) => prototypeCandidateId(record) === id);
}

export function findPrototypeByJobId(id: string) {
  return readPrototypeApplications().find((record) => prototypeJobId(record) === id);
}

export function readPrototypeApplications(): PrototypeApplicationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(PROTOTYPE_APPLICATIONS_KEY) ?? "[]") as PrototypeApplicationRecord[];
  } catch {
    return [];
  }
}

export function savePrototypeApplication(record: PrototypeApplicationRecord) {
  const records = readPrototypeApplications();
  window.localStorage.setItem(PROTOTYPE_APPLICATIONS_KEY, JSON.stringify([record, ...records]));
}
