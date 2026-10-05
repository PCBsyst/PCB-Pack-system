import { requireApiStaff } from "@/lib/server/api-auth";
import { createClient } from "@/lib/supabase/server";
import { readServerIdleSession } from "@/lib/server-idle-session";
import { privateDocumentResponse } from "@/lib/private-document-response";

async function status(request: Request, activity: boolean) {
  try {
    if (activity && request.headers.get("origin") !== new URL(request.url).origin) return privateDocumentResponse(Response.json({ error: "허용되지 않은 요청입니다." }, { status: 403 }));
    const denial = await requireApiStaff();
    if (denial) return privateDocumentResponse(denial);
    const result = await readServerIdleSession(await createClient(), activity);
    if (result.mode === "invalid") return privateDocumentResponse(Response.json({ error: "세션이 종료되었습니다.", code: "SESSION_ENDED" }, { status: 401 }));
    if (result.mode === "unavailable") return privateDocumentResponse(Response.json({ error: "서버 활동 상태를 확인하지 못했습니다." }, { status: 503 }));
    return privateDocumentResponse(Response.json(result));
  } catch { return privateDocumentResponse(Response.json({ error: "서버 활동 상태를 확인하지 못했습니다." }, { status: 503 })); }
}
// GET never renews a session. POST receives no client timestamps or session identifiers.
export async function GET(request: Request) { return status(request, false); }
export async function POST(request: Request) { return status(request, true); }
