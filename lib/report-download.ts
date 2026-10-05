import { documentErrorMessage } from "@/lib/document-errors";

export async function verifiedReportCsv(response: Response): Promise<Blob> {
  const sizeText = response.headers.get("X-Report-Byte-Size") ?? "";
  const hash = response.headers.get("X-Report-SHA256") ?? "";
  const size = Number(sizeText);
  if (!response.ok) throw new Error(await documentErrorMessage(response, "보고서를 내려받지 못했습니다."));
  if ((response.headers.get("Content-Type") ?? "").split(";")[0].trim().toLowerCase() !== "text/csv"
    || !/^\d+$/.test(sizeText) || !Number.isSafeInteger(size) || size < 3 || size > 20 * 1024 * 1024 || !/^[a-f0-9]{64}$/.test(hash)) {
    throw new Error("보고서 응답 정보를 확인하지 못해 저장을 중단했습니다.");
  }
  const blob = await response.blob();
  const bytes = await blob.arrayBuffer();
  const first = new Uint8Array(bytes);
  if (bytes.byteLength !== size || first[0] !== 0xef || first[1] !== 0xbb || first[2] !== 0xbf) throw new Error("보고서 파일의 크기·문자 형식이 맞지 않습니다.");
  if (!globalThis.crypto?.subtle) throw new Error("이 브라우저에서 보고서 무결성을 확인할 수 없습니다.");
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const actual = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (actual !== hash) throw new Error("받은 보고서가 서버 생성본과 달라 저장을 중단했습니다.");
  return blob;
}
