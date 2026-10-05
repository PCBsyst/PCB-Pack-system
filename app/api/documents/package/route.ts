import PizZip from "pizzip";
import { createHash } from "node:crypto";
import { createPackageManifest, type ManifestDocument } from "@/lib/package-manifest";
import { privateDocumentResponse } from "@/lib/private-document-response";
import { documentTranslationIssues, documentTranslationMessage } from "@/lib/document-translation-checks";
import { packageDocumentFailure } from "@/lib/document-errors";
import { validateGeneratedDocx } from "@/lib/docx-output-validation";
import { readTemplateProvenance } from "@/lib/template-provenance";
import { packageSafePath, validatePackageRequest } from "@/lib/package-request-validation";
import { validateStoredPackageRecords } from "@/lib/server/package-record-validation";
import type { PackageContext, DocumentLanguage } from "@/lib/prototype-package";
import type { Job } from "@/types/certification";
import { corporateTemplateRegistry, type CorporateDocumentType } from "@/lib/document-template-registry";
import { getActiveDocumentTemplateKeys, templateLoadErrorResponse } from "@/lib/server/document-template-loader";
import { requireApiStaff } from "@/lib/server/api-auth";
import { recordDocumentResponse } from "@/lib/server/privacy-access";
import { recordPackageGeneration, type GeneratedPackageDocument } from "@/lib/server/package-receipts";
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

export async function POST(request: Request) {
  return privateDocumentResponse(await createDocumentResponse(request));
}

async function createDocumentResponse(request: Request) {
  const authError = await requireApiStaff(["DOCUMENT_GENERATION", "PACKAGE_DOWNLOAD"]);
  if (authError) return authError;
  let input: unknown;
  try { input = await request.json(); }
  catch { return Response.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 }); }
  const validationError = validatePackageRequest(input);
  if (validationError) return Response.json({ error: validationError }, { status: 400 });
  const { context, jobs, languages } = input as RequestBody;
  const recordError = await validateStoredPackageRecords(context, jobs);
  if (recordError) return recordError;

  const selectedLanguages = new Set(languages);
  let activeTemplateKeys;
  try { activeTemplateKeys = await getActiveDocumentTemplateKeys(); }
  catch { return templateLoadErrorResponse(); }
  const templates = corporateTemplateRegistry.filter((template) => template.available || activeTemplateKeys.has(`${template.documentType}:${template.language}`));
  if (selectedLanguages.has("EN")) {
    const issues = documentTranslationIssues(context, jobs.map((job) => job.id), templates.filter((template) => template.language === "EN").map((template) => template.documentType));
    if (issues.length) return Response.json({ error: documentTranslationMessage(issues) }, { status: 422 });
  }
  const zip = new PizZip();
  let fileCount = 0;
  const generatedDocuments: GeneratedPackageDocument[] = [];
  const generatedAt = new Date().toISOString();
  const manifestDocuments: ManifestDocument[] = [];

  for (const job of jobs) {
    const safeJobNo = packageSafePath(job.jobNo);
    for (const template of templates) {
      if (!selectedLanguages.has(template.language)) continue;
      const documentRequest = new Request(request.url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ context, job, language: template.language }),
      });
      const response = await generators[template.documentType](documentRequest);
      if (!response.ok) {
        return packageDocumentFailure(response);
      }
      const bytes = new Uint8Array(await response.arrayBuffer());
      try {
        const documentZip = new PizZip(bytes);
        if (!validateGeneratedDocx(documentZip)) throw new Error("Invalid DOCX");
      } catch {
        return Response.json({ error: "생성된 Word 파일을 확인하지 못해 패키지를 중단했습니다." }, { status: 503 });
      }
      const entryName = `${safeJobNo}/${template.language}/${safeJobNo}_${template.outputName}`;
      zip.file(entryName, bytes);
      fileCount += 1;
      let provenance;
      try { provenance = readTemplateProvenance(response.headers); }
      catch { return Response.json({ error: "양식 생성 근거를 확인하지 못해 패키지 생성을 중단했습니다." }, { status: 503 }); }
      generatedDocuments.push({ jobId: job.id, documentType: template.documentType, language: template.language, entryName, template: provenance });
      manifestDocuments.push({ jobId: job.id, documentType: template.documentType, language: template.language, entryName, template: provenance, sha256: createHash("sha256").update(bytes).digest("hex"), byteSize: bytes.byteLength });
    }
  }

  if (!fileCount) return Response.json({ error: "선택한 언어에 생성 가능한 양식이 없습니다." }, { status: 422 });
  const manifest = createPackageManifest({ applicationNo: context.application.applicationNo, candidateName: context.candidate.name, generatedAt, languages, documents: manifestDocuments, jobs: jobs.map(job => ({ id: job.id, jobNo: job.jobNo, standard: job.standard, grade: job.currentGrade, certificateNo: context.certificates[job.id]?.certificationNo ?? "", issueDate: context.certificates[job.id]?.issueDate ?? "", expiryDate: context.certificates[job.id]?.expiryDate ?? "" })) });
  const complete = manifest.complete;
  zip.file("package_manifest.txt", manifest.text);
  zip.file("package_manifest.json", JSON.stringify(manifest.manifest, null, 2));

  const output = zip.generate({ type: "uint8array", compression: "DEFLATE" });
  const body = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
  const safeApplicationNo = packageSafePath(context.application.applicationNo);
  // Recheck after the last document, before recording or returning the archive.
  const finalRecordError = await validateStoredPackageRecords(context, jobs);
  if (finalRecordError) return finalRecordError;
  const accessError = await recordDocumentResponse("application", context.application.id, "CORPORATE_PACKAGE:ZIP");
  if (accessError) return accessError;
  const receipt = await recordPackageGeneration(context.application.id, generatedDocuments, complete, output);
  if (receipt.error) return receipt.error;
  return new Response(body, {
    headers: {
      "Content-Type": "application/zip",
      "Cache-Control": "private, no-store",
      "X-Package-File-Count": String(fileCount),
      "X-Package-Generated-At": generatedAt,
      "X-Package-Complete": String(complete),
      "X-Package-Receipt-Status": receipt.status,
      "X-Package-Receipt-Id": receipt.id ?? "",
      "X-Package-SHA256": receipt.sha256,
      "Content-Disposition": `attachment; filename="${safeApplicationNo}_Corporate_Documents.zip"`,
    },
  });
}
