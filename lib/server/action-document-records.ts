import "server-only";
import { createClient } from "@/lib/supabase/server";
import { actionDocumentFromRecords, type ActionDocumentInput } from "@/lib/action-document-records";

export async function loadStoredActionDocument(input: ActionDocumentInput) {
  const unavailable = () => ({ ok: false as const, response: Response.json({ error: "정지·철회 원본을 확인하지 못해 문서 생성을 중단했습니다." }, { status: 503 }) });
  try {
    const client = await createClient();
    const action = await client.from("certification_actions").select("id,job_id,certification_record_id,action_type,standard_reason,detail_reason,effective_date,recorded_by_name,created_at").eq("id", input.actionId).maybeSingle();
    if (action.error) return unavailable();
    if (!action.data) return { ok: false as const, response: Response.json({ error: "조회 가능한 정지·철회 기록이 없습니다." }, { status: 404 }) };
    if (action.data.job_id !== input.jobId) return { ok: false as const, response: Response.json({ error: "선택한 Job과 정지·철회 기록이 일치하지 않습니다." }, { status: 409 }) };
    const [job, certificate] = await Promise.all([
      client.from("jobs").select("id,job_no,management_no,candidate_id").eq("id", input.jobId).maybeSingle(),
      client.from("certification_records").select("id,job_id,certification_no,issue_date").eq("id", action.data.certification_record_id).maybeSingle(),
    ]);
    if (job.error || certificate.error || !job.data || !certificate.data) return unavailable();
    const candidate = await client.rpc("read_candidate_with_access_log", { target_id: job.data.candidate_id });
    if (candidate.error) return unavailable();
    const values = actionDocumentFromRecords(input, action.data, job.data, certificate.data, candidate.data);
    if (!values) return { ok: false as const, response: Response.json({ error: "정지·철회 원본 연결이나 필수 정보를 확인해 주세요." }, { status: 409 }) };
    return { ok: true as const, values };
  } catch { return unavailable(); }
}
