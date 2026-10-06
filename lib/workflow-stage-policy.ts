const actionStages = {
  review: ["DOCUMENT_REVIEW"],
  invoice: ["INVOICE_PENDING"],
  payment: ["PAYMENT_PENDING"],
  sharedPayment: ["INVOICE_PENDING", "PAYMENT_PENDING"],
  invoiceRecovery: ["INVOICE_PENDING", "PAYMENT_PENDING"],
  decision: ["DECISION_PENDING"],
  draft: ["CERTIFICATE_DRAFT_PENDING"],
  certification: ["CERTIFICATION_INFO_PENDING"],
  delivery: ["ORIGINAL_DELIVERY_PENDING"],
} as const;
export type WorkflowAction = keyof typeof actionStages;
export function canRunWorkflowAction(stage: string, action: WorkflowAction): boolean {
  return (actionStages[action] as readonly string[]).includes(stage);
}
