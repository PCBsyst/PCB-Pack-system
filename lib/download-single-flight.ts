const pendingDownloads = new Set<string>();

/** Same browser module only; not cross-tab or server idempotency. */
export async function withDownloadSingleFlight<T>(key: string, task: () => Promise<T>): Promise<T> {
  if (pendingDownloads.has(key)) throw new Error("이미 문서를 생성하고 있습니다. 완료된 후 다시 시도해 주세요.");
  pendingDownloads.add(key);
  try { return await task(); }
  finally { pendingDownloads.delete(key); }
}
