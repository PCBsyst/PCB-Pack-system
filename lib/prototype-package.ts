import type { Candidate, CertificationApplication, Job } from "@/types/certification";

export type DemoReview = { result: "적합" | "보완필요" | "부적합"; reviewer: string; reviewedAt: string; comment: string; verifier: string; verifiedAt: string; verificationResult: "확인" | "재검토요청"; verificationComment: string };
export type AssessmentResult = "" | "적합" | "부적합" | "해당없음";
export type DemoAssessment = Record<string, Record<string, AssessmentResult>>;
export type DemoPanelMember = { name: string; selected: boolean; decision: "" | "승인" | "불승인" | "재승인"; comment: string };
export type DemoDecision = Record<string, { result: "" | "승인" | "불승인" | "재승인"; comment: string }>;
export type DemoCertificate = Record<string, { certificationNo: string; draftIssuedAt: string; issueDate: string; expiryDate: string; originalSentAt: string; trackingNumber: string }>;
export type DocumentLanguage = "KR" | "EN";
export type DemoEnglishText = { reviewComment: string; verificationComment: string; panelComments: Record<string, string>; decisionComments: Record<string, string> };
export type PackageContext = { application: CertificationApplication; candidate: Candidate; jobs: Job[]; review: DemoReview; assessment: DemoAssessment; panelMembers: DemoPanelMember[]; decisions: DemoDecision; certificates: DemoCertificate; decisionDate: string; finalApprover: string; finalApprovalDate: string; englishText: DemoEnglishText };

