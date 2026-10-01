export type CorporateDocumentType = "APPLICATION_REVIEW" | "CERTIFICATION_DECISION_REPORT" | "DELIVERY_CONFIRMATION";
export type CorporateTemplateLanguage = "KR" | "EN";

export type CorporateTemplateDefinition = {
  id: string;
  documentType: CorporateDocumentType;
  label: string;
  language: CorporateTemplateLanguage;
  version: string;
  available: boolean;
  outputName: string;
};

export const corporateTemplateRegistry: CorporateTemplateDefinition[] = [
  { id: "application-review-kr", documentType: "APPLICATION_REVIEW", label: "서류검토서", language: "KR", version: "FGPC-008-01 Rev.14", available: true, outputName: "Application_Review_KR.docx" },
  { id: "application-review-en", documentType: "APPLICATION_REVIEW", label: "서류검토서", language: "EN", version: "양식 미등록", available: false, outputName: "Application_Review_EN.docx" },
  { id: "decision-report-kr", documentType: "CERTIFICATION_DECISION_REPORT", label: "인증결정보고서", language: "KR", version: "FGPC-012-01 Rev.6", available: true, outputName: "Certification_Decision_Report_KR.docx" },
  { id: "decision-report-en", documentType: "CERTIFICATION_DECISION_REPORT", label: "인증결정보고서", language: "EN", version: "양식 미등록", available: false, outputName: "Certification_Decision_Report_EN.docx" },
  { id: "delivery-confirmation-kr", documentType: "DELIVERY_CONFIRMATION", label: "문서전달확인서", language: "KR", version: "양식 미등록", available: false, outputName: "Document_Delivery_Confirmation_KR.docx" },
  { id: "delivery-confirmation-en", documentType: "DELIVERY_CONFIRMATION", label: "문서전달확인서", language: "EN", version: "FGPC-012-03 Rev.4", available: true, outputName: "Document_Delivery_Confirmation_EN.docx" },
];

export const availableCorporateTemplates = corporateTemplateRegistry.filter((template) => template.available);
