"use client";

import { useEffect, useState } from "react";
import { ApplicationDetail } from "@/components/application-detail";
import { createClient } from "@/lib/supabase/client";
import type { Candidate, CertificationApplication, Job } from "@/types/certification";

type WorkspaceData = { application: CertificationApplication; candidate: Candidate; jobs: Job[] };
type DatabaseJobRow = { id: string; job_no: string; management_no: number; business_area: "ISO" | "K_BEAUTY"; accreditation_track: "ACCREDITED" | "NON_ACCREDITED"; standard: string; grade: string; certification_state: Job["certificationState"] };

export function SupabaseApplicationWorkspace({ id }: { id: string }) {
  const [data, setData] = useState<WorkspaceData | null>();
  const [error, setError] = useState("");
  useEffect(() => { const supabase = createClient(); void supabase.from("applications").select("*, candidates(*), jobs(*)").eq("id", id).single().then(({ data: row, error: loadError }) => {
    if (loadError || !row) { setError(loadError?.message ?? "신청을 찾지 못했습니다."); setData(null); return; }
    const candidateRow = Array.isArray(row.candidates) ? row.candidates[0] : row.candidates;
    const jobRows: DatabaseJobRow[] = Array.isArray(row.jobs) ? row.jobs : [];
    const candidate: Candidate = { id: candidateRow.id, name: candidateRow.name, nameEn: candidateRow.name_en ?? "미입력", birthDate: candidateRow.birth_date ?? "미입력", nationality: candidateRow.nationality ?? "미입력", phone: candidateRow.phone ?? "미입력", email: candidateRow.email ?? "미입력", address: candidateRow.address ?? "미입력", jobIds: jobRows.map((job) => job.id) };
    const jobs: Job[] = jobRows.map((job) => ({ id: job.id, jobNo: job.job_no, managementNo: job.management_no, applicationId: row.id, candidateId: candidateRow.id, businessArea: job.business_area, accreditationTrack: job.accreditation_track, partnerCompany: row.partner_name_snapshot, standard: job.standard, currentGrade: job.grade, certificationState: job.certification_state, primaryOwner: "로그인 사용자", cycleIds: [] }));
    const application: CertificationApplication = { id: row.id, applicationNo: row.application_no, candidateId: candidateRow.id, businessArea: row.business_area, accreditationTrack: row.accreditation_track, accreditationHidden: row.accreditation_hidden, applicationType: row.application_type, receivedAt: row.received_at, registeredAt: new Date(row.created_at).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }), partnerCompany: row.partner_name_snapshot, status: row.status, managementNoFrom: row.management_no_from, managementNoTo: row.management_no_to, jobIds: jobRows.map((job) => job.id), primaryOwner: "로그인 사용자", dropboxFolderName: row.dropbox_folder_name ?? `${row.management_no_from} ${candidateRow.name} (${jobs[0]?.currentGrade ?? ""} ${jobs[0]?.standard ?? ""} ${row.application_type})`, dropboxPath: row.dropbox_path ?? undefined, documentsStored: row.documents_stored, packageStatus: row.package_status, invoiceIds: [] };
    setData({ application, candidate, jobs });
  }); }, [id]);
  if (data === undefined) return <p className="text-sm text-slate-500">Supabase에서 신청정보를 불러오는 중입니다.</p>;
  if (!data) return <div className="rounded-lg border border-red-200 bg-red-50 p-5 text-sm text-red-800">{error || "신청정보를 불러오지 못했습니다."}</div>;
  return <ApplicationDetail application={data.application} candidate={data.candidate} linkedJobs={data.jobs} invoices={[]}/>;
}
