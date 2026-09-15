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
