import type { CorporateDocumentType, CorporateTemplateLanguage } from "@/lib/document-template-registry";
import type { TemplateProvenance } from "@/lib/template-provenance";

type ManifestJob = { id: string; jobNo: string; standard: string; grade: string; certificateNo: string; issueDate: string; expiryDate: string };
export type ManifestDocument = { jobId: string; documentType: CorporateDocumentType; language: CorporateTemplateLanguage; entryName: string; template: TemplateProvenance; sha256: string; byteSize: number };
const labels: Record<CorporateDocumentType, string> = { APPLICATION_REVIEW: "서류검토서", CERTIFICATION_DECISION_REPORT: "인증결정보고서", DELIVERY_CONFIRMATION: "문서전달확인서" };
const line = (value: string) => value.replace(/[\r\n\t]/g, " ");

/** Minimal archive index, not a receipt of PC storage or a digital signature. */
export function createPackageManifest(input: { applicationNo: string; candidateName: string; generatedAt: string; jobs: ManifestJob[]; languages: CorporateTemplateLanguage[]; documents: ManifestDocument[] }) {
  const missing = input.jobs.flatMap(job => input.languages.flatMap(language => (Object.keys(labels) as CorporateDocumentType[])
    .filter(documentType => !input.documents.some(document => document.jobId === job.id && document.language === language && document.documentType === documentType))
    .map(documentType => ({ jobId: job.id, jobNo: job.jobNo, language, documentType, label: labels[documentType] }))));
  const complete = input.jobs.length > 0 && input.languages.length > 0 && missing.length === 0;
  const manifest = { schemaVersion: 1, applicationNo: input.applicationNo, candidateName: input.candidateName, generatedAt: input.generatedAt, languages: input.languages, complete, documentCount: input.documents.length, jobs: input.jobs, documents: input.documents, missing };
  const lines = ["기록 패키지 구성 안내", `신청번호: ${line(input.applicationNo)}`, `후보자: ${line(input.candidateName)}`, `생성일시(UTC): ${input.generatedAt}`, `선택 언어: ${input.languages.map(language => language === "KR" ? "국문" : "영문").join(", ")}`, `실제 생성 문서: ${input.documents.length}개 DOCX`, complete ? "선택한 언어의 3종 양식 포함" : "일부 양식 미포함: 전체 패키지 완료가 아닙니다.", "", "대상 Job"];
  for (const job of input.jobs) lines.push(`- ${line(job.jobNo)} · ${line(job.standard)} / ${line(job.grade)}`, `  인증번호: ${line(job.certificateNo) || "미입력"} / 발행일: ${job.issueDate || "미입력"} / 만료일: ${job.expiryDate || "미입력"}`);
  lines.push("", "포함 문서");
  for (const document of input.documents) lines.push(`- ${document.entryName} (${labels[document.documentType]} · ${document.language === "KR" ? "국문" : "영문"})`, `  파일 SHA-256: ${document.sha256} / 크기: ${document.byteSize}바이트`, `  양식 개정: ${line(document.template.version)} / 출처: ${document.template.source === "DATABASE" ? "등록 양식" : "기본 내장 양식"} / 양식 SHA-256: ${document.template.sha256}`);
  lines.push("", "미포함 문서");
  lines.push(...(missing.length ? missing.map(item => `- ${line(item.jobNo)} · ${item.language === "KR" ? "국문" : "영문"} ${item.label} (양식 미등록)`) : ["없음"]));
  lines.push("", "안내", "- 안내 TXT/JSON 파일은 DOCX 문서 수에 포함하지 않습니다.", "- 검토용 초안과 PDF는 이 ZIP에 포함되지 않습니다.", "- 파일 SHA-256은 개별 생성 문서, 양식 SHA-256은 사용한 원본 양식의 값입니다.", "- 이 목록은 생성 구성 안내이며 전자서명·PC 저장 완료·실제 출력 배치 검증을 뜻하지 않습니다.", "- 고객 개인정보가 포함되어 있으므로 권한 없는 사람에게 공유하지 마세요.");
  return { manifest, text: `\ufeff${lines.join("\r\n")}`, complete };
}
