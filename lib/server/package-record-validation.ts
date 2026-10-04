import "server-only";
import { currentAuthEnvironment } from "@/lib/supabase/auth-environment";
import { createClient } from "@/lib/supabase/server";
import { matchesPackageRecords } from "@/lib/package-record-matching";
import type { PackageContext } from "@/lib/prototype-package";
import type { Job } from "@/types/certification";

/** Use the caller's RLS session, never the service role, for authoritative identity checks. */
export async function validateStoredPackageRecords(context: PackageContext, jobs: Job[]) {
  const environment = currentAuthEnvironment();
  if (environment.localPrototype) return null;
  const unavailable = () => Response.json({ error: "DB 업무기록을 확인하지 못해 패키지 생성을 중단했습니다." }, { status: 503 });
  if (environment.blocked) return unavailable();
  try {
    const client = await createClient();
    const [application, candidate, records] = await Promise.all([
      client.from("applications").select("id,application_no,candidate_id").eq("id", context.application.id).maybeSingle(),
      client.from("candidates").select("id,name").eq("id", context.candidate.id).maybeSingle(),
      client.from("jobs").select("id,application_id,candidate_id,job_no,standard,grade").in("id", jobs.map((job) => job.id)),
    ]);
    if (application.error || candidate.error || records.error) return unavailable();
    if (!matchesPackageRecords(context, jobs, application.data, candidate.data, records.data)) {
      return Response.json({ error: "선택한 후보자·신청·Job이 DB 기록과 다릅니다. 최신 정보를 다시 불러와 주세요." }, { status: 409 });
    }
    return null;
  } catch { return unavailable(); }
}
