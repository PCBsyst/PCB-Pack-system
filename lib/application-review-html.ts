import { documentHtmlStyles } from "@/lib/document-html-layout";
import type { PackageContext } from "@/lib/prototype-package";
import type { Job } from "@/types/certification";
import { documentEvidenceSummary } from "@/lib/document-evidence-summary";
import { documentTrainingSummary } from "@/lib/document-training-summary";
import {buildEnglishApplicationReviewHtml} from "@/lib/application-review-html-en";

export const applicationReviewHtmlVersion = "HTML-AR-01 v1";
export const applicationReviewHtmlCsp = "default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:; base-uri 'none'; form-action 'none'";
const escape = (value: unknown) => String(value ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#39;");

/** A separate view of saved application/review records, never a rendering of an uploaded original. */
export function buildApplicationReviewHtml(context: PackageContext, job: Job, metadata: {generatedAt:string;recordHash:string;sample:boolean},language:"KR"|"EN"="KR") {
  if (!/^\d{4}-\d{2}-\d{2}T/.test(metadata.generatedAt) || !Number.isFinite(Date.parse(metadata.generatedAt)) || !/^[a-f0-9]{64}$/.test(metadata.recordHash)) throw Error("문서 생성 식별정보 오류");
  if(language==="EN")return buildEnglishApplicationReviewHtml(context,job,metadata,applicationReviewHtmlVersion,applicationReviewHtmlCsp);
  const value = (input:unknown) => escape(typeof input === "string" && input.trim() ? input : "미입력");
  const field = (label:string,input:unknown) => `<div class="field"><dt>${escape(label)}</dt><dd>${value(input)}</dd></div>`;
  const section = (title:string,body:string,className="") => `<section class="${escape(className)}"><h2>${title}</h2>${body}</section>`;
  const paragraph = (label:string,input:unknown) => `<div class="comment"><h3>${label}</h3><p>${value(input)}</p></div>`;
  const candidate=context.candidate, review=context.review;
  const grades:Record<string,string>={"Auditor":"심사원","Lead Auditor":"선임심사원","Provisional Auditor":"심사원보","Internal Auditor":"내부심사원","Verification Auditor":"검증심사원"};
  const basic=`<dl class="fields">${field("후보자명",candidate.name)}${field("영문명",candidate.nameEn)}${field("생년월일",candidate.birthDate)}${field("국적",candidate.nationality)}${field("이메일",candidate.email)}${field("전화번호",candidate.phone)}${field("주소",candidate.address)}${field("Job 번호",job.jobNo)}${field("신청표준",job.standard)}${field("신청등급",grades[job.currentGrade]??job.currentGrade)}${field("신청구분",context.application.applicationType)}${field("접수일",context.application.receivedAt)}</dl>`;
  const requirements=Object.entries(context.reviewRequirements??{}).map(([name,result])=>`<tr><th scope="row">${escape(name)}</th><td>${value(result)}</td></tr>`).join("") || '<tr><td colspan="2">요건 검토 기록 미입력</td></tr>';
  const documents=([['application','신청서'],['agreement','인증계약서'],['diploma','학력 증빙자료'],['career','경력증명서'],['education','교육수료증'],['auditLog','심사이력표']] as const).map(([key,label])=>{
    const record=context.deliveryDocuments[job.id]?.[key];
    const applicability=record?.applicability === "NOT_APPLICABLE"?"해당 없음":record?.applicability === "CONDITIONAL"?"조건부":record?.applicability === "REQUIRED"?"필수":"미입력";
    return `<tr><th scope="row">${label}</th><td>${applicability}</td><td>${record?.applicability === "NOT_APPLICABLE"?"해당 없음":record?.received?"확인됨":"미확인"}</td><td>${value(record?.date)}</td><td>${value(record?.comment)}</td></tr>`;
  }).join("");
  const evidence=documentEvidenceSummary(context);
  const summary=`<dl class="fields">${field("1차 검토 결과",review.result)}${field("2차 검증 결과",review.verificationResult)}</dl><p class="note">표시된 결과는 저장된 담당자 판단입니다. 증빙 연결이나 HTML 생성만으로 적합 또는 인증 승인을 판정하지 않습니다.</p>`;
  const primary=`<dl class="fields">${field("검토자",review.reviewer)}${field("검토일",review.reviewedAt)}</dl>${paragraph("검토 의견",review.comment)}`;
  const secondary=`<dl class="fields">${field("검증인",review.verifier)}${field("검증일",review.verifiedAt)}</dl>${paragraph("검증 의견",review.verificationComment)}`;
  return `<!doctype html><html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="referrer" content="no-referrer"><meta http-equiv="Content-Security-Policy" content="${escape(applicationReviewHtmlCsp)}"><meta name="report-template" content="${applicationReviewHtmlVersion}"><title>신청서류 검토서 ${escape(job.jobNo)}</title><style>
${documentHtmlStyles(applicationReviewHtmlVersion)}
</style></head><body><main class="sheet"><header class="masthead"><div class="brand">GPC</div><div class="status">${metadata.sample?"가상 데이터 검토본":"HTML 디자인 검토본"}</div></header><h1>신청서류 검토서</h1><p class="subtitle">시스템에 저장된 신청정보와 1차 검토 및 2차 검증 기록을 확인합니다. 제출된 신청서 원본 및 정식 DOCX와 별도의 검토 화면입니다.</p>${section("01 검토 결과",summary)}${section("02 신청 및 후보자 정보",basic)}${section("03 요건별 검토",`<table class="requirements"><thead><tr><th>요건</th><th>검토 결과</th></tr></thead><tbody>${requirements}</tbody></table>${paragraph("교육 및 시험 기록",documentTrainingSummary(context.examSchedules?.[job.id],"KR"))}`)}${section("04 제출서류 확인",`<table class="documents"><thead><tr><th>서류</th><th>적용</th><th>확인</th><th>기록일</th><th>비고</th></tr></thead><tbody>${documents}</tbody></table><p class="note">확인 여부는 기록된 값이며 미확인만으로 미제출 또는 부적합을 단정하지 않습니다.</p>`)}${section("05 1차 서류검토",primary)}${section("06 2차 검증",secondary,"verification")}${section("07 요건별 검토 근거",`<p class="evidence">${value(evidence||"연결된 검토 근거 미기록")}</p>`)}<footer class="provenance"><p>${applicationReviewHtmlVersion} · ${value(job.jobNo)} · 생성일시 한국시간 ${escape(new Date(metadata.generatedAt).toLocaleString("ko-KR",{timeZone:"Asia/Seoul",hour12:false}))}</p><p>편집 가능한 HTML 사본입니다. 정식 패키지 완료나 PDF 저장 완료를 기록하지 않습니다. 인쇄 시 A4를 선택하세요.</p><p class="digest">기록 스냅샷 SHA-256 ${metadata.recordHash}</p></footer></main></body></html>`;
}
