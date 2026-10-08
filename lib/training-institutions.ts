export const TRAINING_INSTITUTIONS_KEY = "certification-training-institutions:v1";

export interface TrainingInstitution {
  id: string;
  name: string;
  designationNo: string;
  validFrom: string;
  validUntil: string;
  standards: string[];
  active: boolean;
}

export const defaultTrainingInstitutions: TrainingInstitution[] = [
  { id: "training-001", name: "한국품질연수원", designationNo: "GPC-TR-001", validFrom: "2026-01-01", validUntil: "2026-12-31", standards: ["ISO 9001", "ISO 14001"], active: true },
  { id: "training-002", name: "안전보건인재원", designationNo: "GPC-TR-002", validFrom: "2026-03-01", validUntil: "2027-02-28", standards: ["ISO 45001"], active: true },
];

export function readTrainingInstitutions(): TrainingInstitution[] {
  if (typeof window === "undefined") return defaultTrainingInstitutions;
  try {
    const value = window.localStorage.getItem(TRAINING_INSTITUTIONS_KEY);
    return value ? JSON.parse(value) as TrainingInstitution[] : defaultTrainingInstitutions;
  } catch {
    return defaultTrainingInstitutions;
  }
}

export function saveTrainingInstitutions(items: TrainingInstitution[]) {
  window.localStorage.setItem(TRAINING_INSTITUTIONS_KEY, JSON.stringify(items));
}

/** Name-only legacy records cannot identify one of several identically named institutions. */
export function unambiguousTrainingInstitutions(items: TrainingInstitution[]): TrainingInstitution[] {
  const names = new Map<string, number>();
  const key = (item: TrainingInstitution) => item.name.trim().normalize("NFC");
  for (const item of items) names.set(key(item), (names.get(key(item)) ?? 0) + 1);
  return items.filter(item => names.get(key(item)) === 1);
}

export function resolveTrainingInstitution(items: TrainingInstitution[], record: { providerInstitutionId?: string; providerName: string }): TrainingInstitution | undefined {
  if (record.providerInstitutionId) {
    const matches = items.filter(item => item.id === record.providerInstitutionId);
    return matches.length === 1 ? matches[0] : undefined;
  }
  const key = record.providerName.trim().normalize("NFC");
  if (!key) return undefined;
  return unambiguousTrainingInstitutions(items).find(item => item.name.trim().normalize("NFC") === key);
}

export function parseTrainingInstitutionRow(value: unknown): TrainingInstitution {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new Error("연수기관 응답 구성 오류");
  const row = value as Record<string, unknown>;
  const text = (key: string) => {
    const value = row[key];
    if (typeof value !== "string" || !value.trim() || value.length > 500 || /[\u0000-\u001f]/.test(value)) throw new Error("연수기관 항목 오류");
    return value;
  };
  const date = (key: string) => {
    const value = text(key), parsed = new Date(`${value}T00:00:00Z`);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) throw new Error("연수기관 날짜 오류");
    return value;
  };
  const validFrom = date("valid_from"), validUntil = date("valid_until");
  if (validUntil < validFrom || typeof row.active !== "boolean" || !Array.isArray(row.standards) || row.standards.length > 100
    || row.standards.some(item => typeof item !== "string" || !item.trim() || item.length > 300 || /[\u0000-\u001f]/.test(item))) throw new Error("연수기관 유효기간·표준 오류");
  return { id: text("id"), name: text("name"), designationNo: text("designation_no"), validFrom, validUntil, standards: row.standards as string[], active: row.active };
}
