import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { requireApiStaff } from "@/lib/server/api-auth";

export async function POST(request: Request) {
  const authError = await requireApiStaff();
  if (authError) return authError;
  const siteUrl = process.env.APP_SITE_URL;
  let expectedOrigin: string;
  try { expectedOrigin = new URL(siteUrl ?? "").origin; }
  catch { return Response.json({ error: "사이트 설정이 필요합니다." }, { status: 503 }); }
  if (request.headers.get("origin") !== expectedOrigin) return Response.json({ error: "허용되지 않은 요청입니다." }, { status: 403 });
  const supabase = await createClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return Response.json({ error: "로그인이 필요합니다." }, { status: 401 });
  const { data: allowed, error: permissionError } = await supabase.rpc("is_admin");
  if (permissionError || !allowed) return Response.json({ error: "최고관리자만 수정할 수 있습니다." }, { status: 403 });
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return Response.json({ error: "계정 관리 서버 설정이 필요합니다." }, { status: 503 });
  let body;
  try { body = await request.json(); } catch { return Response.json({ error: "잘못된 입력입니다." }, { status: 400 }); }
  const id = typeof body?.id === "string" ? body.id : "";
  const name = typeof body?.name === "string" ? body.name.trim() : "";
  const email = typeof body?.email === "string" ? body.email.trim().toLowerCase() : "";
  const reason = typeof body?.reason === "string" ? body.reason.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(id) || !name || name.length > 100 || email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !reason || reason.length > 1000)
    return Response.json({ error: "이름, 올바른 이메일 및 변경 사유를 입력해주세요." }, { status: 400 });
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  // Refuse to change Auth before the required migration has been installed.
  const { error: migrationError } = await admin.rpc("save_staff_identity", { target_id: id, actor_id: auth.user.id, staff_name: name, staff_email: email, reason, expected_name: null, expected_email: null, validate_only: true });
  if (migrationError) return Response.json({ error: "직원정보 변경 SQL(202610030017)을 적용하고 권한을 확인해주세요." }, { status: 503 });
  const { data: previous, error: lookupError } = await admin.from("profiles").select("display_name,email,is_owner").eq("id", id).single();
  if (lookupError || !previous) return Response.json({ error: "직원정보를 확인하지 못했습니다." }, { status: 404 });
  if (previous.is_owner && email !== previous.email) return Response.json({ error: "최고관리자 본인의 이메일 변경은 지원하지 않습니다." }, { status: 400 });
  const emailChanged = email !== previous.email;
  if (emailChanged) {
    const { error } = await admin.auth.admin.updateUserById(id, { email });
    if (error) return Response.json({ error: "로그인 이메일 변경에 실패했습니다. 중복 이메일 여부를 확인해주세요." }, { status: 409 });
  }
  const { error } = await admin.rpc("save_staff_identity", { target_id: id, actor_id: auth.user.id, staff_name: name, staff_email: email, reason, expected_name: previous.display_name, expected_email: previous.email });
  if (error) {
    const rollback = emailChanged ? await admin.auth.admin.updateUserById(id, { email: previous.email }) : null;
    return Response.json({ error: rollback?.error ? "계정과 직원정보의 주소가 일치하지 않을 수 있습니다. 추가 수정하지 말고 관리자 점검이 필요합니다." : "저장하지 못했습니다. 화면을 새로고침하거나 직원정보 변경 SQL 적용 여부를 확인해주세요." }, { status: 500 });
  }
  return Response.json({ message: "직원정보를 저장했습니다. 이메일 변경 시 다음 로그인부터 새 주소를 사용해주세요.", name, email });
}
