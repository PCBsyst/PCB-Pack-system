import type { AccreditationTrack, BusinessArea } from "@/types/certification";

export type NumberingScheme = "GPC" | "PJLA";

export interface NumberingRule {
  businessArea: BusinessArea;
  scheme: NumberingScheme;
  accreditationTrack?: AccreditationTrack;
  field: string;
  jobPrefix: string;
  certificateCode: string;
  jobPattern: string;
  certificatePattern: string;
  sourceSheet: string;
  verified: boolean;
}

export const numberingRules: NumberingRule[] = [
  { businessArea: "ISO", scheme: "GPC", field: "ISO 9001", jobPrefix: "QMS", certificateCode: "1", jobPattern: "QMSYYNNNN", certificatePattern: "YY1GNNNN", sourceSheet: "1. 9001, 13485, 14001, 22000, 18001", verified: true },
  { businessArea: "ISO", scheme: "GPC", field: "ISO 13485", jobPrefix: "MDS", certificateCode: "2", jobPattern: "MDSYYNNNN", certificatePattern: "YY2GNNNN", sourceSheet: "1. 9001, 13485, 14001, 22000, 18001", verified: true },
  { businessArea: "ISO", scheme: "GPC", field: "ISO 14001", jobPrefix: "EMS", certificateCode: "3", jobPattern: "EMSYYNNNN", certificatePattern: "YY3GNNNN", sourceSheet: "1. 9001, 13485, 14001, 22000, 18001", verified: true },
  { businessArea: "ISO", scheme: "GPC", field: "ISO 45001", jobPrefix: "OHS", certificateCode: "4", jobPattern: "OHSYYNNNN", certificatePattern: "YY4GNNNN", sourceSheet: "1. 9001, 13485, 14001, 22000, 18001", verified: true },
  { businessArea: "ISO", scheme: "GPC", field: "ISO 22000", jobPrefix: "FMS", certificateCode: "5", jobPattern: "FMSYYNNNN", certificatePattern: "YY5GNNNN", sourceSheet: "1. 9001, 13485, 14001, 22000, 18001", verified: true },
  { businessArea: "ISO", scheme: "GPC", field: "ISO 22301", jobPrefix: "BCMS", certificateCode: "6", jobPattern: "BCMSYYNNNN", certificatePattern: "YY6GNNNN", sourceSheet: "2. 기타", verified: true },
  { businessArea: "ISO", scheme: "GPC", field: "ISO/IEC 27001", jobPrefix: "ISMS", certificateCode: "7", jobPattern: "ISMSYYNNNN", certificatePattern: "YY7GNNNN", sourceSheet: "2. 기타", verified: true },

  { businessArea: "ISO", scheme: "PJLA", field: "ISO 9001", jobPrefix: "PL-Q", certificateCode: "Q", jobPattern: "PL-QYYNNNN", certificatePattern: "YY-QGNNNN", sourceSheet: "5. PJLA", verified: true },
  { businessArea: "ISO", scheme: "PJLA", field: "ISO 14001", jobPrefix: "PL-E", certificateCode: "E", jobPattern: "PL-EYYNNNN", certificatePattern: "YY-EGNNNN", sourceSheet: "5. PJLA", verified: true },
  { businessArea: "ISO", scheme: "PJLA", field: "ISO 45001", jobPrefix: "PL-O", certificateCode: "O", jobPattern: "PL-OYYNNNN", certificatePattern: "YY-OGNNNN", sourceSheet: "5. PJLA", verified: true },
  { businessArea: "ISO", scheme: "PJLA", field: "ISO/IEC 27001", jobPrefix: "PL-IS", certificateCode: "IS", jobPattern: "PL-ISYYNNNN", certificatePattern: "YY-ISGNNNN", sourceSheet: "5. PJLA", verified: true },
  { businessArea: "ISO", scheme: "PJLA", field: "ISO/IEC 27701", jobPrefix: "PL-PI", certificateCode: "PI", jobPattern: "PL-PIYYNNNN", certificatePattern: "YY-PIGNNNN", sourceSheet: "5. PJLA", verified: true },
  { businessArea: "ISO", scheme: "PJLA", field: "ISO/IEC 42001", jobPrefix: "PL-AI", certificateCode: "AI", jobPattern: "PL-AIYYNNNN", certificatePattern: "YY-AIGNNNN", sourceSheet: "5. PJLA", verified: true },
  { businessArea: "ISO", scheme: "PJLA", field: "ISO 37001", jobPrefix: "PL-AB", certificateCode: "AB", jobPattern: "PL-ABYYNNNN", certificatePattern: "YY-ABGNNNN", sourceSheet: "5. PJLA", verified: true },
  { businessArea: "ISO", scheme: "PJLA", field: "ISO 37301", jobPrefix: "PL-C", certificateCode: "C", jobPattern: "PL-CYYNNNN", certificatePattern: "YY-CGNNNN", sourceSheet: "5. PJLA", verified: true },

  { businessArea: "K_BEAUTY", scheme: "GPC", accreditationTrack: "ACCREDITED", field: "스킨케어", jobPrefix: "SKI", certificateCode: "A", jobPattern: "SKIYYNNNN", certificatePattern: "KB-YYAGNNNN", sourceSheet: "3. K-Beauty", verified: true },
  { businessArea: "K_BEAUTY", scheme: "GPC", accreditationTrack: "ACCREDITED", field: "반영구화장", jobPrefix: "SEM", certificateCode: "B", jobPattern: "SEMYYNNNN", certificatePattern: "KB-YYBGNNNN", sourceSheet: "3. K-Beauty", verified: true },
  { businessArea: "K_BEAUTY", scheme: "GPC", accreditationTrack: "ACCREDITED", field: "SMP", jobPrefix: "SMP", certificateCode: "C", jobPattern: "SMPYYNNNN", certificatePattern: "KB-YYCGNNNN", sourceSheet: "3. K-Beauty", verified: true },
  { businessArea: "K_BEAUTY", scheme: "GPC", accreditationTrack: "ACCREDITED", field: "속눈썹연장", jobPrefix: "EYE", certificateCode: "D", jobPattern: "EYEYYNNNN", certificatePattern: "KB-YYDGNNNN", sourceSheet: "3. K-Beauty", verified: true },
  { businessArea: "K_BEAUTY", scheme: "GPC", accreditationTrack: "NON_ACCREDITED", field: "Ear therapy", jobPrefix: "EAT", certificateCode: "E", jobPattern: "EATYYNNNN", certificatePattern: "KB-YYEGNNNN", sourceSheet: "4. K-Beauty(비인정)", verified: true },
  { businessArea: "K_BEAUTY", scheme: "GPC", accreditationTrack: "NON_ACCREDITED", field: "Nail art", jobPrefix: "", certificateCode: "", jobPattern: "확인 필요", certificatePattern: "확인 필요", sourceSheet: "4. K-Beauty(비인정)", verified: false },
  { businessArea: "K_BEAUTY", scheme: "GPC", accreditationTrack: "NON_ACCREDITED", field: "Hair", jobPrefix: "HAI", certificateCode: "G", jobPattern: "HAIYYNNNN", certificatePattern: "KB-YYGGNNNN", sourceSheet: "4. K-Beauty(비인정)", verified: true },
  { businessArea: "K_BEAUTY", scheme: "GPC", accreditationTrack: "NON_ACCREDITED", field: "Make up", jobPrefix: "", certificateCode: "", jobPattern: "확인 필요", certificatePattern: "확인 필요", sourceSheet: "4. K-Beauty(비인정)", verified: false },
  { businessArea: "K_BEAUTY", scheme: "GPC", accreditationTrack: "NON_ACCREDITED", field: "Waxing", jobPrefix: "", certificateCode: "", jobPattern: "확인 필요", certificatePattern: "확인 필요", sourceSheet: "4. K-Beauty(비인정)", verified: false },
  { businessArea: "K_BEAUTY", scheme: "GPC", accreditationTrack: "NON_ACCREDITED", field: "Postpartum care", jobPrefix: "", certificateCode: "", jobPattern: "확인 필요", certificatePattern: "확인 필요", sourceSheet: "4. K-Beauty(비인정)", verified: false },

  { businessArea: "K_BEAUTY", scheme: "PJLA", field: "스킨케어", jobPrefix: "PL-SC", certificateCode: "SC", jobPattern: "PL-SCYYNNNN", certificatePattern: "KB-YY-SCGNNNN", sourceSheet: "5. PJLA_ K-Beauty", verified: true },
  { businessArea: "K_BEAUTY", scheme: "PJLA", field: "속눈썹연장", jobPrefix: "PL-EE", certificateCode: "EE", jobPattern: "PL-EEYYNNNN", certificatePattern: "KB-YY-EEGNNNN", sourceSheet: "5. PJLA_ K-Beauty", verified: true },
  { businessArea: "K_BEAUTY", scheme: "PJLA", field: "SMP", jobPrefix: "PL-SMP", certificateCode: "SMP", jobPattern: "PL-SMPYYNNNN", certificatePattern: "KB-YY-SMPGNNNN", sourceSheet: "5. PJLA_ K-Beauty", verified: true },
];

export const gradeCodes: Record<string, string> = {
  심사원보: "1", "Provisional Auditor": "1", 내부심사원: "2", "Internal Auditor": "2", 심사원: "3", Auditor: "3", 선임심사원: "4", "Lead Auditor": "4", 검증심사원: "5", "Verification Auditor": "5",
  "Pre-master": "1", Master: "2", "Global Master": "3",
};

export function getNumberingRules(area: BusinessArea, scheme: NumberingScheme, track: AccreditationTrack) {
  return numberingRules.filter((rule) => rule.businessArea === area && rule.scheme === scheme && (!rule.accreditationTrack || rule.accreditationTrack === track));
}

export function getNumberingRule(area: BusinessArea, scheme: NumberingScheme, track: AccreditationTrack, field: string) {
  return getNumberingRules(area, scheme, track).find((rule) => rule.field === field);
}
