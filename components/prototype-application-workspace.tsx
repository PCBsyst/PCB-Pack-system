"use client";

import { useEffect, useState } from "react";
import { ApplicationDetail } from "@/components/application-detail";
import { prototypeCandidateId, prototypeJobId, readPrototypeApplications, type PrototypeApplicationRecord } from "@/lib/prototype-storage";
import type { Candidate, CertificationApplication, Job } from "@/types/certification";

export function PrototypeApplicationWorkspace({ id }: { id: string }) {
  const [record, setRecord] = useState<PrototypeApplicationRecord | null | undefined>(undefined);
  useEffect(() => setRecord(readPrototypeApplications().find((item) => item.id === id) ?? null), [id]);

  if (record === undefined) return <p className="text-sm text-slate-500">신규 신청 업무화면을 준비하는 중입니다.</p>;
  if (!record) return <div className="rounded-lg border bg-white p-6 text-sm text-slate-600">이 브라우저에 해당 신청 데이터가 없습니다.</div>;

  const candidateId = prototypeCandidateId(record);
  const jobId = prototypeJobId(record);
  const candidate: Candidate = {
    id: candidateId,
    name: record.candidateName,
    nameEn: record.candidateNameEn || "미입력",
    birthDate: record.candidateBirthDate || "미입력",
    nationality: record.candidateNationality || "미입력",
    phone: record.candidatePhone || "미입력",
    email: record.candidateEmail || "미입력",
    address: "미입력",
    jobIds: [jobId],
  };
  const job: Job = {
    id: jobId,
    jobNo: record.jobNo,
    managementNo: record.managementNo,
    applicationId: record.id,
    candidateId,
    businessArea: record.businessArea,
    accreditationTrack: record.accreditationTrack,
    partnerCompany: record.partnerCompany,
    standard: record.standard,
    currentGrade: record.grade,
    certificationState: "NONE",
    primaryOwner: record.primaryOwner,
    cycleIds: [],
  };
  const application: CertificationApplication = {
    id: record.id,
    applicationNo: record.applicationNo,
    candidateId,
    businessArea: record.businessArea,
    accreditationTrack: record.accreditationTrack,
    accreditationHidden: record.accreditationHidden,
    applicationType: record.applicationType,
    receivedAt: record.receivedAt,
    registeredAt: new Date(record.createdAt).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }),
    partnerCompany: record.partnerCompany,
    status: record.status,
    managementNoFrom: record.managementNo,
    managementNoTo: record.managementNo,
    jobIds: [jobId],
    primaryOwner: record.primaryOwner,
    dropboxFolderName: `${record.managementNo} ${record.candidateName} (${record.grade} ${record.standard} ${record.applicationType})`,
    documentsStored: false,
    packageStatus: "NOT_READY",
    invoiceIds: [],
  };

  return <ApplicationDetail application={application} candidate={candidate} linkedJobs={[job]} invoices={[]}/>;
}
