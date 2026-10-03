import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  const siteUrl = process.env.APP_SITE_URL;
  if (!siteUrl || origin !== new URL(siteUrl).origin) return Response.json({ error: "허용되지 않은 요청 또는 사이트 설정 누락입니다." }, { status: 403 });
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { data: allowed, error: permissionError } = await supabase.rpc("is_account_inviter");
  if (permissionError || !allowed) return Response.json({ error: "최고관리자 또는 서브 관리자만 초대할 수 있습니다." }, { status: 403 });
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return Response.json({ error: "초대 이메일 서버 설정이 필요합니다." }, { status: 503 });
  let payload: { name?: unknown; email?: unknown };
  try { payload = await request.json(); } catch { return Response.json({ error: "잘못된 입력입니다." }, { status: 400 }); }
  const name = typeof payload.name === "string" ? payload.name.trim() : "";
  const email = typeof payload.email === "string" ? payload.email.trim().toLowerCase() : "";
  if (!name || name.length > 100 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return Response.json({ error: "직원 이름과 올바른 이메일을 입력해 주세요." }, { status: 400 });
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: duplicate, error: lookupError } = await admin.from("profiles").select("id").eq("email", email).limit(1);
  if (lookupError) return Response.json({ error: "직원 명단을 확인하지 못했습니다." }, { status: 503 });
  if (duplicate?.length) return Response.json({ error: "이미 등록된 이메일입니다." }, { status: 409 });
  const { data: invitation, error } = await admin.auth.admin.inviteUserByEmail(email, {
    data: { display_name: name, invited_by: userData.user.id },
    redirectTo: `${new URL(siteUrl).origin}/auth/update-password`,
  });
  if (error || !invitation.user) return Response.json({ error: "초대 발송에 실패했습니다. 이메일 설정과 발송 한도를 확인해 주세요." }, { status: 502 });
  // The approval migration creates this account as inactive STAFF. Never accept role/active from the caller.
  const { error: auditError } = await admin.from("audit_logs").insert({ table_name: "staff_invitations", record_id: invitation.user.id, action: "INSERT", actor_id: userData.user.id, after_data: { email, display_name: name, active: false, role: "STAFF" }, correction_reason: "직원 이메일 초대" });
  if (auditError) return Response.json({ error: "초대 메일은 발송됐지만 초대 이력 저장에 실패했습니다. 최고관리자가 확인해야 합니다." }, { status: 500 });
  return Response.json({ message: "초대 이메일을 발송했습니다. 비밀번호 설정 후 최고관리자의 활성화 승인이 필요합니다." });
}
