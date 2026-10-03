import "server-only";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { currentAuthEnvironment } from "@/lib/supabase/auth-environment";

/** Records a generated response, not successful delivery or saving on the recipient's PC. */
export async function recordDocumentResponse(resourceType: "job" | "application" | "certification_action", resourceId: string, detail: string) {
  const environment = currentAuthEnvironment();
  if (environment.localPrototype) return null;
  if (environment.blocked) return Response.json({ error: "인증 서버 설정이 필요합니다." }, { status: 503 });
  const supabase = await createClient();
  const { data, error: authError } = await supabase.auth.getUser();
  if (authError || !data.user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return Response.json({ error: "접근이력 서버 설정이 필요합니다." }, { status: 503 });
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await admin.rpc("record_privacy_access", {
    event_actor: data.user.id, event_action: "DOCUMENT_RESPONSE", target_type: resourceType, target_id: resourceId, event_detail: detail,
  });
  if (error) return Response.json({ error: "문서 접근이력을 저장하지 못해 다운로드를 중단했습니다. 개인정보 접근이력 SQL(202610030018)을 확인해주세요." }, { status: 503 });
  return null;
}
