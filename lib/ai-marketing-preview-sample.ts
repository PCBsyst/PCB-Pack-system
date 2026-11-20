import {buildCustomerAcquisition,allAcquisitionFilters,type AcquisitionApplication,type AcquisitionJob} from "@/lib/customer-acquisition";
import {buildAiMarketingPrivacyPreview} from "@/lib/ai-marketing-privacy";
export function aiMarketingPrivacySample() {
  const applications:AcquisitionApplication[]=[],jobs:AcquisitionJob[]=[];
  for(const [year,standard,count] of [[2024,"ISO 9001",12],[2025,"ISO 9001",17],[2024,"ISO 14001",1],[2025,"ISO 14001",2],[2024,"미승인 가상 표준",8],[2025,"미승인 가상 표준",8]] as const)for(let index=0;index<count;index++){
    const id=`synthetic-${year}-${standard}-${index}`;applications.push({id,candidateId:id,receivedAt:`${year}-03-10`,area:"ISO",partner:"직접접수",status:"DOCUMENT_REVIEW"});jobs.push({id,applicationId:id,candidateId:id,standard,grade:"Auditor"});
  }
  return buildAiMarketingPrivacyPreview(buildCustomerAcquisition(applications,jobs,2025,allAcquisitionFilters,"2026-11-20"),"SYNTHETIC");
}
