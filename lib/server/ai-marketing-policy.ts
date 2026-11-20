import "server-only";
import {createHash} from "node:crypto";
import {aiPolicyVersion,readAiPolicyView,type AiPolicyView} from "@/lib/ai-marketing-policy";
export function aiMarketingConfiguration() {
  const key=process.env.OPENAI_API_KEY?.trim()??"",model=process.env.OPENAI_MARKETING_MODEL?.trim()??"";
  return {keyPresent:Boolean(key),modelPresent:Boolean(model),fingerprint:key&&model?createHash("sha256").update(JSON.stringify([key,model,process.env.OPENAI_ORG_ID??"",process.env.OPENAI_PROJECT_ID??""])).digest("hex"):""};
}
export function aiPolicyStorageError(error:{code?:string;message?:string}|null|undefined) {
  return ["42P01","PGRST202","PGRST205"].includes(error?.code??"")?"SCHEMA_REQUIRED":"UNAVAILABLE";
}
export function normalizeStoredAiPolicy(value:unknown):{view:AiPolicyView;storedFingerprint:string} {
  const data=value as {schema_version:string;policy:Record<string,unknown>;events:Record<string,unknown>[]};
  if(!data||data.schema_version!==aiPolicyVersion||!data.policy||data.policy.id!=="MARKETING"||!Array.isArray(data.events)||typeof data.policy.config_fingerprint!=="string"||!/^([a-f0-9]{64})?$/.test(data.policy.config_fingerprint))throw Error("AI 정책 저장 구조를 확인하지 못했습니다.");
  const c=aiMarketingConfiguration(),p=data.policy;
  const view={version:aiPolicyVersion,mode:"APPLIED" as const,policy:{enabled:p.enabled,retentionReviewed:p.retention_reviewed,privacyReviewed:p.privacy_reviewed,reviewReference:p.review_reference,revision:p.revision},configMatches:Boolean(c.fingerprint)&&p.config_fingerprint===c.fingerprint,keyPresent:c.keyPresent,modelPresent:c.modelPresent,transportEnabled:false,
    events:data.events.map(e=>({id:e.id,occurredAt:e.occurred_at,actorId:e.actor_id,kind:e.event_kind,revision:e.policy_revision,reason:e.reason,enabledBefore:e.enabled_before,enabledAfter:e.enabled_after,retentionReviewed:e.retention_reviewed,privacyReviewed:e.privacy_reviewed,reviewReference:e.review_reference,configChanged:e.config_changed}))};
  return {view:readAiPolicyView(view),storedFingerprint:p.config_fingerprint as string};
}
