import { prototypeJobId, type PrototypeApplicationRecord, type PrototypeWorkflowSnapshot, type PrototypeWorkflowStage } from "@/lib/prototype-storage";

type CompletenessWorkflow = PrototypeWorkflowSnapshot & {
  review?: { reviewer?: string; reviewedAt?: string; verifier?: string; verifiedAt?: string };
  invoiceRecipientName?: string;
  paidAmount?: string;
  payerName?: string;
  paymentConfirmedBy?: string;
  assessment?: Record<string, Record<string, string>>;
  panelMembers?: Array<{ selected?: boolean; decision?: string }>;
  decisionDate?: string;
  finalApprover?: string;
  finalApprovalDate?: string;
  decisions?: Record<string, { result?: string }>;
};

const stageOrder: PrototypeWorkflowStage[] = ["DOCUMENT_REVIEW", "INVOICE_PENDING", "PAYMENT_PENDING", "DECISION_PENDING", "CERTIFICATE_DRAFT_PENDING", "CERTIFICATION_INFO_PENDING", "ORIGINAL_DELIVERY_PENDING", "PACKAGE_READY", "COMPLETED"];

export function missingWorkflowItems(record: PrototypeApplicationRecord, snapshot: PrototypeWorkflowSnapshot) {
  const workflow = snapshot as CompletenessWorkflow;
  const stageIndex = stageOrder.indexOf(workflow.stage ?? "DOCUMENT_REVIEW");
  const jobId = prototypeJobId(record);
  const certificate = workflow.certificates?.[jobId];
  const missing: string[] = [];
  const reached = (stage: PrototypeWorkflowStage) => stageIndex >= stageOrder.indexOf(stage);
  if (!workflow.review?.reviewer || !workflow.review.reviewedAt) missing.push("1차 서류검토");
  if (!workflow.review?.verifier || !workflow.review.verifiedAt) missing.push("2차 서류검증");
  if (reached("INVOICE_PENDING") && (!workflow.invoiceNo || !workflow.invoiceAmount || !workflow.invoiceIssuedAt || !workflow.invoiceRecipientName)) missing.push("인보이스");
  if (reached("PAYMENT_PENDING") && (!workflow.paidAmount || !workflow.payerName || !workflow.paymentConfirmedAt || !workflow.paymentConfirmedBy)) missing.push("입금확인");
  if (reached("DECISION_PENDING")) {
    const assessment = workflow.assessment?.[jobId];
    if (!assessment || Object.keys(assessment).length < 5 || Object.values(assessment).some((value) => !value)) missing.push("평가항목");
    const selected = workflow.panelMembers?.filter((member) => member.selected) ?? [];
    if (selected.length < 2 || selected.some((member) => !member.decision)) missing.push("심의위원 결정");
    if (!workflow.decisionDate || !workflow.finalApprover || !workflow.finalApprovalDate || !workflow.decisions?.[jobId]?.result) missing.push("최종승인");
  }
  if (reached("CERTIFICATE_DRAFT_PENDING") && !certificate?.draftIssuedAt) missing.push("초안 발행일");
  if (reached("CERTIFICATION_INFO_PENDING") && (!certificate?.certificationNo || !certificate.issueDate || !certificate.expiryDate)) missing.push("인증정보");
  if (reached("ORIGINAL_DELIVERY_PENDING") && (!certificate?.originalSentAt || !certificate.trackingNumber)) missing.push("원본 송부");
  if (reached("COMPLETED") && !workflow.generated) missing.push("패키지 생성");
  return missing;
}
