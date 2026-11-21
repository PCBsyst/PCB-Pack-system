import { createHash } from "node:crypto";
import { requireApiStaff } from "@/lib/server/api-auth";
import { readValidatedDocumentRequest } from "@/lib/server/document-request-validation";
import { recordDocumentResponse } from "@/lib/server/privacy-access";
import { privateDocumentResponse } from "@/lib/private-document-response";
import { currentAuthEnvironment } from "@/lib/supabase/auth-environment";
import { buildDeliveryConfirmationHtml, deliveryConfirmationHtmlCsp, deliveryConfirmationHtmlVersion } from "@/lib/delivery-confirmation-html";

export async function POST(request:Request) {
  try {return privateDocumentResponse(await generate(request));}
  catch {return privateDocumentResponse(Response.json({error:"문서전달확인서 HTML 생성 결과를 확인하지 못했습니다. 다시 시도해 주세요."},{status:503}));}
}
async function generate(request:Request) {
  const denied=await requireApiStaff(["DOCUMENT_GENERATION"]);if(denied)return denied;
  const parsed=await readValidatedDocumentRequest(request,"KR");if(!parsed.ok)return parsed.response;
  const {context,job,language}=parsed.input;
  if(language!=="KR")return Response.json({error:"문서전달확인서 HTML 미리보기는 현재 국문을 지원합니다."},{status:422});
  const recordHash=createHash("sha256").update(JSON.stringify({context,job,language})).digest("hex"),generatedAt=new Date().toISOString();
  const html=buildDeliveryConfirmationHtml(context,job,{generatedAt,recordHash,sample:currentAuthEnvironment().localPrototype});
  const audit=await recordDocumentResponse("job",job.id,"DELIVERY_CONFIRMATION_HTML_PREVIEW:KR");if(audit)return audit;
  const bytes=new TextEncoder().encode(html),safeNo=job.jobNo.replace(/[^A-Za-z0-9_-]/g,"_");
  return new Response(html,{headers:{"Content-Type":"text/html; charset=utf-8","Content-Disposition":`attachment; filename="${safeNo}_Delivery_Confirmation_KR.html"`,"Content-Security-Policy":deliveryConfirmationHtmlCsp,"X-Report-Version":deliveryConfirmationHtmlVersion,"X-Report-Status":"DESIGN_PREVIEW","X-Report-SHA256":createHash("sha256").update(bytes).digest("hex"),"X-Report-Bytes":String(bytes.length),"X-Report-Generated-At":generatedAt}});
}
