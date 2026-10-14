import type { SupabaseClient } from "@supabase/supabase-js";
import { readBoundedRows } from "@/lib/bounded-row-reader";

const uuid = (value: unknown) => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const label = (value: unknown) => typeof value === "string" && !!value.trim() && value.length <= 500 && !/[\u0000-\u001f]/.test(value);
export async function readRegistrationDirectories(client: Pick<SupabaseClient, "from" | "auth">, cancelled: () => boolean) {
  const auth = await client.auth.getUser();
  if (cancelled()) return null;
  if (auth.error || !auth.data.user || !uuid(auth.data.user.id)) throw new Error("직원 인증 확인 실패");
  const [candidates, partners, staff] = await Promise.all([
    readBoundedRows((from,to) => client.from("candidates").select("id, name, name_en", {count:"exact"}).order("name").order("id").range(from,to), row => row?.id, cancelled),
    readBoundedRows((from,to) => client.from("partners").select("id, name, active", {count:"exact"}).eq("active",true).order("name").order("id").range(from,to), row => row?.id, cancelled),
    readBoundedRows((from,to) => client.from("profiles").select("id, display_name, role, active", {count:"exact"}).eq("active",true).order("display_name").order("id").range(from,to), row => row?.id, cancelled),
  ]);
  if (cancelled()) return null;
  if (!candidates || !partners || !staff
    || candidates.some(row => !uuid(row.id) || !label(row.name) || row.name_en !== null && typeof row.name_en !== "string")
    || partners.some(row => !uuid(row.id) || !label(row.name) || row.active !== true)
    || staff.some(row => !uuid(row.id) || !label(row.display_name) || row.active !== true || !["ADMIN","STAFF"].includes(row.role))
    || !staff.some(row => row.id === auth.data.user!.id)) throw new Error("신청 선택 목록을 확인하지 못했습니다.");
  return { candidates: candidates.map(row => ({id:row.id,name:row.name,name_en:row.name_en})), partners, staff, ownerId: auth.data.user.id };
}
