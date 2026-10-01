import "server-only";

import { readFile } from "node:fs/promises";
import path from "node:path";
import type { CorporateDocumentType, CorporateTemplateLanguage } from "@/lib/document-template-registry";
import { createClient } from "@/lib/supabase/server";
import { hasEnvVars } from "@/lib/utils";

type TemplateSource = { bytes: Uint8Array; source: "DATABASE" | "BUILT_IN"; version?: string };

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
        if (!error && file) return { bytes: new Uint8Array(await file.arrayBuffer()), source: "DATABASE", version: data.version };
      }
    } catch {
      // The migration may not be installed yet. The bundled template remains a safe fallback.
    }
  }

  if (!fallbackFileName) throw new Error(`등록된 ${documentType} ${language} 양식이 없습니다.`);
  return {
    bytes: new Uint8Array(await readFile(path.join(process.cwd(), "templates", fallbackFileName))),
    source: "BUILT_IN",
  };
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
