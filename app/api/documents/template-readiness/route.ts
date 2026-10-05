import { requireApiStaff } from "@/lib/server/api-auth";
import { getActiveDocumentTemplateKeys, loadDocumentTemplate, templateLoadErrorResponse } from "@/lib/server/document-template-loader";
import { templateReadiness } from "@/lib/template-readiness";
import { corporateTemplateRegistry } from "@/lib/document-template-registry";

const builtInFiles: Record<string, string> = {
  "application-review-kr": "FGPC-008-01-application-review-kr.docx",
  "decision-report-kr": "FGPC-012-01-decision-report-kr.docx",
  "delivery-confirmation-en": "FGPC-012-03-delivery-confirmation-en.docx",
};

export async function GET() {
  const error = await requireApiStaff(["DOCUMENT_GENERATION"]);
  if (error) { error.headers.set("Cache-Control", "private, no-store"); return error; }
  try {
    const rows = templateReadiness(await getActiveDocumentTemplateKeys());
    await Promise.all(rows.filter((row) => row.source !== "MISSING").map(async (row) => {
      const definition = corporateTemplateRegistry.find((template) => template.id === row.id)!;
      const loaded = await loadDocumentTemplate(definition.documentType, definition.language, builtInFiles[row.id]);
      // 조회 사이 등록 변경이 발생하면 오래된 준비 상태를 반환하지 않습니다.
      if (loaded.source !== row.source) throw new Error("Template source changed during verification");
    }));
    return Response.json({ templates: rows }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return templateLoadErrorResponse(); }
}
