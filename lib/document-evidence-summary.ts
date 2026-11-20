import type {PackageContext} from "@/lib/prototype-package";
import {evidenceRequirements,readEvidenceReview,requirementEvidenceIssues} from "@/lib/evidence-review";
/** Output only linked source metadata, never original document text or unlinked evidence fields. */
export function documentEvidenceSummary(context:PackageContext){
 if(context.evidenceReview===undefined)return "";
 const state=readEvidenceReview(context.evidenceReview);if(!state)throw Error("저장된 증빙 기록을 확인하지 못했습니다.");
 if(!state.links?.length)return "";
 return ["[요건별 검토 근거 · 신청 공통 기록]","근거 대조 확인은 자격 충족·심의 승인을 대신하지 않습니다.",...evidenceRequirements.map(requirement=>{
  const result=context.reviewRequirements[requirement]??"미확인",link=state.links?.find(l=>l.requirement===requirement);
  if(!link)return `${requirement} / 검토 결과: ${result} / 근거 연결 미기록`;
  const issues=requirementEvidenceIssues(link,state.documents,context.candidate.name,result,context.candidate.birthDate);
  return [`${requirement} / 검토 결과: ${result} / 근거 확인: ${link.confirmed&&!issues.length?"확인됨":"미확인·재확인 필요"}`,
   `근거 문서: ${link.documentIds.map(id=>{const d=state.documents.find(d=>d.id===id);return d?`${d.kind} · ${d.fileName||"문서명 미입력"}`:"연결 문서 없음";}).join(" / ")||"미연결"}`,
   `확인 위치: ${link.reference||"미입력"}`,`검토 메모: ${link.note||"미입력"}`,...(issues.length?[`확인 사항: ${issues.join(" / ")}`]:[])].join("\n");
 })].join("\n\n");
}
