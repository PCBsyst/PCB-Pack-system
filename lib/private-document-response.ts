/** Applies to both downloads and validation/authorization errors. */
export function privateDocumentResponse(response: Response): Response {
  const headers = new Headers(response.headers);
  headers.set("Cache-Control", "private, no-store, max-age=0");
  headers.set("CDN-Cache-Control", "no-store");
  headers.set("Vercel-CDN-Cache-Control", "no-store");
  headers.set("Pragma", "no-cache");
  headers.set("Expires", "0");
  headers.set("X-Content-Type-Options", "nosniff");
  const vary = (headers.get("Vary") ?? "").split(",").map((value) => value.trim()).filter(Boolean);
  if (!vary.includes("*")) {
    for (const value of ["Cookie", "Authorization"]) if (!vary.some((item) => item.toLowerCase() === value.toLowerCase())) vary.push(value);
    headers.set("Vary", vary.join(", "));
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
}
