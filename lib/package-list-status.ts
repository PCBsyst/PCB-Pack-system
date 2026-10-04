import type { PackageGenerationReceipt } from "@/lib/package-generation";

export type PackageListState = "IN_PROGRESS" | "READY" | "GENERATED" | "PARTIAL" | "PREVIEW" | "LEGACY";
export const packageListLabels: Record<PackageListState, string> = {
  IN_PROGRESS: "업무 진행 중", READY: "생성 준비", GENERATED: "과거 전체 생성기록", PARTIAL: "과거 부분 생성기록", PREVIEW: "생성 응답 · 서버 기록 미확인", LEGACY: "기존 이력 · 파일 확인 필요",
};
export function packageReceiptForJob(value: unknown, jobId: string | undefined): PackageGenerationReceipt | null {
  if (!value || typeof value !== "object" || !jobId) return null;
  const receipt = value as PackageGenerationReceipt;
  if (receipt.format !== "DOCX_ZIP" || !Array.isArray(receipt.jobIds) || !receipt.jobIds.includes(jobId)
    || !receipt.jobIds.every((id) => typeof id === "string" && id.length > 0) || new Set(receipt.jobIds).size !== receipt.jobIds.length
    || !Array.isArray(receipt.languages) || !receipt.languages.length || !receipt.languages.every((language) => language === "KR" || language === "EN")
    || new Set(receipt.languages).size !== receipt.languages.length || typeof receipt.complete !== "boolean"
    || !Number.isInteger(receipt.fileCount) || receipt.fileCount <= 0 || typeof receipt.generatedAt !== "string" || !Number.isFinite(Date.parse(receipt.generatedAt))) return null;
  const expected = receipt.jobIds.length * receipt.languages.length * 3;
  if (receipt.fileCount > expected || (receipt.complete ? receipt.fileCount !== expected : receipt.fileCount >= expected)) return null;
  if (receipt.receiptStatus === "RECORDED" && (typeof receipt.receiptId !== "string" || !receipt.receiptId.trim() || typeof receipt.sha256 !== "string" || !/^[a-f0-9]{64}$/.test(receipt.sha256))) return null;
  return receipt;
}
export function packageListState(workflow: { packageGeneration?: unknown; generated?: boolean; stage?: string }, jobId: string | undefined): PackageListState {
  const receipt = packageReceiptForJob(workflow.packageGeneration, jobId);
  if (receipt) return receipt.receiptStatus === "RECORDED" ? receipt.complete ? "GENERATED" : "PARTIAL" : "PREVIEW";
  if (workflow.packageGeneration || workflow.generated || workflow.stage === "COMPLETED") return "LEGACY";
  return workflow.stage === "PACKAGE_READY" ? "READY" : "IN_PROGRESS";
}
