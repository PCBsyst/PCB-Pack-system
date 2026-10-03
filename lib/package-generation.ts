export type PackageGenerationReceipt = { generatedAt: string; fileCount: number; complete: boolean; jobIds: string[]; languages: Array<"KR" | "EN">; format: "DOCX_ZIP"; receiptId?: string; receiptStatus?: string; sha256?: string };

export function parsePackageGeneration(headers: Headers, jobIds: string[], languages: Array<"KR" | "EN">): PackageGenerationReceipt {
  const fileCount = Number(headers.get("X-Package-File-Count"));
  const generatedAt = headers.get("X-Package-Generated-At") ?? "";
  const completeValue = headers.get("X-Package-Complete");
  if (!Number.isInteger(fileCount) || fileCount <= 0 || !Number.isFinite(Date.parse(generatedAt)) || !["true", "false"].includes(completeValue ?? "")) throw new Error("패키지 생성 결과를 확인하지 못했습니다. 완료로 기록하지 않습니다.");
  if (completeValue === "true" && fileCount !== new Set(jobIds).size * new Set(languages).size * 3) throw new Error("패키지 파일 수가 선택한 문서 범위와 일치하지 않습니다.");
  const receiptStatus = headers.get("X-Package-Receipt-Status") ?? "UNVERIFIED";
  const receiptId = headers.get("X-Package-Receipt-Id") ?? "";
  const sha256 = headers.get("X-Package-SHA256") ?? "";
  if (receiptStatus === "RECORDED" && (!receiptId || !/^[a-f0-9]{64}$/.test(sha256))) throw new Error("서버 생성기록의 식별값을 확인하지 못했습니다.");
  return { fileCount, generatedAt, complete: completeValue === "true", jobIds, languages, format: "DOCX_ZIP", receiptStatus, receiptId, sha256 };
}
