import type { SupabaseClient } from "@supabase/supabase-js";

export type CertificationApplicationRow = {
  id: string;
  application_no: string;
  candidate_id: string;
  business_area: "ISO" | "K_BEAUTY";
  accreditation_scheme: string;
  accreditation_track: "ACCREDITED" | "NON_ACCREDITED";
  accreditation_hidden: boolean;
  application_type: "최초" | "갱신" | "등급변경" | "전환" | "기타";
  received_at: string;
  partner_name_snapshot: string;
  status: string;
  management_no_from: number;
  management_no_to: number;
  package_status: "NOT_READY" | "READY" | "GENERATED";
  primary_owner_id: string | null;
};

export type NewApplicationInput = Omit<CertificationApplicationRow, "id" | "status" | "package_status"> & {
  status?: CertificationApplicationRow["status"];
  package_status?: CertificationApplicationRow["package_status"];
  created_by: string;
};

export async function listCertificationApplications(client: SupabaseClient) {
  const { data, error } = await client
    .from("applications")
    .select("*, candidates(*), jobs(*)")
    .order("received_at", { ascending: false });
  if (error) throw error;
  return data;
}

export async function createCertificationApplication(client: SupabaseClient, input: NewApplicationInput) {
  const { data, error } = await client
    .from("applications")
    .insert({ ...input, status: input.status ?? "INTAKE_REVIEW", package_status: input.package_status ?? "NOT_READY" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function acquireRecordLock(client: SupabaseClient, resourceType: string, resourceId: string, minutes = 15) {
  const { data, error } = await client.rpc("acquire_record_lock", { target_type: resourceType, target_id: resourceId, lock_minutes: minutes });
  if (error) throw error;
  return data;
}

export async function releaseRecordLock(client: SupabaseClient, resourceType: string, resourceId: string, userId: string) {
  const { error } = await client.from("record_locks").delete().eq("resource_type", resourceType).eq("resource_id", resourceId).eq("locked_by", userId);
  if (error) throw error;
}
