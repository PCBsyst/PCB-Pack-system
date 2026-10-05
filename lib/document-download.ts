import { readTemplateProvenance } from "@/lib/template-provenance";
import { boundedDownloadBlob } from "@/lib/bounded-download";

/** Check receipt bytes before triggering a browser save; not proof of PC saving. */
export async function verifiedDocxBlob(response: Response): Promise<Blob> {
  const mime = (response.headers.get("Content-Type") ?? "").split(";")[0].trim().toLowerCase();
  const sha256 = response.headers.get("X-Document-SHA256") ?? "";
  const sizeText = response.headers.get("X-Document-Byte-Size") ?? "";
  const size = Number(sizeText);
  if (!response.ok || mime !== "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    || !/^[a-f0-9]{64}$/.test(sha256) || !/^\d+$/.test(sizeText) || !Number.isSafeInteger(size) || size < 4) {
    throw new Error("문서 응답 정보를 확인하지 못해 다운로드를 중단했습니다.");
  }
  readTemplateProvenance(response.headers);
  const blob = await boundedDownloadBlob(response, size, 25 * 1024 * 1024);
  const bytes = await blob.arrayBuffer();
  const signature = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength));
  if (bytes.byteLength !== size || signature[0] !== 0x50 || signature[1] !== 0x4b || signature[2] !== 0x03 || signature[3] !== 0x04) {
    throw new Error("받은 Word 파일의 크기 또는 구조가 맞지 않아 다운로드를 중단했습니다.");
  }
  if (!globalThis.crypto?.subtle) throw new Error("이 브라우저에서 문서 무결성을 확인할 수 없습니다.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const actual = Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
  if (actual !== sha256) throw new Error("서버에서 생성한 문서와 받은 파일이 달라 다운로드를 중단했습니다.");
  return blob;
}
