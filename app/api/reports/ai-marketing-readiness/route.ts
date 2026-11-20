import {requireApiStaff} from "@/lib/server/api-auth";
import {createClient} from "@/lib/supabase/server";
import {currentAuthEnvironment} from "@/lib/supabase/auth-environment";
import {privateDocumentResponse} from "@/lib/private-document-response";
export async function GET(request:Request) {
  try {
    const denied=await requireApiStaff();if(denied)return privateDocumentResponse(denied);
    const origin=request.headers.get("Origin");if(origin&&origin!==new URL(request.url).origin)return privateDocumentResponse(Response.json({error:"허용되지 않은 요청입니다."},{status:403}));
    if(!currentAuthEnvironment().localPrototype){const client=await createClient(),{data,error}=await client.auth.getUser();if(error||!data.user)return privateDocumentResponse(Response.json({error:"로그인이 필요합니다."},{status:401}));const {data:profile,error:profileError}=await client.from("profiles").select("active,is_owner").eq("id",data.user.id).maybeSingle();if(profileError)return privateDocumentResponse(Response.json({error:"관리자 권한 확인 실패"},{status:503}));if(!profile?.active||profile.is_owner!==true)return privateDocumentResponse(Response.json({error:"최고관리자만 연결 설정 준비 상태를 확인할 수 있습니다."},{status:403}));}
    const body=JSON.stringify({version:"AI-MKT-READY-01",transmissionEnabled:false,apiKeyPresent:Boolean(process.env.OPENAI_API_KEY?.trim()),modelPresent:Boolean(process.env.OPENAI_MARKETING_MODEL?.trim()),ownerControlImplemented:false,retentionReviewed:false,transferAuditImplemented:false,differencingReviewComplete:false});
    return privateDocumentResponse(new Response(body,{headers:{"Content-Type":"application/json; charset=utf-8","X-Report-Bytes":String(new TextEncoder().encode(body).length)}}));
  }catch{return privateDocumentResponse(Response.json({error:"AI 연결 준비 상태를 확인하지 못했습니다. 외부 전송은 비활성입니다."},{status:503}));}
}
