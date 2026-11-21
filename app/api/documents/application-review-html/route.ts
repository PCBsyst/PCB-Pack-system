import { createHash } from "node:crypto";
import { requireApiStaff } from "@/lib/server/api-auth";
import { readValidatedDocumentRequest } from "@/lib/server/document-request-validation";
import { recordDocumentResponse } from "@/lib/server/privacy-access";
import { privateDocumentResponse } from "@/lib/private-document-response";
import { currentAuthEnvironment } from "@/lib/supabase/auth-environment";
import { buildApplicationReviewHtml, applicationReviewHtmlCsp, applicationReviewHtmlVersion } from "@/lib/application-review-html";

export async function POST(request:Request) {
  try {return privateDocumentResponse(await generate(request));}
  catch {return privateDocumentResponse(Response.json({error:"서류검토서 HTML 생성 결과를 확인하지 못했습니다. 다시 시도해 주세요."},{status:503}));}
}
async function generate(request:Request) {
  const denied=await requireApiStaff(["DOCUMENT_GENERATION"]);if(denied)return denied;
  const parsed=await readValidatedDocumentRequest(request,"KR");if(!parsed.ok)return parsed.response;
  const {context,job,language}=parsed.input;
  if(language!=="KR")return Response.json({error:"서류검토서 HTML 미리보기는 현재 국문을 지원합니다."},{status:422});
  const recordHash=createHash("sha256").update(JSON.stringify({context,job,language})).digest("hex"),generatedAt=new Date().toISOString();
  const html=buildApplicationReviewHtml(context,job,{generatedAt,recordHash,sample:currentAuthEnvironment().localPrototype});
  const audit=await recordDocumentResponse("job",job.id,"APPLICATION_REVIEW_HTML_PREVIEW:KR");if(audit)return audit;
  const bytes=new TextEncoder().encode(html),safeNo=job.jobNo.replace(/[^A-Za-z0-9_-]/g,"_");
  return new Response(html,{headers:{"Content-Type":"text/html; charset=utf-8","Content-Disposition":`attachment; filename="${safeNo}_Application_Review_KR.html"`,"Content-Security-Policy":applicationReviewHtmlCsp,"X-Report-Version":applicationReviewHtmlVersion,"X-Report-Status":"DESIGN_PREVIEW","X-Report-SHA256":createHash("sha256").update(bytes).digest("hex"),"X-Report-Bytes":String(bytes.length),"X-Report-Generated-At":generatedAt}});
}
