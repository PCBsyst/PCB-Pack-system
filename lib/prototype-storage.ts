import type { AccreditationTrack, ApplicationType, BusinessArea } from "@/types/certification";

export const PROTOTYPE_APPLICATIONS_KEY = "certification-prototype-applications";

export interface PrototypeApplicationRecord {
  id: string;
  applicationNo: string;
  receivedAt: string;
  candidateName: string;
  businessArea: BusinessArea;
  accreditationTrack: AccreditationTrack;
  accreditationHidden: boolean;
  applicationType: ApplicationType;
  managementNo: number;
  jobNo: string;
  standard: string;
  grade: string;
  partnerCompany: string;
  primaryOwner: string;
  status: "INTAKE_REVIEW";
  createdAt: string;
}

export function readPrototypeApplications(): PrototypeApplicationRecord[] {
  if (typeof window === "undefined") return [];
  try {
    return JSON.parse(window.localStorage.getItem(PROTOTYPE_APPLICATIONS_KEY) ?? "[]") as PrototypeApplicationRecord[];
  } catch {
    return [];
  }
}

export function savePrototypeApplication(record: PrototypeApplicationRecord) {
  const records = readPrototypeApplications();
  window.localStorage.setItem(PROTOTYPE_APPLICATIONS_KEY, JSON.stringify([record, ...records]));
}
