"use client";

import { useEffect, useState } from "react";
import { ApplicationDetail } from "@/components/application-detail";
import { createClient } from "@/lib/supabase/client";
import type { Candidate, CertificationApplication, Job } from "@/types/certification";

type WorkspaceData = { application: CertificationApplication; candidate: Candidate; jobs: Job[] };
type DatabaseJobRow = { id: string; job_no: string; management_no: number; business_area: "ISO" | "K_BEAUTY"; accreditation_track: "ACCREDITED" | "NON_ACCREDITED"; standard: string; grade: string; certification_state: Job["certificationState"]; primary_owner_id: string | null };

export function SupabaseApplicationWorkspace({ id }: { id: string }) {
  const [data, setData] = useState<WorkspaceData | null>();
  const [error, setError] = useState("");
  useEffect(() => { const supabase = createClient(); void supabase.from("applications").select("*, candidates(*), jobs(*)").eq("id", id).single().then(async ({ data: row, error: loadError }) => {
    if (loadError || !row) { setError(loadError?.message ?? "신청을 찾지 못했습니다."); setData(null); return; }
    const candidateRow = Array.isArray(row.candidates) ? row.candidates[0] : row.candidates;
    const jobRows: DatabaseJobRow[] = Array.isArray(row.jobs) ? row.jobs : [];
    const ownerIds = [...new Set(jobRows.map((job) => job.primary_owner_id).filter((ownerId): ownerId is string => Boolean(ownerId)))];
    const { data: profiles } = ownerIds.length ? await supabase.from("profiles").select("id, display_name").in("id", ownerIds) : { data: [] };
    const ownerNames = new Map((profiles ?? []).map((profile) => [profile.id, profile.display_name]));
    const candidate: Candidate = { id: candidateRow.id, name: candidateRow.name, nameEn: candidateRow.name_en ?? "미입력", birthDate: candidateRow.birth_date ?? "미입력", nationality: candidateRow.nationality ?? "미입력", phone: candidateRow.phone ?? "미입력", email: candidateRow.email ?? "미입력", address: candidateRow.address ?? "미입력", jobIds: jobRows.map((job) => job.id) };
    const jobs: Job[] = jobRows.map((job) => ({ id: job.id, jobNo: job.job_no, managementNo: job.management_no, applicationId: row.id, candidateId: candidateRow.id, businessArea: job.business_area, accreditationTrack: job.accreditation_track, partnerCompany: row.partner_name_snapshot, standard: job.standard, currentGrade: job.grade, certificationState: job.certification_state, primaryOwner: job.primary_owner_id ? ownerNames.get(job.primary_owner_id) ?? "담당자 미확인" : "담당자 미지정", cycleIds: [] }));
    const application: CertificationApplication = { id: row.id, applicationNo: row.application_no, candidateId: candidateRow.id, businessArea: row.business_area, accreditationTrack: row.accreditation_track, accreditationHidden: row.accreditation_hidden, applicationType: row.application_type, receivedAt: row.received_at, registeredAt: new Date(row.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }), partnerCompany: row.partner_name_snapshot, status: row.status, managementNoFrom: row.management_no_from, managementNoTo: row.management_no_to, jobIds: jobRows.map((job) => job.id), primaryOwner: jobs[0]?.primaryOwner ?? "담당자 미지정", dropboxFolderName: row.dropbox_folder_name ?? `${row.management_no_from} ${candidateRow.name} (${jobs[0]?.currentGrade ?? ""} ${jobs[0]?.standard ?? ""} ${row.application_type})`, dropboxPath: row.dropbox_path ?? undefined, documentsStored: row.documents_stored, packageStatus: row.package_status, invoiceIds: [] };
    setData({ application, candidate, jobs });
  }); }, [id]);
  if (data === undefined) return <p className="text-sm text-slate-500">Supabase에서 신청정보를 불러오는 중입니다.</p>;
  if (!data) return <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error || "신청정보를 불러오지 못했습니다."}</div>;
  return <ApplicationDetail application={data.application} candidate={data.candidate} linkedJobs={data.jobs} invoices={[]}/>;
}
