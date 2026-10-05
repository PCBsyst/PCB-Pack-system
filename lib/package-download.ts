import { boundedDownloadBlob } from "@/lib/bounded-download";

export async function verifiedPackageBlob(response: Response): Promise<Blob> {
  const sizeText = response.headers.get("X-Package-Byte-Size") ?? "";
  const sha256 = response.headers.get("X-Package-SHA256") ?? "";
  const mime = (response.headers.get("Content-Type") ?? "").split(";")[0].trim().toLowerCase();
  if (!response.ok || mime !== "application/zip" || !/^\d+$/.test(sizeText) || !/^[a-f0-9]{64}$/.test(sha256)) {
    throw new Error("ZIP 응답의 형식·크기·해시를 확인하지 못해 저장을 중단했습니다.");
  }
  const blob = await boundedDownloadBlob(response, Number(sizeText), 100 * 1024 * 1024);
  const bytes = await blob.arrayBuffer();
  const signature = new Uint8Array(bytes, 0, Math.min(4, bytes.byteLength));
  if (signature[0] !== 0x50 || signature[1] !== 0x4b || signature[2] !== 0x03 || signature[3] !== 0x04) throw new Error("ZIP 파일을 확인하지 못했습니다. 완료로 기록하지 않습니다.");
  if (!globalThis.crypto?.subtle) throw new Error("이 브라우저에서 패키지 무결성을 확인할 수 없습니다.");
  const digest = await globalThis.crypto.subtle.digest("SHA-256", bytes);
  const actual = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, "0")).join("");
  if (actual !== sha256) throw new Error("서버 생성 파일과 수신한 ZIP이 일치하지 않습니다.");
  return blob;
}
