import type { AuditLog, Candidate, CertificationCase, CertificationState, Job, ProcessingCycle, ProcessingStatus } from "@/types/certification";
export const statusLabels: Record<ProcessingStatus, string> = { DOCUMENT_REVIEW: "1차 서류검토 대기", INVOICE_PENDING: "인보이스 발행 대기", PAYMENT_PENDING: "입금 확인 대기", DECISION_PENDING: "인증심의 대기", SUPPLEMENT_PENDING: "보완 대기", CERTIFICATE_DRAFT_PENDING: "인증서 초안 대기", CERTIFICATION_INFO_PENDING: "인증번호 부여 대기", DELIVERY_PENDING: "인증서 발행·전달 대기", COMPLETED: "완료", APPLICATION_CANCELLED: "신청 취소" };
export const certificationStateLabels: Record<CertificationState, string> = { ACTIVE: "인증 유효", SUSPENDED: "인증 정지", WITHDRAWN: "인증 철회", NONE: "인증 전" };
export const candidates: Candidate[] = [
  { id: "cand-001", name: "홍길동", nameEn: "Hong, Gil Dong", birthDate: "1988-03-12", nationality: "대한민국", phone: "010-2345-7812", email: "gildong.hong@example.com", address: "서울특별시 금천구 가산디지털1로 00", jobIds: ["job-001", "job-005"] },
  { id: "cand-002", name: "김철수", nameEn: "Kim, Cheol Su", birthDate: "1985-11-04", nationality: "대한민국", phone: "010-8754-2210", email: "cheolsu.kim@example.com", address: "경기도 성남시 분당구 판교로 00", jobIds: ["job-002", "job-006", "job-007"] },
  { id: "cand-003", name: "이영희", nameEn: "Lee, Young Hee", birthDate: "1990-07-21", nationality: "대한민국", phone: "010-4432-1098", email: "younghee.lee@example.com", address: "인천광역시 연수구 센트럴로 00", jobIds: ["job-003"] },
  { id: "cand-004", name: "박민수", nameEn: "Park, Min Su", birthDate: "1982-01-18", nationality: "대한민국", phone: "010-7721-4405", email: "minsu.park@example.com", address: "부산광역시 해운대구 센텀로 00", jobIds: ["job-004", "job-008"] },
];
export const jobs: Job[] = [
  { id: "job-001", jobNo: "QMS-260041", candidateId: "cand-001", partnerCompany: "한국품질파트너스", standard: "ISO 9001", currentGrade: "Lead Auditor", certificationState: "NONE", primaryOwner: "김담당", cycleIds: ["cycle-001"], currentCycleId: "cycle-001" },
  { id: "job-002", jobNo: "EMS-260017", candidateId: "cand-002", partnerCompany: "에코인증지원", standard: "ISO 14001", currentGrade: "Auditor", certificationState: "NONE", primaryOwner: "오실무", cycleIds: ["cycle-002"], currentCycleId: "cycle-002" },
  { id: "job-003", jobNo: "OHS-240089", candidateId: "cand-003", partnerCompany: "세이프티코리아", standard: "ISO 45001", currentGrade: "Lead Auditor", certificationState: "ACTIVE", primaryOwner: "김담당", cycleIds: ["cycle-003a", "cycle-003"], currentCycleId: "cycle-003", certificationNo: "24-4-0089", certificationIssueDate: "2024-06-28", certificationExpiryDate: "2027-06-27" },
  { id: "job-004", jobNo: "ISMS-230026", candidateId: "cand-004", partnerCompany: "직접접수", standard: "ISO/IEC 27001", currentGrade: "Auditor", certificationState: "ACTIVE", primaryOwner: "정실무", cycleIds: ["cycle-004"], certificationNo: "23-7-0026", certificationIssueDate: "2023-05-12", certificationExpiryDate: "2026-05-11" },
  { id: "job-005", jobNo: "EMS-250031", candidateId: "cand-001", partnerCompany: "에코인증지원", standard: "ISO 14001", currentGrade: "Auditor", certificationState: "SUSPENDED", primaryOwner: "오실무", cycleIds: ["cycle-005"], certificationNo: "25-3-0031", certificationIssueDate: "2025-03-14", certificationExpiryDate: "2028-03-13" },
  { id: "job-006", jobNo: "SEM260551", managementNo: 1172, applicationId: "app-002", candidateId: "cand-002", businessArea: "K_BEAUTY", accreditationTrack: "ACCREDITED", partnerCompany: "케이뷰티전문가연합회", standard: "SMP", currentGrade: "Pre-master", certificationState: "NONE", primaryOwner: "오실무", cycleIds: [] },
  { id: "job-007", jobNo: "SKI260269", managementNo: 1171, applicationId: "app-002", candidateId: "cand-002", businessArea: "K_BEAUTY", accreditationTrack: "ACCREDITED", partnerCompany: "케이뷰티전문가연합회", standard: "스킨케어", currentGrade: "Master", certificationState: "NONE", primaryOwner: "오실무", cycleIds: [] },
  { id: "job-008", jobNo: "SKI260266", managementNo: 1168, applicationId: "app-004", candidateId: "cand-004", businessArea: "K_BEAUTY", accreditationTrack: "NON_ACCREDITED", partnerCompany: "뷰티교육센터", standard: "스킨케어", currentGrade: "Auditor", certificationState: "ACTIVE", primaryOwner: "정실무", cycleIds: [], certificationNo: "KB-26A30081", certificationIssueDate: "2026-08-20", certificationExpiryDate: "2029-08-19", certificateRevision: 0, certificateFileName: "박민수_스킨케어_인증서_Rev.0.pdf", trackingNumber: "1234-5678-9012" },
];
export const processingCycles: ProcessingCycle[] = [
  { id: "cycle-001", jobId: "job-001", sequence: 1, applicationType: "최초", applicationDate: "2026-08-28", status: "DOCUMENT_REVIEW", plannedIssueDate: "2026-09-18", documentReviewDate: "2026-09-04", decisionDate: "2026-09-11", deliveryDate: "2026-09-23", certificateDraftStatus: "미작성", appliedRule: "업무일자 규칙 v1" },
  { id: "cycle-002", jobId: "job-002", sequence: 1, applicationType: "최초", applicationDate: "2026-08-27", status: "SUPPLEMENT_PENDING", plannedIssueDate: "2026-09-15", documentReviewDate: "2026-09-01", decisionDate: "2026-09-08", deliveryDate: "2026-09-18", invoiceNo: "INV-2026-0817", invoiceAmount: 550000, invoiceIssuedAt: "2026-08-29", certificateDraftStatus: "미작성", appliedRule: "업무일자 규칙 v1" },
  { id: "cycle-003a", jobId: "job-003", sequence: 1, applicationType: "최초", applicationDate: "2024-06-03", status: "COMPLETED", plannedIssueDate: "2024-06-28", documentReviewDate: "2024-06-14", decisionDate: "2024-06-21", deliveryDate: "2024-07-03", completedAt: "2024-07-03", appliedRule: "이전 데이터" },
  { id: "cycle-003", jobId: "job-003", sequence: 2, applicationType: "갱신", applicationDate: "2026-08-25", status: "DELIVERY_PENDING", plannedIssueDate: "2026-08-29", documentReviewDate: "2026-08-15", decisionDate: "2026-08-22", deliveryDate: "2026-09-03", invoiceNo: "INV-2026-0811", invoiceAmount: 440000, invoiceIssuedAt: "2026-08-16", paymentConfirmedAt: "2026-08-19", certificateDraftStatus: "확인완료", appliedRule: "업무일자 규칙 v1" },
  { id: "cycle-004", jobId: "job-004", sequence: 1, applicationType: "최초", applicationDate: "2023-04-10", status: "COMPLETED", plannedIssueDate: "2023-05-12", documentReviewDate: "2023-04-28", decisionDate: "2023-05-05", deliveryDate: "2023-05-17", completedAt: "2023-05-17", appliedRule: "이전 데이터" },
  { id: "cycle-005", jobId: "job-005", sequence: 1, applicationType: "최초", applicationDate: "2025-02-03", status: "COMPLETED", plannedIssueDate: "2025-03-14", documentReviewDate: "2025-02-28", decisionDate: "2025-03-07", deliveryDate: "2025-03-19", completedAt: "2025-03-19", appliedRule: "이전 데이터" },
];
export const auditLogs: AuditLog[] = [
  { id: "1", jobId: "job-001", cycleId: "cycle-001", occurredAt: "2026-08-28 14:20", actor: "김담당", action: "처리 회차 등록", detail: "1회차 · 최초" },
  { id: "2", jobId: "job-001", cycleId: "cycle-001", occurredAt: "2026-08-28 14:22", actor: "시스템", action: "업무일자 자동 계산", detail: "인증발행일 2026-09-18 기준" },
  { id: "3", jobId: "job-002", cycleId: "cycle-002", occurredAt: "2026-08-29 10:13", actor: "오실무", action: "보완 요청", detail: "교육 증빙 추가 제출 필요" },
];
export const notificationItems = [
  { id: "n1", tone: "amber", title: "보완자료 접수 확인 필요", detail: "EMS-260017 · 김철수 · 교육 증빙", date: "오늘" },
  { id: "n2", tone: "blue", title: "문서전달 예정일 임박", detail: "OHS-240089 · 이영희 · 2026-09-03", date: "D-4" },
  { id: "n3", tone: "slate", title: "서류검토 예정", detail: "QMS-260041 · 홍길동 · 2026-09-04", date: "D-5" },
];
export function getCandidate(id: string) { return candidates.find((item) => item.id === id); }
export function getJob(id: string) { return jobs.find((item) => item.id === id); }
export function getCycle(id: string) { return processingCycles.find((item) => item.id === id); }
export function getCurrentCycle(job: Job) { return job.currentCycleId ? getCycle(job.currentCycleId) : undefined; }
export const certificationCases: CertificationCase[] = jobs.flatMap((job) => { const candidate = getCandidate(job.candidateId); const cycle = getCurrentCycle(job) ?? processingCycles.find((item) => item.jobId === job.id); if (!candidate || !cycle) return []; return [{ id: job.id, candidateName: candidate.name, registrationNo: job.jobNo, applicationType: cycle.applicationType, standard: job.standard, grade: job.currentGrade, applicationDate: cycle.applicationDate, status: cycle.status }]; });
