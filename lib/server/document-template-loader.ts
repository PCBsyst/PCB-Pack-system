import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { corporateTemplateRegistry } from "@/lib/document-template-registry";
import type { TemplateProvenance } from "@/lib/template-provenance";
import type { CorporateDocumentType, CorporateTemplateLanguage } from "@/lib/document-template-registry";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";
import { isMissingTemplateTable } from "@/lib/template-load-policy";

type TemplateSource = TemplateProvenance & { bytes: Uint8Array };

export function templateLoadErrorResponse() {
  return Response.json({ error: "등록 양식 상태를 확인하지 못해 문서 생성을 중단했습니다. 양식 등록 및 저장소 상태를 확인해 주세요." }, { status: 503, headers: { "Cache-Control": "private, no-store" } });
}

function describeTemplate(bytes: Uint8Array, source: TemplateProvenance["source"], version: string): TemplateSource {
  return { bytes, source, version, sha256: createHash("sha256").update(bytes).digest("hex") };
}

export async function loadDocumentTemplate(
  documentType: CorporateDocumentType,
  language: CorporateTemplateLanguage,
  fallbackFileName?: string,
): Promise<TemplateSource> {
  if (hasEnvVars) {
      const supabase = await createClient();
      const { data, error: lookupError } = await supabase
        .from("document_templates")
        .select("storage_path, version")
        .eq("document_type", documentType)
        .eq("language", language)
        .eq("active", true)
        .maybeSingle();

      if (lookupError && !isMissingTemplateTable(lookupError)) throw new Error("Template lookup unavailable");

      if (data && !lookupError) {
        if (!data.storage_path) throw new Error("Template path unavailable");
        const { data: file, error } = await supabase.storage.from("document-templates").download(data.storage_path);
        if (error || !file) throw new Error("Registered template download unavailable");
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (!bytes.length) throw new Error("Registered template empty");
        return describeTemplate(bytes, "DATABASE", data.version || "개정번호 미기재");
      }
  }

  if (!fallbackFileName) throw new Error(`등록된 ${documentType} ${language} 양식이 없습니다.`);
  const bytes = new Uint8Array(await readFile(path.join(process.cwd(), "templates", fallbackFileName)));
  const version = corporateTemplateRegistry.find((item) => item.documentType === documentType && item.language === language)?.version;
  return describeTemplate(bytes, "BUILT_IN", version || "개정번호 미기재");
}

export async function getActiveDocumentTemplateKeys() {
  if (!hasEnvVars) return new Set<string>();
    const supabase = await createClient();
    const { data, error } = await supabase.from("document_templates").select("document_type, language").eq("active", true);
    if (error) {
      if (isMissingTemplateTable(error)) return new Set<string>();
      throw new Error("Template registry unavailable");
    }
    return new Set((data ?? []).map((item) => `${item.document_type}:${item.language}`));
}
