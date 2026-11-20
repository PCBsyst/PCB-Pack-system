export type AiMarketingReadiness={version:"AI-MKT-READY-02";transmissionEnabled:false;apiKeyPresent:boolean;modelPresent:boolean;ownerControlImplemented:boolean;policyEnabled:boolean;retentionReviewed:boolean;transferAuditImplemented:boolean;differencingReviewComplete:boolean;configMatches:boolean;schemaState:"APPLIED"|"SCHEMA_REQUIRED"|"UNAVAILABLE"|"PROTOTYPE"};
export function readAiMarketingReadiness(value:unknown):AiMarketingReadiness {
  const r=value as AiMarketingReadiness;
  if(!r||r.version!=="AI-MKT-READY-02"||r.transmissionEnabled!==false||Object.keys(r).length!==11||![r.apiKeyPresent,r.modelPresent,r.ownerControlImplemented,r.policyEnabled,r.retentionReviewed,r.transferAuditImplemented,r.differencingReviewComplete,r.configMatches].every(v=>typeof v==="boolean")||!["APPLIED","SCHEMA_REQUIRED","UNAVAILABLE","PROTOTYPE"].includes(r.schemaState))throw Error("AI 연결 준비 상태를 안전하게 확인하지 못했습니다.");
  if(r.schemaState!=="APPLIED"&&[r.ownerControlImplemented,r.policyEnabled,r.retentionReviewed,r.transferAuditImplemented,r.differencingReviewComplete,r.configMatches].some(Boolean)||r.schemaState==="APPLIED"&&(!r.ownerControlImplemented||!r.transferAuditImplemented)||r.configMatches&&(!r.apiKeyPresent||!r.modelPresent)||!r.configMatches&&(r.retentionReviewed||r.differencingReviewComplete))throw Error("정책 적용 상태와 검토 결과가 일치하지 않습니다.");
  return r;
}
