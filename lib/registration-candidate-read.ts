import type { SupabaseClient } from "@supabase/supabase-js";

export type RegistrationCandidateProfile = { id: string; name: string; name_en: string | null; birth_date: string | null; nationality: string | null; email: string | null; phone: string | null };
export async function readRegistrationCandidate(client: Pick<SupabaseClient,"rpc">, id: string, cancelled: () => boolean): Promise<RegistrationCandidateProfile | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) throw new Error("후보자 식별값 오류");
  if (cancelled()) return null;
  const {data,error} = await client.rpc("read_candidate_with_access_log", {target_id:id});
  if (cancelled()) return null;
  if (error || !data || typeof data !== "object" || Array.isArray(data) || data.id !== id || typeof data.name !== "string" || !data.name.trim()
    || ["name_en","birth_date","nationality","email","phone"].some(key => data[key] !== null && typeof data[key] !== "string")) throw new Error("후보자 상세 조회 미확인");
  return {id:data.id,name:data.name,name_en:data.name_en,birth_date:data.birth_date,nationality:data.nationality,email:data.email,phone:data.phone};
}