function escapeHtml(value: string | number | undefined) {
  return String(value ?? "-").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function documentShell(title: string, body: string) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{size:A4;margin:18mm}body{font-family:"Malgun Gothic","Noto Sans KR",sans-serif;color:#111;font-size:11pt;line-height:1.6}h1{text-align:center;font-size:20pt;margin:0 0 24px}h2{font-size:13pt;margin:24px 0 8px;border-bottom:1px solid #555;padding-bottom:5px}table{width:100%;border-collapse:collapse;margin:8px 0 18px}th,td{border:1px solid #777;padding:8px;text-align:left;vertical-align:top}th{width:22%;background:#f2f4f7}.note{margin-top:28px;color:#555;font-size:9pt}</style></head><body><h1>${escapeHtml(title)}</h1>${body}<p class="note">개발용 가상 데이터로 생성된 프로토타입 문서이며 공식 기록이 아닙니다.</p></body></html>`;
}

function commonRows(context: PackageContext, job: Job) {
  return `<table><tr><th>후보자</th><td>${escapeHtml(context.candidate.name)}</td><th>신청번호</th><td>${escapeHtml(context.application.applicationNo)}</td></tr><tr><th>Job No.</th><td>${escapeHtml(job.jobNo)}</td><th>관리 No.</th><td>${escapeHtml(job.managementNo ?? context.application.managementNoFrom)}</td></tr><tr><th>세부 분야</th><td>${escapeHtml(job.standard)}</td><th>등급</th><td>${escapeHtml(job.currentGrade)}</td></tr></table>`;
}

function buildKoreanDocuments(context: PackageContext, job: Job) {
  const decision = context.decisions[job.id];
  const certificate = context.certificates[job.id];
  const assessmentRows = Object.entries(context.assessment[job.id] ?? {}).map(([item, result]) => `<tr><th>${escapeHtml(item)}</th><td>${escapeHtml(result)}</td></tr>`).join("");
  const panelRows = context.panelMembers.filter((member) => member.selected).map((member) => `<tr><td>${escapeHtml(member.name)}</td><td>${escapeHtml(member.decision)}</td><td>${escapeHtml(member.comment || "-")}</td></tr>`).join("");
  return [
    { fileName: `${job.jobNo}_서류검토서.doc`, title: "서류검토서", html: documentShell("서류검토서", `${commonRows(context, job)}<h2>1차 검토</h2><table><tr><th>종합 결과</th><td>${escapeHtml(context.review.result)}</td></tr><tr><th>검토 의견</th><td>${escapeHtml(context.review.comment)}</td></tr><tr><th>검토자</th><td>${escapeHtml(context.review.reviewer)}</td></tr><tr><th>검토일</th><td>${escapeHtml(context.review.reviewedAt)}</td></tr></table><h2>2차 검증</h2><table><tr><th>검증 결과</th><td>${escapeHtml(context.review.verificationResult)}</td></tr><tr><th>검증 의견</th><td>${escapeHtml(context.review.verificationComment)}</td></tr><tr><th>검증인</th><td>${escapeHtml(context.review.verifier)}</td></tr><tr><th>검증일</th><td>${escapeHtml(context.review.verifiedAt)}</td></tr></table>`) },
    { fileName: `${job.jobNo}_인증결정보고서.doc`, title: "인증결정보고서", html: documentShell("인증결정보고서", `${commonRows(context, job)}<h2>개인인증 문서 및 기록 평가</h2><table>${assessmentRows}</table><h2>인증패널 결정</h2><table><tr><th>심의위원</th><th>개별 결정</th><th>의견</th></tr>${panelRows}<tr><th>패널 심의일</th><td colspan="2">${escapeHtml(context.decisionDate)}</td></tr></table><h2>대표자 최종 승인</h2><table><tr><th>최종 승인 결과</th><td>${escapeHtml(decision?.result)}</td></tr><tr><th>승인 의견</th><td>${escapeHtml(decision?.comment)}</td></tr><tr><th>최종 승인자</th><td>${escapeHtml(context.finalApprover)}</td></tr><tr><th>최종 승인일</th><td>${escapeHtml(context.finalApprovalDate)}</td></tr><tr><th>인증번호</th><td>${escapeHtml(certificate?.certificationNo)}</td></tr><tr><th>유효기간</th><td>${escapeHtml(certificate ? `${certificate.issueDate} ~ ${certificate.expiryDate}` : "-")}</td></tr></table>`) },
    { fileName: `${job.jobNo}_인증정보_요약.doc`, title: "인증정보 요약", html: documentShell("인증정보 요약", `${commonRows(context, job)}<h2>단계별 발행 정보</h2><table><tr><th>초안 발행일</th><td>${escapeHtml(certificate?.draftIssuedAt)}</td></tr><tr><th>인증번호</th><td>${escapeHtml(certificate?.certificationNo)}</td></tr><tr><th>전자본 PDF 발행일</th><td>${escapeHtml(certificate?.issueDate)}</td></tr><tr><th>만료일</th><td>${escapeHtml(certificate?.expiryDate)}</td></tr><tr><th>원본 송부일</th><td>${escapeHtml(certificate?.originalSentAt)}</td></tr><tr><th>운송장 번호</th><td>${escapeHtml(certificate?.trackingNumber || "미입력")}</td></tr><tr><th>Revision</th><td>Rev.0</td></tr></table>`) },
    { fileName: `${job.jobNo}_문서전달확인서.doc`, title: "문서전달확인서", html: documentShell("문서전달확인서", `${commonRows(context, job)}<h2>전달 기록</h2><table><tr><th>전자본 PDF</th><td>발행 완료</td></tr><tr><th>전자본 발행일</th><td>${escapeHtml(certificate?.issueDate)}</td></tr><tr><th>원본 송부일</th><td>${escapeHtml(certificate?.originalSentAt)}</td></tr><tr><th>운송장 번호</th><td>${escapeHtml(certificate?.trackingNumber || "미입력")}</td></tr><tr><th>담당자</th><td>${escapeHtml(context.application.primaryOwner)}</td></tr></table>`) },
  ];
}

const englishTitles: Record<string, string> = { "서류검토서": "Document Review Report", "인증결정보고서": "Certification Decision Report", "인증정보 요약": "Certification Information", "문서전달확인서": "Document Delivery Confirmation" };
const englishFileNames: Record<string, string> = { "서류검토서": "Document_Review", "인증결정보고서": "Certification_Decision_Report", "인증정보 요약": "Certification_Information", "문서전달확인서": "Document_Delivery_Confirmation" };
const fixedEnglish: Array<[string, string]> = [
  ["개발용 가상 데이터로 생성된 프로토타입 문서이며 공식 기록이 아닙니다.", "Prototype document generated with fictional development data. Not an official record."],
  ["개인인증 문서 및 기록 평가", "Evaluation of Documents and Records"], ["인증패널 결정", "Certification Panel Decision"], ["대표자 최종 승인", "Final Approval by Representative"], ["대표자", "Representative"],
  ["후보자", "Candidate"], ["신청번호", "Application No."], ["관리 No.", "Management No."], ["세부 분야", "Certification Field"], ["등급", "Grade"],
  ["지식 시험", "Knowledge Examination"], ["인성 시험", "Personality Examination"], ["교육 요구사항", "Education Requirements"], ["학력 요구사항", "Academic Requirements"], ["심사이력", "Audit Experience"],
  ["심의위원", "Panel Member"], ["개별 결정", "Individual Decision"], ["패널 심의일", "Panel Decision Date"], ["최종 승인 결과", "Final Approval Result"], ["승인 의견", "Approval Comment"], ["최종 승인자", "Final Approver"], ["최종 승인일", "Final Approval Date"],
  ["검토 결과", "Review Result"], ["종합 결과", "Overall Result"], ["검토 의견", "Review Comment"], ["검토자", "Reviewer"], ["검토일", "Review Date"],
  ["1차 검토", "Primary Review"], ["2차 검증", "Secondary Verification"], ["검증 결과", "Verification Result"], ["검증 의견", "Verification Comment"], ["검증인", "Verifier"], ["검증일", "Verification Date"], ["재검토요청", "Re-review Requested"], ["확인", "Confirmed"],
  ["단계별 발행 정보", "Issuance by Stage"], ["발행 정보", "Issuance Information"], ["초안 발행일", "Draft Issue Date"], ["인증번호", "Certificate No."], ["전자본 PDF 발행일", "Electronic PDF Issue Date"], ["전자본 발행일", "Electronic Issue Date"], ["전자본 PDF", "Electronic PDF"], ["발행 완료", "Issued"], ["인증발행일", "Issue Date"], ["만료일", "Expiry Date"], ["유효기간", "Validity Period"], ["원본 송부일", "Original Dispatch Date"], ["운송장 번호", "Tracking No."],
  ["전달 기록", "Delivery Record"], ["PDF 전달", "PDF Delivery"], ["이메일 전달 완료", "Delivered by Email"], ["전달일", "Delivery Date"], ["원본 추적번호", "Tracking No."], ["담당자", "Person in Charge"], ["미입력", "Not Entered"],
  ["적합", "Conforming"], ["부적합", "Nonconforming"], ["해당없음", "Not Applicable"], ["재승인", "Reapproved"], ["불승인", "Not Approved"], ["승인", "Approved"], ["의견", "Comment"],
];

export function buildDocuments(context: PackageContext, job: Job, language: DocumentLanguage = "KR") {
  const documents = buildKoreanDocuments(context, job);
  if (language === "KR") return documents.map((document) => ({ ...document, fileName: document.fileName.replace(".doc", "_KR.doc") }));
  return documents.map((document) => {
    let html = document.html.replace('lang="ko"', 'lang="en"').replaceAll(context.candidate.name, context.candidate.nameEn || context.candidate.name);
    if (context.review.comment) html = html.replaceAll(context.review.comment, context.englishText.reviewComment || "-");
    if (context.review.verificationComment) html = html.replaceAll(context.review.verificationComment, context.englishText.verificationComment || "-");
    for (const member of context.panelMembers) if (member.comment) html = html.replaceAll(member.comment, context.englishText.panelComments[member.name] || "-");
    const decisionComment = context.decisions[job.id]?.comment;
    if (decisionComment) html = html.replaceAll(decisionComment, context.englishText.decisionComments[job.id] || "-");
    for (const [korean, english] of fixedEnglish) html = html.replaceAll(korean, english);
    const title = englishTitles[document.title] ?? document.title;
    html = html.replaceAll(document.title, title);
    return { fileName: `${job.jobNo}_${englishFileNames[document.title] ?? document.title}_EN.doc`, title, html };
  });
}

export function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = fileName; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadWord(fileName: string, html: string) { downloadBlob(fileName, new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" })); }
export async function downloadDecisionReportDocx(context: PackageContext, job: Job) {
  const response = await fetch("/api/documents/decision-report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ context, job }) });
  if (!response.ok) throw new Error("DOCX 생성에 실패했습니다.");
  const disposition = response.headers.get("Content-Disposition") ?? "";
  const fileName = disposition.match(/filename="([^"]+)"/)?.[1] ?? `${job.jobNo}_인증결정보고서_KR.docx`;
  downloadBlob(fileName, await response.blob());
}
export function printAsPdf(title: string, html: string) {
  const popup = window.open("", "_blank");
  if (!popup) throw new Error("팝업이 차단되었습니다.");
  popup.document.open(); popup.document.write(html.replace("</body>", `<script>document.title=${JSON.stringify(title)};window.onload=()=>window.print();<\/script></body>`)); popup.document.close();
}

function crc32(bytes: Uint8Array) { let crc = 0xffffffff; for (const byte of bytes) { crc ^= byte; for (let index = 0; index < 8; index += 1) crc = (crc >>> 1) ^ (0xedb88320 & -(crc & 1)); } return (crc ^ 0xffffffff) >>> 0; }
function u16(value: number) { return [value & 255, (value >>> 8) & 255]; }
function u32(value: number) { return [value & 255, (value >>> 8) & 255, (value >>> 16) & 255, (value >>> 24) & 255]; }
export function createZip(files: Array<{ name: string; content: string }>) {
  const encoder = new TextEncoder(); const localParts: Uint8Array[] = []; const centralParts: Uint8Array[] = []; let offset = 0;
  for (const file of files) {
    const name = encoder.encode(file.name); const data = encoder.encode(`\ufeff${file.content}`); const crc = crc32(data);
    const local = new Uint8Array([80,75,3,4,20,0,0,8,0,0,0,0,0,0,...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),0,0,...name,...data]); localParts.push(local);
    const central = new Uint8Array([80,75,1,2,20,0,20,0,0,8,0,0,0,0,0,0,...u32(crc),...u32(data.length),...u32(data.length),...u16(name.length),0,0,0,0,0,0,0,0,0,0,0,0,...u32(offset),...name]); centralParts.push(central); offset += local.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0); const end = new Uint8Array([80,75,5,6,0,0,0,0,...u16(files.length),...u16(files.length),...u32(centralSize),...u32(offset),0,0]);
  const parts = [...localParts, ...centralParts, end];
  const archive = new Uint8Array(parts.reduce((sum, part) => sum + part.length, 0));
  let cursor = 0;
  for (const part of parts) { archive.set(part, cursor); cursor += part.length; }
  return new Blob([archive.buffer as ArrayBuffer], { type: "application/zip" });
}
