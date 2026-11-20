export const aiPolicyVersion="AI-MKT-POLICY-01";
export type AiPolicy={enabled:boolean;retentionReviewed:boolean;privacyReviewed:boolean;reviewReference:string;revision:number};
export type AiPolicyEvent={id:string;occurredAt:string;actorId:string;kind:"POLICY_UPDATED"|"TRANSFER_PREPARED"|"TRANSFER_RESPONSE"|"TRANSFER_FAILED";revision:number;reason:string;enabledBefore:boolean|null;enabledAfter:boolean|null;retentionReviewed:boolean|null;privacyReviewed:boolean|null;reviewReference:string|null;configChanged:boolean|null};
export type AiPolicyView={version:typeof aiPolicyVersion;mode:"APPLIED"|"PROTOTYPE";policy:AiPolicy|null;configMatches:boolean;keyPresent:boolean;modelPresent:boolean;transportEnabled:false;events:AiPolicyEvent[]};
export function aiPolicyInput(value:unknown):{enabled:boolean;retentionReviewed:boolean;privacyReviewed:boolean;reviewReference:string;reason:string;expectedRevision:number} {
  const v=value as Record<string,unknown>;
  if(!v||typeof v!=="object"||Array.isArray(v)||Object.keys(v).length!==6||!["enabled","retentionReviewed","privacyReviewed"].every(key=>typeof v[key]==="boolean")||typeof v.reviewReference!=="string"||v.reviewReference.length>500||typeof v.reason!=="string"||v.reason.trim().length<5||v.reason.length>1000||/[\u0000-\u001f\u007f]/.test(v.reviewReference)||/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(v.reason)||!Number.isSafeInteger(v.expectedRevision)||Number(v.expectedRevision)<0)throw Error("검토 확인·변경 사유·설정 버전을 확인해 주세요.");
  if((v.retentionReviewed||v.privacyReviewed)&&v.reviewReference.trim().length<10)throw Error("검토 확인을 저장하려면 10자 이상의 근거가 필요합니다.");
  if(v.enabled&&(!v.retentionReviewed||!v.privacyReviewed||v.reviewReference.trim().length<10))throw Error("ON으로 허용하려면 보관·개인정보 검토와 10자 이상의 검토 근거가 필요합니다.");
  return {enabled:v.enabled as boolean,retentionReviewed:v.retentionReviewed as boolean,privacyReviewed:v.privacyReviewed as boolean,reviewReference:v.reviewReference.trim(),reason:v.reason.trim(),expectedRevision:v.expectedRevision as number};
}
export function readAiPolicyView(value:unknown):AiPolicyView {
  const v=value as AiPolicyView;
  if(!v||Object.keys(v).length!==8||v.version!==aiPolicyVersion||!["APPLIED","PROTOTYPE"].includes(v.mode)||v.transportEnabled!==false||![v.configMatches,v.keyPresent,v.modelPresent].every(x=>typeof x==="boolean")||!Array.isArray(v.events)||v.events.length>20)throw Error("AI 정책 응답을 확인하지 못했습니다.");
  if(v.mode==="PROTOTYPE"){if(v.policy!==null||v.events.length||v.configMatches)throw Error("가상 정책 응답 오류");return v;}
  const p=v.policy;
  if(!p||Object.keys(p).length!==5||![p.enabled,p.retentionReviewed,p.privacyReviewed].every(x=>typeof x==="boolean")||typeof p.reviewReference!=="string"||p.reviewReference.length>500||!Number.isSafeInteger(p.revision)||p.revision<0||(p.retentionReviewed||p.privacyReviewed)&&p.reviewReference.trim().length<10||p.enabled&&(!p.retentionReviewed||!p.privacyReviewed))throw Error("저장된 AI 정책을 확인하지 못했습니다.");
  for(const e of v.events)if(!e||typeof e.id!=="string"||!/^\d{1,20}$/.test(e.id)||!Number.isFinite(Date.parse(e.occurredAt))||typeof e.actorId!=="string"||!["POLICY_UPDATED","TRANSFER_PREPARED","TRANSFER_RESPONSE","TRANSFER_FAILED"].includes(e.kind)||!Number.isSafeInteger(e.revision)||e.revision<0||typeof e.reason!=="string"||e.reason.length>1000||[e.enabledBefore,e.enabledAfter,e.retentionReviewed,e.privacyReviewed,e.configChanged].some(x=>x!==null&&typeof x!=="boolean")||e.reviewReference!==null&&(typeof e.reviewReference!=="string"||e.reviewReference.length>500))throw Error("AI 감사 기록을 확인하지 못했습니다.");
  return v;
}
