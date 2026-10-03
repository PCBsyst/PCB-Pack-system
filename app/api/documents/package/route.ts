import PizZip from "pizzip";
import type { PackageContext, DocumentLanguage } from "@/lib/prototype-package";
import type { Job } from "@/types/certification";
import { corporateTemplateRegistry, type CorporateDocumentType } from "@/lib/document-template-registry";
import { getActiveDocumentTemplateKeys } from "@/lib/server/document-template-loader";
import { requireApiStaff } from "@/lib/server/api-auth";
import { recordDocumentResponse } from "@/lib/server/privacy-access";
import { POST as createApplicationReview } from "@/app/api/documents/application-review/route";
import { POST as createDecisionReport } from "@/app/api/documents/decision-report/route";
import { POST as createDeliveryConfirmation } from "@/app/api/documents/delivery-confirmation/route";

type RequestBody = {
  context: PackageContext;
  jobs: Job[];
  languages: DocumentLanguage[];
};

const generators: Record<CorporateDocumentType, (request: Request) => Promise<Response>> = {
  APPLICATION_REVIEW: createApplicationReview,
  CERTIFICATION_DECISION_REPORT: createDecisionReport,
  DELIVERY_CONFIRMATION: createDeliveryConfirmation,
};

function safePath(value: string) {
  return value.replace(/[^A-Za-z0-9_-]/g, "_");
}

export async function POST(request: Request) {
  const authError = await requireApiStaff();
  if (authError) return authError;
  const { context, jobs, languages } = await request.json() as RequestBody;
  if (!jobs?.length || !languages?.length) {
    return Response.json({ error: "Job과 언어를 하나 이상 선택해 주세요." }, { status: 400 });
  }

  const selectedLanguages = new Set(languages);
  const activeTemplateKeys = await getActiveDocumentTemplateKeys();
  const templates = corporateTemplateRegistry.filter((template) => template.available || activeTemplateKeys.has(`${template.documentType}:${template.language}`));
  const zip = new PizZip();
  const manifestLines = [
    `신청번호: ${context.application.applicationNo}`,
    `후보자: ${context.candidate.name}`,
    `생성일시: ${new Date().toISOString()}`,
    "",
    "포함된 기업 양식",
  ];

  for (const job of jobs) {
    const safeJobNo = safePath(job.jobNo);
    for (const template of templates) {
      if (!selectedLanguages.has(template.language)) continue;
      const documentRequest = new Request(request.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, job, language: template.language }),
      });
      const response = await generators[template.documentType](documentRequest);
      if (!response.ok) {
        return Response.json({ error: `${job.jobNo} ${template.outputName} 생성에 실패했습니다.` }, { status: 500 });
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      const entryName = `${safeJobNo}/${template.language}/${safeJobNo}_${template.outputName}`;
      zip.file(entryName, bytes);
      manifestLines.push(`- ${entryName}`);
    }
  }

  manifestLines.push(
    "",
    "안내",
    "- 현재 등록된 실제 기업 템플릿만 포함합니다.",
    "- 국문 문서전달확인서와 영문 서류검토서·인증결정보고서는 해당 템플릿 등록 후 추가됩니다.",
    "- PDF 일괄 생성은 다음 단계에서 연결합니다.",
  );
  zip.file("package_manifest.txt", `\ufeff${manifestLines.join("\r\n")}`);

  const output = zip.generate({ type: "uint8array", compression: "DEFLATE" });
  const body = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
  const safeApplicationNo = safePath(context.application.applicationNo);
  const accessError = await recordDocumentResponse("application", context.application.id, "CORPORATE_PACKAGE:ZIP");
  if (accessError) return accessError;
  return new Response(body, {
    headers: {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${safeApplicationNo}_Corporate_Documents.zip"`,
    },
  });
}
