import {requireApiStaff} from "@/lib/server/api-auth";
import {createClient} from "@/lib/supabase/server";
import {currentAuthEnvironment} from "@/lib/supabase/auth-environment";
import {privateDocumentResponse} from "@/lib/private-document-response";
import {aiPolicyInput,aiPolicyVersion} from "@/lib/ai-marketing-policy";
import {aiMarketingConfiguration,aiPolicyStorageError,normalizeStoredAiPolicy} from "@/lib/server/ai-marketing-policy";
const fail=(error:string,status:number,code="AI_POLICY_UNAVAILABLE")=>privateDocumentResponse(Response.json({error,code},{status}));
function success(value:unknown){const body=JSON.stringify(value);return privateDocumentResponse(new Response(body,{headers:{"Content-Type":"application/json; charset=utf-8","X-Report-Bytes":String(new TextEncoder().encode(body).length)}}));}
async function owner(request:Request){
  const denied=await requireApiStaff();if(denied)return {response:privateDocumentResponse(denied)};
  if(request.headers.get("Origin")&&request.headers.get("Origin")!==new URL(request.url).origin)return {response:fail("허용되지 않은 요청입니다.",403)};
  if(currentAuthEnvironment().localPrototype)return {prototype:true as const};
  const client=await createClient(),{data,error}=await client.auth.getUser();if(error||!data.user)return {response:fail("로그인이 필요합니다.",401)};
  const {data:profile,error:profileError}=await client.from("profiles").select("active,is_owner").eq("id",data.user.id).maybeSingle();
  if(profileError)return {response:fail("최고관리자 권한을 확인하지 못했습니다.",503)};
  if(!profile?.active||profile.is_owner!==true)return {response:fail("최고관리자만 AI 정책과 감사기록을 관리할 수 있습니다.",403)};
  return {client};
}
export async function GET(request:Request) {
  try {const access=await owner(request);if(access.response)return access.response;
    if(access.prototype){const c=aiMarketingConfiguration();return success({version:aiPolicyVersion,mode:"PROTOTYPE",policy:null,configMatches:false,keyPresent:c.keyPresent,modelPresent:c.modelPresent,transportEnabled:false,events:[]});}
    const {data,error}=await access.client!.rpc("read_ai_marketing_policy");
    if(error)return fail("AI 정책 DB 적용 또는 연결 확인이 필요합니다. 적용 전에는 설정을 변경하지 않습니다.",503,aiPolicyStorageError(error));
    return success(normalizeStoredAiPolicy(data).view);
  }catch{return fail("AI 정책과 감사기록을 확인하지 못했습니다. 실제 전송은 비활성입니다.",503);}
}
export async function POST(request:Request) {
  try {const access=await owner(request);if(access.response)return access.response;if(access.prototype)return fail("개발 가상 모드에서는 AI 정책을 저장하지 않습니다.",409,"PROTOTYPE_READONLY");
    const reader=request.body?.getReader();if(!reader)return fail("변경 내용을 확인해 주세요.",400);let raw="",size=0;const decoder=new TextDecoder();
    try{for(;;){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>8192){await reader.cancel();return fail("요청이 너무 큽니다.",413);}raw+=decoder.decode(part.value,{stream:true});}raw+=decoder.decode();}finally{reader.releaseLock();}
    let input;try{input=aiPolicyInput(JSON.parse(raw));}catch{return fail("검토 확인·근거·변경 사유·설정 버전을 확인해 주세요.",400);}
    const c=aiMarketingConfiguration();if(input.enabled&&(!c.keyPresent||!c.modelPresent))return fail("ON 정책을 허용하려면 서버 키와 모델 설정이 필요합니다. 실제 전송은 별도 구현 전까지 비활성입니다.",409,"CONFIG_REQUIRED");
    const {data:stored,error:readError}=await access.client!.rpc("read_ai_marketing_policy");if(readError)return fail("정책 DB와 현재 버전을 확인하지 못했습니다. 먼저 다시 조회하세요.",503,aiPolicyStorageError(readError));
    const current=normalizeStoredAiPolicy(stored);if(current.view.policy!.revision!==input.expectedRevision)return fail("다른 작업에서 정책이 변경됐습니다. 다시 조회하세요.",409,"POLICY_CONFLICT");
    const {data,error}=await access.client!.rpc("update_ai_marketing_policy",{p_enabled:input.enabled,p_retention_reviewed:input.retentionReviewed,p_privacy_reviewed:input.privacyReviewed,p_review_reference:input.reviewReference,p_config_fingerprint:c.fingerprint||current.storedFingerprint,p_reason:input.reason,p_expected_revision:input.expectedRevision});
    if(error)return fail("정책 변경을 확인하지 못했습니다. 입력을 유지하고 현재 정책을 다시 조회하세요.",error.code==="40001"?409:503,error.code==="40001"?"POLICY_CONFLICT":"SAVE_UNCERTAIN");
    const saved=normalizeStoredAiPolicy(data).view,p=saved.policy!;
    if(p.revision!==input.expectedRevision+1||p.enabled!==input.enabled||p.retentionReviewed!==input.retentionReviewed||p.privacyReviewed!==input.privacyReviewed||p.reviewReference!==input.reviewReference||!saved.events.some(e=>e.kind==="POLICY_UPDATED"&&e.revision===p.revision&&e.reason===input.reason&&e.enabledAfter===p.enabled&&e.retentionReviewed===p.retentionReviewed&&e.privacyReviewed===p.privacyReviewed&&e.reviewReference===p.reviewReference)) return fail("저장 응답 또는 감사기록이 요청과 일치하지 않습니다. 현재 정책을 다시 조회하세요.",503,"SAVE_UNCERTAIN");
    return success(saved);
  }catch{return fail("정책 저장 결과를 확인하지 못했습니다. 입력을 유지하고 현재 정책을 다시 조회하세요.",503,"SAVE_UNCERTAIN");}
}
