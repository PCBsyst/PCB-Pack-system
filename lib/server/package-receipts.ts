import "server-only";
import type { TemplateProvenance } from "@/lib/template-provenance";
import { createHash } from "node:crypto";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { currentAuthEnvironment } from "@/lib/supabase/auth-environment";

export type GeneratedPackageDocument = { jobId: string; documentType: string; language: string; entryName: string; template: TemplateProvenance };

/** Receipt proves server file creation, not successful transport or saving to a PC. */
export async function recordPackageGeneration(applicationId: string, documents: GeneratedPackageDocument[], complete: boolean, bytes: Uint8Array) {
  const sha256 = createHash("sha256").update(bytes).digest("hex");
  const environment = currentAuthEnvironment();
  if (environment.localPrototype) return { id: null, status: "LOCAL_PREVIEW", sha256, error: null };
  if (environment.blocked) return { id: null, status: "FAILED", sha256, error: Response.json({ error: "인증 설정이 필요합니다." }, { status: 503 }) };
  const client = await createClient();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) return { id: null, status: "FAILED", sha256, error: Response.json({ error: "로그인이 필요합니다." }, { status: 401 }) };
  const secret = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!secret) return { id: null, status: "FAILED", sha256, error: Response.json({ error: "서버 기록 설정이 필요합니다." }, { status: 503 }) };
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, secret, { auth: { persistSession: false, autoRefreshToken: false } });
  const result = await admin.rpc("record_package_generation", {
    event_actor: data.user.id, target_application: applicationId, generated_documents: documents,
    package_complete: complete, package_sha256: sha256, package_byte_size: bytes.byteLength,
  });
  if (result.error) {
    // Rollout compatibility only for the specifically absent new RPC, not general DB failures.
    if (result.error.code === "PGRST202" && result.error.message.includes("record_package_generation")) return { id: null, status: "DB_PENDING", sha256, error: null };
    return { id: null, status: "FAILED", sha256, error: Response.json({ error: "패키지 생성기록을 저장하지 못해 다운로드를 중단했습니다." }, { status: 503 }) };
  }
  if (typeof result.data !== "string" || !result.data) return { id: null, status: "FAILED", sha256, error: Response.json({ error: "패키지 생성기록 결과를 확인하지 못했습니다." }, { status: 503 }) };
  return { id: result.data, status: "RECORDED", sha256, error: null };
}
