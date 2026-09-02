import type { CertificationApplication, Invoice, PackageDocument } from "@/types/certification";

export const businessAreaLabels = { ISO: "ISO 경영시스템 심사원", K_BEAUTY: "K-Beauty 전문가 자격" } as const;
export const accreditationLabels = { ACCREDITED: "인정", NON_ACCREDITED: "비인정" } as const;
export const applicationStatusLabels = {
  INTAKE_REVIEW: "기본정보 확인 중",
  DOCUMENT_REVIEW: "서류검토 중",
  SUPPLEMENT_PENDING: "보완자료 대기",
  INVOICE_PENDING: "인보이스 발행 대기",
  PAYMENT_PENDING: "입금 확인 대기",
  DECISION_PENDING: "인증심의 대기",
  PARTIALLY_COMPLETED: "일부 완료",
  COMPLETED: "완료",
  CANCELLED: "신청 취소",
} as const;

export const applications: CertificationApplication[] = [
  {
    id: "app-001", applicationNo: "APP-ISO-2026-081", candidateId: "cand-001", businessArea: "ISO", accreditationTrack: "ACCREDITED", applicationType: "최초", receivedAt: "2026-08-28", registeredAt: "2026-08-29 09:20", partnerCompany: "한국품질파트너스", status: "DOCUMENT_REVIEW", managementNoFrom: 1293, managementNoTo: 1294, jobIds: ["job-001", "job-005"], primaryOwner: "김담당", dropboxFolderName: "1293~1294 홍길동 (LA 9001, A 14001 최초)", dropboxPath: "/GPC/ISO/2026/1293~1294 홍길동 (LA 9001, A 14001 최초)", documentsStored: true, packageStatus: "NOT_READY", invoiceIds: [],
  },
  {
    id: "app-002", applicationNo: "APP-KB-2026-044", candidateId: "cand-002", businessArea: "K_BEAUTY", accreditationTrack: "ACCREDITED", applicationType: "최초", receivedAt: "2026-08-25", registeredAt: "2026-08-26 10:10", partnerCompany: "케이뷰티전문가연합회", status: "PAYMENT_PENDING", managementNoFrom: 1171, managementNoTo: 1172, jobIds: ["job-007", "job-006"], primaryOwner: "오실무", dropboxFolderName: "1171~1172 김철수 (M 스킨케어, PM SMP 최초)", dropboxPath: "/GPC/K-Beauty/2026/1171~1172 김철수 (M 스킨케어, PM SMP 최초)", documentsStored: true, packageStatus: "NOT_READY", invoiceIds: ["invoice-001"],
  },
  {
    id: "app-003", applicationNo: "APP-ISO-2026-073", candidateId: "cand-003", businessArea: "ISO", accreditationTrack: "NON_ACCREDITED", applicationType: "갱신", receivedAt: "2026-08-15", registeredAt: "2026-08-16 14:30", partnerCompany: "직접접수", status: "PARTIALLY_COMPLETED", managementNoFrom: 1288, managementNoTo: 1288, jobIds: ["job-003"], primaryOwner: "김담당", dropboxFolderName: "1288 이영희 (LA 45001 갱신)", dropboxPath: "/GPC/ISO/2026/1288 이영희 (LA 45001 갱신)", documentsStored: true, packageStatus: "READY", invoiceIds: ["invoice-002"],
  },
  {
    id: "app-004", applicationNo: "APP-KB-2026-039", candidateId: "cand-004", businessArea: "K_BEAUTY", accreditationTrack: "NON_ACCREDITED", applicationType: "최초", receivedAt: "2026-08-10", registeredAt: "2026-08-11 11:00", partnerCompany: "뷰티교육센터", status: "COMPLETED", managementNoFrom: 1168, managementNoTo: 1168, jobIds: ["job-008"], primaryOwner: "정실무", dropboxFolderName: "1168 박민수 (A 스킨케어 최초)", dropboxPath: "/GPC/K-Beauty/2026/1168 박민수 (A 스킨케어 최초)", documentsStored: true, packageStatus: "GENERATED", invoiceIds: ["invoice-003"],
  },
];

export const invoices: Invoice[] = [
  { id: "invoice-001", invoiceNo: "INV-2026-0817", recipientType: "PARTNER", recipientName: "케이뷰티전문가연합회", copiedTo: ["김철수"], jobIds: ["job-007", "job-006"], amount: 900000, issuedAt: "2026-08-29", paymentStatus: "UNPAID" },
  { id: "invoice-002", invoiceNo: "INV-2026-0811", recipientType: "INDIVIDUAL", recipientName: "이영희", copiedTo: [], jobIds: ["job-003"], amount: 440000, issuedAt: "2026-08-18", paymentStatus: "PAID", paidAt: "2026-08-19", payerName: "이영희" },
  { id: "invoice-003", invoiceNo: "INV-2026-0804", recipientType: "PARTNER", recipientName: "뷰티교육센터", copiedTo: ["박민수"], jobIds: ["job-008"], amount: 550000, issuedAt: "2026-08-13", paymentStatus: "PAID", paidAt: "2026-08-14", payerName: "뷰티교육센터" },
];

export const packageDocuments: PackageDocument[] = [
  { id: "pkg-1", jobId: "job-008", type: "DOCUMENT_REVIEW", title: "K-Beauty 서류검토서", formats: ["WORD", "PDF"], status: "GENERATED", templateVersion: "KB-DR v1" },
  { id: "pkg-2", jobId: "job-008", type: "CERTIFICATION_DECISION_REPORT", title: "K-Beauty 인증결정보고서", formats: ["WORD", "PDF"], status: "GENERATED", templateVersion: "KB-CDR v1" },
  { id: "pkg-3", jobId: "job-008", type: "DELIVERY_CONFIRMATION", title: "문서전달확인서", formats: ["WORD", "PDF"], status: "GENERATED", templateVersion: "KB-DD v1" },
  { id: "pkg-4", jobId: "job-008", type: "CERTIFICATE", title: "스킨케어 인증서 Rev.0", formats: ["PDF"], status: "GENERATED", templateVersion: "Certificate v1" },
  { id: "pkg-5", jobId: "job-003", type: "DOCUMENT_REVIEW", title: "ISO 서류검토서", formats: ["WORD", "PDF"], status: "READY", templateVersion: "ISO-DR v1" },
  { id: "pkg-6", jobId: "job-003", type: "CERTIFICATION_DECISION_REPORT", title: "ISO 인증결정보고서", formats: ["WORD", "PDF"], status: "READY", templateVersion: "ISO-CDR v1" },
];

export function getApplication(id: string) { return applications.find((application) => application.id === id); }
export function getApplicationInvoices(application: CertificationApplication) { return invoices.filter((invoice) => application.invoiceIds.includes(invoice.id)); }
