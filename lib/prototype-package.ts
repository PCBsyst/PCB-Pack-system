import type { Candidate, CertificationApplication, Job } from "@/types/certification";

export type DemoReview = { result: "적합" | "보완필요" | "부적합"; reviewer: string; reviewedAt: string; comment: string };
export type DemoDecision = Record<string, { result: "" | "승인" | "보완" | "불승인"; comment: string }>;
export type DemoCertificate = Record<string, { certificationNo: string; issueDate: string; expiryDate: string; trackingNumber: string }>;
export type PackageContext = { application: CertificationApplication; candidate: Candidate; jobs: Job[]; review: DemoReview; decisions: DemoDecision; certificates: DemoCertificate; decisionReviewer: string; decisionDate: string };

function escapeHtml(value: string | number | undefined) {
  return String(value ?? "-").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;");
}

function documentShell(title: string, body: string) {
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>${escapeHtml(title)}</title><style>@page{size:A4;margin:18mm}body{font-family:"Malgun Gothic","Noto Sans KR",sans-serif;color:#111;font-size:11pt;line-height:1.6}h1{text-align:center;font-size:20pt;margin:0 0 24px}h2{font-size:13pt;margin:24px 0 8px;border-bottom:1px solid #555;padding-bottom:5px}table{width:100%;border-collapse:collapse;margin:8px 0 18px}th,td{border:1px solid #777;padding:8px;text-align:left;vertical-align:top}th{width:22%;background:#f2f4f7}.note{margin-top:28px;color:#555;font-size:9pt}</style></head><body><h1>${escapeHtml(title)}</h1>${body}<p class="note">개발용 가상 데이터로 생성된 프로토타입 문서이며 공식 기록이 아닙니다.</p></body></html>`;
}

function commonRows(context: PackageContext, job: Job) {
  return `<table><tr><th>후보자</th><td>${escapeHtml(context.candidate.name)}</td><th>신청번호</th><td>${escapeHtml(context.application.applicationNo)}</td></tr><tr><th>Job No.</th><td>${escapeHtml(job.jobNo)}</td><th>관리 No.</th><td>${escapeHtml(job.managementNo ?? context.application.managementNoFrom)}</td></tr><tr><th>세부 분야</th><td>${escapeHtml(job.standard)}</td><th>등급</th><td>${escapeHtml(job.currentGrade)}</td></tr></table>`;
}

export function buildDocuments(context: PackageContext, job: Job) {
  const decision = context.decisions[job.id];
  const certificate = context.certificates[job.id];
  return [
    { fileName: `${job.jobNo}_서류검토서.doc`, title: "서류검토서", html: documentShell("서류검토서", `${commonRows(context, job)}<h2>검토 결과</h2><table><tr><th>종합 결과</th><td>${escapeHtml(context.review.result)}</td></tr><tr><th>검토 의견</th><td>${escapeHtml(context.review.comment)}</td></tr><tr><th>검토자</th><td>${escapeHtml(context.review.reviewer)}</td></tr><tr><th>검토일</th><td>${escapeHtml(context.review.reviewedAt)}</td></tr></table>`) },
    { fileName: `${job.jobNo}_인증결정보고서.doc`, title: "인증결정보고서", html: documentShell("인증결정보고서", `${commonRows(context, job)}<h2>인증심의 결과</h2><table><tr><th>심의 결과</th><td>${escapeHtml(decision?.result)}</td></tr><tr><th>심의 의견</th><td>${escapeHtml(decision?.comment)}</td></tr><tr><th>심의자</th><td>${escapeHtml(context.decisionReviewer)}</td></tr><tr><th>심의일</th><td>${escapeHtml(context.decisionDate)}</td></tr></table>`) },
    { fileName: `${job.jobNo}_인증정보_요약.doc`, title: "인증정보 요약", html: documentShell("인증정보 요약", `${commonRows(context, job)}<h2>발행 정보</h2><table><tr><th>인증번호</th><td>${escapeHtml(certificate?.certificationNo)}</td></tr><tr><th>인증발행일</th><td>${escapeHtml(certificate?.issueDate)}</td></tr><tr><th>만료일</th><td>${escapeHtml(certificate?.expiryDate)}</td></tr><tr><th>Revision</th><td>Rev.0</td></tr></table>`) },
    { fileName: `${job.jobNo}_문서전달확인서.doc`, title: "문서전달확인서", html: documentShell("문서전달확인서", `${commonRows(context, job)}<h2>전달 기록</h2><table><tr><th>PDF 전달</th><td>이메일 전달 완료</td></tr><tr><th>전달일</th><td>${escapeHtml(certificate?.issueDate)}</td></tr><tr><th>원본 추적번호</th><td>${escapeHtml(certificate?.trackingNumber || "미입력")}</td></tr><tr><th>담당자</th><td>${escapeHtml(context.application.primaryOwner)}</td></tr></table>`) },
  ];
}

export function downloadBlob(fileName: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url; anchor.download = fileName; document.body.appendChild(anchor); anchor.click(); anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function downloadWord(fileName: string, html: string) { downloadBlob(fileName, new Blob(["\ufeff", html], { type: "application/msword;charset=utf-8" })); }
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
