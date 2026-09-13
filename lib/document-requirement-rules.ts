import type { BusinessArea, Job } from "@/types/certification";
import { deliveryDocumentRows, type DeliveryDocumentKey, type DocumentApplicability } from "@/lib/prototype-package";

export const DOCUMENT_RULES_STORAGE_KEY = "certification-document-rules:v1";
export type DocumentRuleProfile = { businessArea: BusinessArea; standard: string; grade: string; rules: Record<DeliveryDocumentKey, DocumentApplicability> };

export function defaultApplicability(area: BusinessArea, key: DeliveryDocumentKey): DocumentApplicability {
  if (area === "K_BEAUTY" && key === "auditLog") return "NOT_APPLICABLE";
  if (["auditLog", "examNotice", "examAnswers", "survey"].includes(key)) return "CONDITIONAL";
  return "REQUIRED";
}

export function makeDefaultProfile(job: Job): DocumentRuleProfile {
  const businessArea = job.businessArea ?? "ISO";
  return { businessArea, standard: job.standard, grade: job.currentGrade, rules: Object.fromEntries(deliveryDocumentRows.map(({ key }) => [key, defaultApplicability(businessArea, key)])) as Record<DeliveryDocumentKey, DocumentApplicability> };
}

export function profileKey(profile: Pick<DocumentRuleProfile, "businessArea" | "standard" | "grade">) { return `${profile.businessArea}|${profile.standard}|${profile.grade}`; }
export function readStoredProfiles(): DocumentRuleProfile[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(window.localStorage.getItem(DOCUMENT_RULES_STORAGE_KEY) ?? "[]") as DocumentRuleProfile[]; } catch { return []; }
}
