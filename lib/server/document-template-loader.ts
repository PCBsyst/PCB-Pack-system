import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { createHash } from "node:crypto";
import { corporateTemplateRegistry } from "@/lib/document-template-registry";
import type { TemplateProvenance } from "@/lib/template-provenance";
import type { CorporateDocumentType, CorporateTemplateLanguage } from "@/lib/document-template-registry";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";

type TemplateSource = TemplateProvenance & { bytes: Uint8Array };

function describeTemplate(bytes: Uint8Array, source: TemplateProvenance["source"], version: string): TemplateSource {
  return { bytes, source, version, sha256: createHash("sha256").update(bytes).digest("hex") };
}

export async function loadDocumentTemplate(
  documentType: CorporateDocumentType,
  language: CorporateTemplateLanguage,
  fallbackFileName?: string,
): Promise<TemplateSource> {
  if (hasEnvVars) {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("document_templates")
        .select("storage_path, version")
        .eq("document_type", documentType)
        .eq("language", language)
        .eq("active", true)
        .maybeSingle();

      if (data?.storage_path) {
        const { data: file, error } = await supabase.storage.from("document-templates").download(data.storage_path);
        if (!error && file) return describeTemplate(new Uint8Array(await file.arrayBuffer()), "DATABASE", data.version || "개정번호 미기재");
      }
    } catch {
      // The migration may not be installed yet. The bundled template remains a safe fallback.
    }
  }

  if (!fallbackFileName) throw new Error(`등록된 ${documentType} ${language} 양식이 없습니다.`);
  const bytes = new Uint8Array(await readFile(path.join(process.cwd(), "templates", fallbackFileName)));
  const version = corporateTemplateRegistry.find((item) => item.documentType === documentType && item.language === language)?.version;
  return describeTemplate(bytes, "BUILT_IN", version || "개정번호 미기재");
}

export async function getActiveDocumentTemplateKeys() {
  if (!hasEnvVars) return new Set<string>();
  try {
    const supabase = await createClient();
    const { data } = await supabase.from("document_templates").select("document_type, language").eq("active", true);
    return new Set((data ?? []).map((item) => `${item.document_type}:${item.language}`));
  } catch {
    return new Set<string>();
  }
}
