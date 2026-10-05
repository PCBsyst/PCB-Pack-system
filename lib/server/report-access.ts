import "server-only";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** 응답 준비 기록입니다. 일부 이력만 저장된 뒤 응답이 중단될 수도 있으며 PC 저장 완료는 아닙니다. */
export async function recordMonthlyReportAccess(applicationIds: string[], detail: string): Promise<boolean> {
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret || !process.env.NEXT_PUBLIC_SUPABASE_URL || !applicationIds.length || applicationIds.length > 100 || detail.length > 100) return false;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) return false;
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  for (let offset = 0; offset < applicationIds.length; offset += 5) {
    const results = await Promise.all(applicationIds.slice(offset, offset + 5).map((id) => admin.rpc("record_privacy_access", {
      event_actor: data.user.id, event_action: "DOCUMENT_RESPONSE", target_type: "application", target_id: id, event_detail: detail,
    })));
    if (results.some((result) => result.error)) return false;
  }
  return true;
}
