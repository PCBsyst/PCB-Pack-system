import { requireApiStaff } from "@/lib/server/api-auth";
import { getActiveDocumentTemplateKeys, templateLoadErrorResponse } from "@/lib/server/document-template-loader";
import { templateReadiness } from "@/lib/template-readiness";

export async function GET() {
  const error = await requireApiStaff(["DOCUMENT_GENERATION"]);
  if (error) { error.headers.set("Cache-Control", "private, no-store"); return error; }
  try {
    return Response.json({ templates: templateReadiness(await getActiveDocumentTemplateKeys()) }, { headers: { "Cache-Control": "private, no-store" } });
  } catch { return templateLoadErrorResponse(); }
}
