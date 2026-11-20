import "server-only";
import { validateDocumentInput } from "@/lib/document-request-validation";
import { validateStoredPackageRecords } from "@/lib/server/package-record-validation";
import type { DocumentLanguage } from "@/lib/prototype-package";
import {readEvidenceReview} from "@/lib/evidence-review";

export async function readValidatedDocumentRequest(request: Request, defaultLanguage: DocumentLanguage) {
  let value: unknown;
  try { value = await request.json(); }
  catch { return { ok: false as const, response: Response.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 }) }; }
  const parsed = validateDocumentInput(value, defaultLanguage);
  if (!parsed.ok) return { ok: false as const, response: Response.json({ error: parsed.error }, { status: 400 }) };
  if(parsed.input.context.evidenceReview!==undefined&&!readEvidenceReview(parsed.input.context.evidenceReview))return {ok:false as const,response:Response.json({error:"증빙 근거 기록 형식이 올바르지 않습니다."},{status:400})};
  const error = await validateStoredPackageRecords(parsed.input.context, [parsed.input.job]);
  if (error) return { ok: false as const, response: error };
  return { ok: true as const, input: parsed.input };
}
