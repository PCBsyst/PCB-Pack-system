import type {PackageContext} from "@/lib/prototype-package";
export const deliveryConfirmationDocumentRows=[
 ["application","신청서","Application form"],["career","경력증명서","Work experience certificate"],
 ["education","교육수료증","Training certificate"],["diploma","학력 증빙자료","Academic evidence"],
 ["auditLog","심사이력표","Audit log"],["agreement","인증계약서","Certification agreement"],
 ["examNotice","시험통보서","Examination notice"],["examAnswers","시험답안지","Examination answer sheet"],
 ["decisionReport","인증결정보고서","Certification decision report"],["certificate","개인인증서","Personnel certificate"],
 ["survey","고객 설문지","Customer survey"],["deliveryConfirmation","문서전달확인서","Document delivery confirmation"],
] as const;
/** Only translations of source notes printed in this Job are required. */
export function deliveryConfirmationHtmlIssues(context:PackageContext,jobId:string){
 return deliveryConfirmationDocumentRows.flatMap(([key,label])=>{
  const record=context.deliveryDocuments[jobId]?.[key];
  return record?.comment?.trim()&&!record.commentEn?.trim()?[`${label} 비고 (영문)`]:[];
 });
}
