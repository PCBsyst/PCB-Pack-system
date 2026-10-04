import type PizZip from "pizzip";
import type { CorporateDocumentType } from "@/lib/document-template-registry";

// 양식을 재설계하더라도 업무 기록의 핵심 입력 칸은 본문에 있어야 합니다.
const common = ["candidateName", "jobNo", "standard", "grade"];
const requirements: Record<CorporateDocumentType, string[]> = {
  APPLICATION_REVIEW: [...common, "birthDate", "candidateNameEn", "nationality", "address", "email", "phone", "initialMark", "renewalMark", "specialRequirements", "academicDocumentMark", "careerDocumentMark", "educationDocumentMark", "auditLogDocumentMark", "otherDocumentMark", "receivedAt", "reviewResult", "reviewComment", "reviewer", "reviewedAt", "verifier", "verifiedAt", "verificationResult"],
  CERTIFICATION_DECISION_REPORT: [...common, "knowledge", "personality", "education", "academic", "auditExperience", "assessmentComment", "approveMark", "rejectMark", "reapproveMark", "certificationNo", "validityPeriod", "decisionComment", "panelMembers", "decisionDate", "finalApprover", "finalApprovalDate"],
  DELIVERY_CONFIRMATION: [...common, "certificationNo", "note", ...["application", "career", "education", "diploma", "auditLog", "agreement", "examNotice", "examAnswers", "decisionReport", "certificate", "survey", "deliveryConfirmation"].flatMap((key) => [`${key}Mark`, `${key}Date`])],
};

export function missingDocumentTemplateFields(zip: PizZip, documentType: CorporateDocumentType): string[] {
  const body = (zip.file("word/document.xml")?.asText() ?? "").replace(/<!--[\s\S]*?-->/g, "");
  // 머릿글, 메타데이터, XML 주석에만 존재하는 키는 본문 입력 칸으로 인정하지 않습니다.
  // 현재 치환기가 처리할 수 없는 분리된 Word 텍스트도 생성 전에 거절합니다.
  const runs = [...body.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)].map((match) => match[1]);
  return requirements[documentType].filter((key) => !runs.some((text) => text.includes(`{{${key}}}`)));
}

export function documentTemplateFieldsError(missing: string[]) {
  return Response.json({ error: `양식 본문에 필수 입력 칸이 없어 문서 생성을 중단했습니다. 양식 관리자에게 다음 항목을 확인해 주세요: ${missing.join(", ")}` }, { status: 503 });
}
