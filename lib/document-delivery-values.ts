import type { DocumentLanguage, PackageContext } from "@/lib/prototype-package";

/** Use recorded dates only; issuance is not proof of physical dispatch or receipt. */
export function documentDeliveryValues(context: PackageContext, jobId: string, language: DocumentLanguage) {
  const certificate = context.certificates[jobId];
  const english = language === "EN";
  const dateValues = {
    receivedAt: context.application.receivedAt || "-",
    reviewedAt: context.review.reviewedAt || "-",
    verifiedAt: context.review.verifiedAt || "-",
    decisionDate: context.decisionDate || "-",
    finalApprovalDate: context.finalApprovalDate || "-",
    draftIssuedAt: certificate?.draftIssuedAt || "-",
    issueDate: certificate?.issueDate || "-",
    expiryDate: certificate?.expiryDate || "-",
    originalSentAt: certificate?.originalSentAt || "-",
    trackingNumber: certificate?.trackingNumber || "-",
    invoiceIssuedAt: context.invoiceIssuedAt || "-",
    paymentConfirmedAt: context.paymentConfirmedAt || "-",
  };
  const labels = english
    ? ["Received", "Reviewed", "Verified", "Panel decision", "Final approval", "Draft issued", "Certificate issued"]
    : ["신청 접수일", "서류 검토일", "검증일", "심의일", "최종 승인일", "초안 발행일", "인증 발행일"];
  const chronology = [dateValues.receivedAt, dateValues.reviewedAt, dateValues.verifiedAt, dateValues.decisionDate, dateValues.finalApprovalDate, dateValues.draftIssuedAt, dateValues.issueDate]
    .map((value, index) => `${labels[index]}: ${value}`).join(" / ");
  return {
    ...dateValues,
    chronology,
    invoiceNote: context.invoiceNo
      ? english ? `Invoice: ${context.invoiceNo} / Issued: ${dateValues.invoiceIssuedAt} / Paid: ${dateValues.paymentConfirmedAt}`
        : `인보이스: ${context.invoiceNo} / 발행일: ${dateValues.invoiceIssuedAt} / 입금일: ${dateValues.paymentConfirmedAt}` : "",
    dispatchNote: certificate?.originalSentAt || certificate?.trackingNumber
      ? english ? `Original dispatched: ${dateValues.originalSentAt} / Tracking No.: ${dateValues.trackingNumber}`
        : `원본 송부일: ${dateValues.originalSentAt} / 운송장 번호: ${dateValues.trackingNumber}` : "",
    ownerNote: `${english ? "Person in charge" : "담당자"}: ${context.application.primaryOwner || "-"}`,
  };
}
