"use client";

import { useEffect, useState } from "react";
import { ApplicationDetail } from "@/components/application-detail";
import { createClient } from "@/lib/supabase/client";
import type { Candidate, CertificationApplication, Job } from "@/types/certification";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/form-fields";
import { Save, UserRoundCog } from "lucide-react";

type WorkspaceData = { application: CertificationApplication; candidate: Candidate; jobs: Job[] };
type DatabaseJobRow = { id: string; job_no: string; management_no: number; previous_job_id: string | null; business_area: "ISO" | "K_BEAUTY"; accreditation_track: "ACCREDITED" | "NON_ACCREDITED"; standard: string; grade: string; certification_state: Job["certificationState"]; primary_owner_id: string | null };
type StaffOption = { id: string; display_name: string; role: "STAFF" | "ADMIN" };
type OwnerAssignmentLog = { previousOwner: string; nextOwner: string; reason: string; changedAt: string; changedBy: string };

export function SupabaseApplicationWorkspace({ id }: { id: string }) {
  const [data, setData] = useState<WorkspaceData | null>();
  const [error, setError] = useState("");
  const [staffOptions, setStaffOptions] = useState<StaffOption[]>([]);
  const [selectedOwnerId, setSelectedOwnerId] = useState("");
  const [assignmentReason, setAssignmentReason] = useState("");
  const [assignmentNotice, setAssignmentNotice] = useState("");
  const [savingOwner, setSavingOwner] = useState(false);
  useEffect(() => { let active = true; setData(undefined); setError(""); const supabase = createClient(); void Promise.resolve(supabase.from("applications").select("*, candidates(*), jobs(*)").eq("id", id).single()).then(async ({ data: row, error: loadError }) => {
    if (!active) return;
    if (loadError || !row) { setError(loadError?.message ?? "신청을 찾지 못했습니다."); setData(null); return; }
    const candidateRow = Array.isArray(row.candidates) ? row.candidates[0] : row.candidates;
    if (!candidateRow) throw new Error("후보자 정보를 확인할 수 없습니다.");
    const jobRows: DatabaseJobRow[] = Array.isArray(row.jobs) ? row.jobs : [];
    const ownerIds = [...new Set(jobRows.map((job) => job.primary_owner_id).filter((ownerId): ownerId is string => Boolean(ownerId)))];
    const { data: profiles } = ownerIds.length ? await supabase.from("profiles").select("id, display_name").in("id", ownerIds) : { data: [] };
    if (!active) return;
    const ownerNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
    const candidate: Candidate = { id: candidateRow.id, name: candidateRow.name, nameEn: candidateRow.name_en ?? "미입력", birthDate: candidateRow.birth_date ?? "미입력", nationality: candidateRow.nationality ?? "미입력", phone: candidateRow.phone ?? "미입력", email: candidateRow.email ?? "미입력", address: candidateRow.address ?? "미입력", jobIds: jobRows.map((job) => job.id) };
    const jobs: Job[] = jobRows.map((job) => ({ id: job.id, jobNo: job.job_no, managementNo: job.management_no, applicationId: row.id, candidateId: candidateRow.id, previousJobId: job.previous_job_id ?? undefined, businessArea: job.business_area, accreditationTrack: job.accreditation_track, partnerCompany: row.partner_name_snapshot, standard: job.standard, currentGrade: job.grade, certificationState: job.certification_state, primaryOwner: job.primary_owner_id ? ownerNames.get(job.primary_owner_id) ?? "담당자 미확인" : "담당자 미지정", cycleIds: [] }));
    const application: CertificationApplication = { id: row.id, applicationNo: row.application_no, candidateId: candidateRow.id, businessArea: row.business_area, scheme: row.accreditation_scheme === "PJLA" ? "PJLA" : "IAS", accreditationTrack: row.accreditation_track, accreditationHidden: row.accreditation_hidden, applicationType: row.application_type, receivedAt: row.received_at, registeredAt: new Date(row.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }), partnerCompany: row.partner_name_snapshot, status: row.status, managementNoFrom: row.management_no_from, managementNoTo: row.management_no_to, jobIds: jobRows.map((job) => job.id), primaryOwner: jobs[0]?.primaryOwner ?? "담당자 미지정", dropboxFolderName: row.dropbox_folder_name ?? `${row.management_no_from} ${candidateRow.name} (${jobs[0]?.currentGrade ?? ""} ${jobs[0]?.standard ?? ""} ${row.application_type})`, dropboxPath: row.dropbox_path ?? undefined, documentsStored: row.documents_stored, packageStatus: row.package_status, invoiceIds: [] };
    setData({ application, candidate, jobs });
    setSelectedOwnerId(jobRows[0]?.primary_owner_id ?? "");
  }).catch(() => { if (active) { setError("신청정보 조회에 실패했습니다. 다시 접속해 주세요."); setData(null); } }); return () => { active = false; }; }, [id]);
  useEffect(() => { const supabase = createClient(); void supabase.from("profiles").select("id, display_name, role").eq("active", true).order("display_name").then(({ data }) => setStaffOptions((data ?? []) as StaffOption[])); }, []);
  if (data === undefined) return <p className="text-sm text-slate-500">Supabase에서 신청정보를 불러오는 중입니다.</p>;
  if (!data) return <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error || "신청정보를 불러오지 못했습니다."}</div>;
  const saveOwner = async () => {
    if (!selectedOwnerId || !assignmentReason.trim()) { setAssignmentNotice("새 담당자와 변경 사유를 모두 입력해 주세요."); return; }
    const nextOwner = staffOptions.find((staff) => staff.id === selectedOwnerId);
    if (!nextOwner) { setAssignmentNotice("선택한 담당자 정보를 확인할 수 없습니다."); return; }
    const previousOwner = data.application.primaryOwner;
    if (previousOwner === nextOwner.display_name) { setAssignmentNotice("현재 담당자와 동일합니다."); return; }
    setSavingOwner(true);
    const supabase = createClient();
    const { data: userData } = await supabase.auth.getUser();
    const { data: lock, error: lockError } = await supabase.rpc("acquire_record_lock", { target_type: "application", target_id: data.application.id, lock_minutes: 15 });
    if (lockError || !lock) { setSavingOwner(false); setAssignmentNotice("다른 직원이 이 신청을 편집 중입니다. 잠시 후 다시 시도해 주세요."); return; }
    const { data: actorProfile } = userData.user ? await supabase.from("profiles").select("display_name").eq("id", userData.user.id).maybeSingle() : { data: null };
    const [{ error: applicationError }, { error: jobsError }, workspaceResult] = await Promise.all([
      supabase.from("applications").update({ primary_owner_id: selectedOwnerId }).eq("id", data.application.id),
      supabase.from("jobs").update({ primary_owner_id: selectedOwnerId }).eq("application_id", data.application.id),
      supabase.from("application_workspaces").select("state").eq("application_id", data.application.id).maybeSingle(),
    ]);
    if (applicationError || jobsError) { setSavingOwner(false); setAssignmentNotice(`담당자를 변경하지 못했습니다: ${(applicationError ?? jobsError)?.message}`); return; }
    const state = (workspaceResult.data?.state ?? {}) as Record<string, unknown> & { ownerAssignmentLogs?: OwnerAssignmentLog[] };
    const log: OwnerAssignmentLog = { previousOwner, nextOwner: nextOwner.display_name, reason: assignmentReason.trim(), changedAt: new Date().toISOString(), changedBy: actorProfile?.display_name ?? "담당자" };
    const { error: workspaceError } = await supabase.from("application_workspaces").upsert({ application_id: data.application.id, state: { ...state, ownerAssignmentLogs: [...(state.ownerAssignmentLogs ?? []), log] } }, { onConflict: "application_id" });
    setSavingOwner(false);
    if (workspaceError) { setAssignmentNotice(`담당자는 변경됐지만 변경 사유 기록에 실패했습니다: ${workspaceError.message}`); return; }
    setData({ ...data, application: { ...data.application, primaryOwner: nextOwner.display_name }, jobs: data.jobs.map((job) => ({ ...job, primaryOwner: nextOwner.display_name })) });
    setAssignmentReason(""); setAssignmentNotice(`${nextOwner.display_name} 님을 새 주 담당자로 지정했습니다.`);
  };
  return <div className="space-y-5"><section className="rounded-lg border border-blue-100 bg-blue-50 p-5"><div className="flex items-start gap-3"><UserRoundCog className="mt-1 h-5 w-5 text-blue-800"/><div className="flex-1"><h2 className="font-semibold text-blue-950">주 담당자 배정</h2><p className="mt-1 text-sm text-blue-800">현재 담당자: <strong>{data.application.primaryOwner}</strong> · 모든 활성 실무자는 계속 공동 처리할 수 있습니다.</p><div className="mt-4 grid gap-3 md:grid-cols-[220px_1fr_auto]"><select className={controlClass} value={selectedOwnerId} onChange={(event) => setSelectedOwnerId(event.target.value)}><option value="">새 담당자 선택</option>{staffOptions.map((staff) => <option key={staff.id} value={staff.id}>{staff.display_name} · {staff.role === "ADMIN" ? "관리자" : "실무자"}</option>)}</select><input className={controlClass} value={assignmentReason} onChange={(event) => setAssignmentReason(event.target.value)} placeholder="변경 사유를 입력하세요"/><Button type="button" disabled={savingOwner} onClick={() => void saveOwner()}><Save/>{savingOwner ? "저장 중..." : "담당자 변경"}</Button></div>{assignmentNotice && <p className="mt-3 text-sm font-medium text-blue-950">{assignmentNotice}</p>}</div></div></section><ApplicationDetail key={data.application.id} application={data.application} candidate={data.candidate} linkedJobs={data.jobs} invoices={[]}/></div>;
}
