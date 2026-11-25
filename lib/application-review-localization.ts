import type {PackageContext,DemoDeliveryDocuments,DeliveryDocumentKey} from "@/lib/prototype-package";
import {documentTranslationIssues} from "@/lib/document-translation-checks";
export const applicationReviewDocumentRows = [
 ["application","신청서","Application form"],["agreement","인증계약서","Certification agreement"],
 ["diploma","학력 증빙자료","Academic evidence"],["career","경력증명서","Work experience certificate"],
 ["education","교육수료증","Training certificate"],["auditLog","심사이력표","Audit log"],
] as const;
export function applicationReviewHtmlIssues(context:PackageContext,jobId:string){
 const issues=documentTranslationIssues(context,[jobId],["APPLICATION_REVIEW"]);
 for(const [key,label] of applicationReviewDocumentRows){
  const record=context.deliveryDocuments[jobId]?.[key];
  if(record?.comment?.trim()&&!record.commentEn?.trim())issues.push(`${label} 비고 (영문)`);
 }
 return issues;
}
/** A changed source note must not reuse the previous English counterpart. */
export function reviseDeliveryRecord(record:DemoDeliveryDocuments[string][DeliveryDocumentKey],patch:Partial<DemoDeliveryDocuments[string][DeliveryDocumentKey]>){
 return {...record,...patch,...(patch.comment!==undefined&&patch.comment!==record?.comment?{commentEn:""}:{})};
}
