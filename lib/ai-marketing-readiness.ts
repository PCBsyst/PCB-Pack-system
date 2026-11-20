export type AiMarketingReadiness={version:"AI-MKT-READY-01";transmissionEnabled:false;apiKeyPresent:boolean;modelPresent:boolean;ownerControlImplemented:false;retentionReviewed:false;transferAuditImplemented:false;differencingReviewComplete:false};
export function readAiMarketingReadiness(value:unknown):AiMarketingReadiness {
  const r=value as AiMarketingReadiness;
  if(!r||r.version!=="AI-MKT-READY-01"||typeof r.apiKeyPresent!=="boolean"||typeof r.modelPresent!=="boolean"||[r.transmissionEnabled,r.ownerControlImplemented,r.retentionReviewed,r.transferAuditImplemented,r.differencingReviewComplete].some(value=>value!==false)||Object.keys(r).length!==8)throw Error("AI 연결 준비 상태를 안전하게 확인하지 못했습니다.");
  return r;
}
