import { validatePackageRequest } from "@/lib/package-request-validation";
import type { DocumentLanguage, PackageContext } from "@/lib/prototype-package";
import type { Job } from "@/types/certification";

export type ValidatedDocumentInput = { context: PackageContext; job: Job; language: DocumentLanguage };
export function validateDocumentInput(value: unknown, defaultLanguage: DocumentLanguage):
  { ok: true; input: ValidatedDocumentInput } | { ok: false; error: string } {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, error: "문서 요청 형식이 올바르지 않습니다." };
  const input = value as Record<string, unknown>;
  const language = input.language === undefined ? defaultLanguage : input.language;
  const error = validatePackageRequest({ context: input.context, jobs: [input.job], languages: [language] });
  if (error) return { ok: false, error };
  return { ok: true, input: { context: input.context as PackageContext, job: input.job as Job, language: language as DocumentLanguage } };
}
