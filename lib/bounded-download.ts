/** Limits decoded response bytes, not merely the Content-Length supplied by a server. */
export async function boundedDownloadBlob(response: Response, expectedSize: number, maximumSize: number): Promise<Blob> {
  if (!Number.isSafeInteger(expectedSize) || expectedSize < 1 || expectedSize > maximumSize || !response.body) {
    throw new Error("파일 크기 정보를 확인하지 못해 다운로드를 중단했습니다.");
  }
  const reader = response.body.getReader();
  const chunks: ArrayBuffer[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > expectedSize || total > maximumSize) throw new Error("받은 파일이 허용 크기를 초과해 다운로드를 중단했습니다.");
      chunks.push(value.slice().buffer as ArrayBuffer);
    }
    if (total !== expectedSize) throw new Error("파일 수신이 완전하지 않아 다운로드를 중단했습니다.");
    return new Blob(chunks, { type: response.headers.get("Content-Type") ?? "application/octet-stream" });
  } catch (error) {
    try { await reader.cancel(); } catch { /* Preserve the original verification failure. */ }
    throw error;
  } finally {
    reader.releaseLock();
  }
}
