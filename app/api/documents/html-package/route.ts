import PizZip from "pizzip";
import {createHash} from "node:crypto";
import {requireApiStaff} from "@/lib/server/api-auth";
import {readValidatedDocumentRequest} from "@/lib/server/document-request-validation";
import {recordDocumentResponse} from "@/lib/server/privacy-access";
import {privateDocumentResponse} from "@/lib/private-document-response";
import {currentAuthEnvironment} from "@/lib/supabase/auth-environment";
import {buildApplicationReviewHtml} from "@/lib/application-review-html";
import {buildDecisionReportHtml} from "@/lib/decision-report-html";
import {buildDeliveryConfirmationHtml} from "@/lib/delivery-confirmation-html";
export async function POST(request:Request){try{return privateDocumentResponse(await generate(request));}catch{return privateDocumentResponse(Response.json({error:"HTML 묶음을 생성하지 못했습니다. 저장 기록을 확인하고 다시 시도해 주세요."},{status:503}));}}
async function generate(request:Request){
 const denied=await requireApiStaff(["DOCUMENT_GENERATION","PACKAGE_DOWNLOAD"]);if(denied)return denied;
 const parsed=await readValidatedDocumentRequest(request,"KR");if(!parsed.ok)return parsed.response;
 const {context,job,language}=parsed.input;if(language!=="KR")return Response.json({error:"HTML 묶음은 현재 국문만 지원합니다."},{status:422});
 const metadata={generatedAt:new Date().toISOString(),recordHash:createHash("sha256").update(JSON.stringify({context,job,language})).digest("hex"),sample:currentAuthEnvironment().localPrototype};
 const files=[['Application_Review_KR.html',buildApplicationReviewHtml(context,job,metadata)],['Decision_Review_KR.html',buildDecisionReportHtml(context,job,'KR',metadata)],['Delivery_Confirmation_KR.html',buildDeliveryConfirmationHtml(context,job,metadata)]];
 const zip=new PizZip();for(const [name,html]of files)zip.file(name,html);
 zip.file('manifest.json',JSON.stringify({version:'HTML-PACK-01 v1',status:'DESIGN_PREVIEW',generatedAt:metadata.generatedAt,documents:files.map(([name,html])=>({name,sha256:createHash('sha256').update(html).digest('hex')}))},null,2));
 const bytes=zip.generate({type:'uint8array',compression:'DEFLATE'});
 const audit=await recordDocumentResponse('job',job.id,'HTML_PACKAGE_PREVIEW:KR');if(audit)return audit;
 const safeNo=job.jobNo.replace(/[^A-Za-z0-9_-]/g,'_');
 return new Response(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength) as ArrayBuffer,{headers:{'Content-Type':'application/zip','Content-Disposition':`attachment; filename="${safeNo}_HTML_Review_KR.zip"`,'X-HTML-Package-Version':'HTML-PACK-01 v1','X-HTML-Package-SHA256':createHash('sha256').update(bytes).digest('hex'),'X-HTML-Package-Bytes':String(bytes.length)}});
}
