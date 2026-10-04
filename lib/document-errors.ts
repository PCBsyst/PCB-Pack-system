/** Only bounded JSON messages, never HTML error pages or arbitrary objects. */
export async function documentErrorMessage(response: Response, fallback = "문서 생성에 실패했습니다. 잠시 후 다시 시도해 주세요.") {
  if (!(response.headers.get("Content-Type") ?? "").toLowerCase().includes("application/json")) return fallback;
  try {
    const body: unknown = await response.json();
    if (!body || typeof body !== "object" || Array.isArray(body)) return fallback;
    const error = (body as Record<string, unknown>).error;
    return typeof error === "string" && error.trim() && error.length <= 600 && !/[<>\x00-\x1f]/.test(error) ? error : fallback;
  } catch { return fallback; }
}

export async function packageDocumentFailure(response: Response) {
  const status = [400, 401, 403, 409, 422, 429, 503].includes(response.status) ? response.status : 503;
  const message = await documentErrorMessage(response);
  return Response.json({ error: message }, { status, headers: { "Cache-Control": "private, no-store" } });
}
