import { createHash } from "node:crypto";
import { requireApiStaff } from "@/lib/server/api-auth";
import { readValidatedDocumentRequest } from "@/lib/server/document-request-validation";
import { recordDocumentResponse } from "@/lib/server/privacy-access";
import { privateDocumentResponse } from "@/lib/private-document-response";
import { documentTranslationIssues, documentTranslationMessage } from "@/lib/document-translation-checks";
import { buildDecisionReportHtml, decisionHtmlCsp, decisionHtmlVersion } from "@/lib/decision-report-html";
import { currentAuthEnvironment } from "@/lib/supabase/auth-environment";

export async function POST(request: Request) {
  try { return privateDocumentResponse(await generate(request)); }
  catch { return privateDocumentResponse(Response.json({error:"HTML 보고서 생성 결과를 확인하지 못했습니다. 다시 시도해 주세요."},{status:503})); }
}
async function generate(request: Request) {
  const denied = await requireApiStaff(["DOCUMENT_GENERATION"]);
  if (denied) return denied;
  const parsed = await readValidatedDocumentRequest(request,"KR");
  if (!parsed.ok) return parsed.response;
  const {context,job,language} = parsed.input;
  if (language === "EN") {
    const issues = documentTranslationIssues(context,[job.id],["CERTIFICATION_DECISION_REPORT"]);
    if (issues.length) return Response.json({error:documentTranslationMessage(issues)},{status:400});
  }
  const recordHash = createHash("sha256").update(JSON.stringify({context,job,language})).digest("hex");
  const generatedAt = new Date().toISOString();
  const html = buildDecisionReportHtml(context,job,language,{generatedAt,recordHash,sample:currentAuthEnvironment().localPrototype});
  const deniedAudit = await recordDocumentResponse("job",job.id,`DECISION_HTML_PREVIEW:${language}`);
  if (deniedAudit) return deniedAudit;
  const bytes = new TextEncoder().encode(html), safeNo = job.jobNo.replace(/[^A-Za-z0-9_-]/g,"_");
  return new Response(html,{headers:{"Content-Type":"text/html; charset=utf-8","Content-Disposition":`attachment; filename="${safeNo}_Decision_Review_${language}.html"`,"Content-Security-Policy":decisionHtmlCsp,"X-Report-Version":decisionHtmlVersion,"X-Report-Status":"DESIGN_PREVIEW","X-Report-SHA256":createHash("sha256").update(bytes).digest("hex"),"X-Report-Bytes":String(bytes.length),"X-Report-Generated-At":generatedAt}});
}
