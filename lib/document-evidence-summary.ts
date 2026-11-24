import type {PackageContext} from "@/lib/prototype-package";
import {evidenceRequirements,readEvidenceReview,requirementEvidenceIssues,evidenceEnglishIssues} from "@/lib/evidence-review";
import {documentChoice} from "@/lib/document-language-values";
/** Output only linked source metadata, never original document text or unlinked evidence fields. */
export function documentEvidenceSummary(context:PackageContext,language:"KR"|"EN"="KR"){
 if(context.evidenceReview===undefined)return "";
 const state=readEvidenceReview(context.evidenceReview);if(!state)throw Error("저장된 증빙 기록을 확인하지 못했습니다.");
 if(!state.links?.length)return "";
 if(language==="EN"&&state.links.some(link=>evidenceEnglishIssues(link,context.reviewRequirements[link.requirement]??"").length))throw Error("영문 증빙 근거를 확인하고 저장해 주세요.");
 if(language==="EN")return ["Requirement Evidence Appendix for the Application","Evidence comparison does not replace qualification assessment or certification approval.",...evidenceRequirements.map(requirement=>{
  const result=context.reviewRequirements[requirement]??"",link=state.links?.find(l=>l.requirement===requirement);
  const label=documentChoice(requirement,"EN"),resultLabel=documentChoice(result,"EN");
  if(!link)return `${label} / Review result: ${resultLabel} / Evidence link not recorded`;
  const issues=requirementEvidenceIssues(link,state.documents,context.candidate.name,result,context.candidate.birthDate);
  return [`${label} / Review result: ${resultLabel} / Evidence comparison: ${link.confirmed&&!issues.length?"Confirmed":"Unconfirmed or recheck required"}`,
   `Source documents: ${link.documentIds.map(id=>{const d=state.documents.find(d=>d.id===id);return d?`${documentChoice(d.kind,"EN")} · ${d.fileName||"File name not entered"}`:"Linked document missing";}).join(" / ")||"Not linked"}`,
   `Reference: ${link.english?.reference||"Not entered"}`,`Review note: ${link.english?.note||"Not entered"}`,
   ...(issues.length?[`Items to check: ${issues.map(issue=>englishEvidenceIssue[issue]??"Evidence comparison requires review").join(" / ")}`]:[])].join("\n");
 })].join("\n\n");
 return ["[요건별 검토 근거 · 신청 공통 기록]","근거 대조 확인은 자격 충족·심의 승인을 대신하지 않습니다.",...evidenceRequirements.map(requirement=>{
  const result=context.reviewRequirements[requirement]??"미확인",link=state.links?.find(l=>l.requirement===requirement);
  if(!link)return `${requirement} / 검토 결과: ${result} / 근거 연결 미기록`;
  const issues=requirementEvidenceIssues(link,state.documents,context.candidate.name,result,context.candidate.birthDate);
  return [`${requirement} / 검토 결과: ${result} / 근거 확인: ${link.confirmed&&!issues.length?"확인됨":"미확인·재확인 필요"}`,
   `근거 문서: ${link.documentIds.map(id=>{const d=state.documents.find(d=>d.id===id);return d?`${d.kind} · ${d.fileName||"문서명 미입력"}`:"연결 문서 없음";}).join(" / ")||"미연결"}`,
   `확인 위치: ${link.reference||"미입력"}`,`검토 메모: ${link.note||"미입력"}`,...(issues.length?[`확인 사항: ${issues.join(" / ")}`]:[])].join("\n");
 })].join("\n\n");
}
const englishEvidenceIssue:Record<string,string>={
 "검토 결과 미확인":"Review result not recorded","검토 메모 5자 이상 필요":"Review note must contain at least five characters",
 "근거 문서 미연결":"Source document not linked","확인 위치 미입력":"Reference not entered","연결 문서 없음":"Linked document missing",
 "문서명 미입력":"File name not entered","후보자 이름 대조 필요":"Candidate name comparison required","후보자 이름 불일치":"Candidate name mismatch",
 "생년월일 오류·불일치":"Date of birth invalid or mismatched","검토 결과 변경: 다시 확인 필요":"Review result changed and requires recheck",
};
