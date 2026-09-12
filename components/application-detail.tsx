"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { Check, Copy, Download, FileArchive, FileText, FolderOpen, PackageCheck, Printer, RotateCcw, Save } from "lucide-react";
import type { Candidate, CertificationApplication, Invoice, Job } from "@/types/certification";
import { accreditationLabels, businessAreaLabels } from "@/data/workflow-data";
import { ApplicationStatusBadge } from "@/components/application-status-badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, controlClass, textareaClass } from "@/components/form-fields";
import { buildDocuments, createZip, downloadBlob, downloadWord, printAsPdf, type DemoCertificate, type DemoDecision, type DemoReview } from "@/lib/prototype-package";

const tabs = ["신청 개요", "자료보관", "서류검토", "인보이스·입금", "인증심의", "Job·패키지"] as const;
type Tab = (typeof tabs)[number];
type DemoStage = "DOCUMENT_REVIEW" | "INVOICE_PENDING" | "PAYMENT_PENDING" | "DECISION_PENDING" | "CERTIFICATION_INFO_PENDING" | "PACKAGE_READY" | "COMPLETED";
type DemoState = { stage: DemoStage; review: DemoReview; invoiceNo: string; invoiceAmount: string; decisionReviewer: string; decisionDate: string; decisions: DemoDecision; certificates: DemoCertificate; generated: boolean };

const stageOrder: DemoStage[] = ["DOCUMENT_REVIEW", "INVOICE_PENDING", "PAYMENT_PENDING", "DECISION_PENDING", "CERTIFICATION_INFO_PENDING", "PACKAGE_READY", "COMPLETED"];
const stageLabels: Record<DemoStage, string> = { DOCUMENT_REVIEW: "서류검토", INVOICE_PENDING: "인보이스", PAYMENT_PENDING: "입금 확인", DECISION_PENDING: "인증심의", CERTIFICATION_INFO_PENDING: "인증정보", PACKAGE_READY: "패키지", COMPLETED: "완료" };

function makeInitial(application: CertificationApplication, jobs: Job[]): DemoState {
  const isLeeRenewal = application.id === "app-003";
  return {
    stage: isLeeRenewal ? "PACKAGE_READY" : application.id === "app-001" ? "DOCUMENT_REVIEW" : application.status === "COMPLETED" ? "COMPLETED" : "DOCUMENT_REVIEW",
    review: { result: "적합", reviewer: application.primaryOwner, reviewedAt: isLeeRenewal ? "2026-08-15" : "2026-09-12", comment: isLeeRenewal ? "갱신 신청 제출자료 및 자격유지 요건을 확인함." : "제출자료 및 자격요건 관련 기록을 확인함." },
    invoiceNo: `INV-DEMO-${application.managementNoFrom}`,
    invoiceAmount: String(jobs.length * 450000),
    decisionReviewer: isLeeRenewal ? "박심의" : "",
    decisionDate: isLeeRenewal ? "2026-08-22" : "2026-09-12",
    decisions: Object.fromEntries(jobs.map((job) => [job.id, { result: isLeeRenewal ? "승인" : "", comment: isLeeRenewal ? "갱신 승인" : "" }])),
    certificates: Object.fromEntries(jobs.map((job, index) => [job.id, { certificationNo: isLeeRenewal ? "26-4-0091" : job.certificationNo ?? `DEMO-${application.managementNoFrom + index}`, issueDate: isLeeRenewal ? "2026-08-29" : "2026-09-18", expiryDate: isLeeRenewal ? "2029-08-28" : "2029-09-17", trackingNumber: "" }])),
    generated: application.packageStatus === "GENERATED",
  };
}

export function ApplicationDetail({ application, candidate, linkedJobs, invoices }: { application: CertificationApplication; candidate: Candidate; linkedJobs: Job[]; invoices: Invoice[] }) {
  const [active, setActive] = useState<Tab>("신청 개요");
  const [demo, setDemo] = useState(() => makeInitial(application, linkedJobs));
  const [notice, setNotice] = useState("서류검토 탭에서 샘플 업무를 시작하세요.");
  const storageKey = `certification-demo:${application.id}`;

  useEffect(() => { const stored = window.localStorage.getItem(storageKey); if (stored) setDemo(JSON.parse(stored) as DemoState); }, [storageKey]);
  useEffect(() => { window.localStorage.setItem(storageKey, JSON.stringify(demo)); }, [demo, storageKey]);

  const packageContext = useMemo(() => ({ application, candidate, jobs: linkedJobs, review: demo.review, decisions: demo.decisions, certificates: demo.certificates, decisionReviewer: demo.decisionReviewer, decisionDate: demo.decisionDate }), [application, candidate, linkedJobs, demo]);
  const currentIndex = stageOrder.indexOf(demo.stage);
  const move = (stage: DemoStage, tab: Tab, message: string) => { setDemo((current) => ({ ...current, stage })); setActive(tab); setNotice(message); };
  const reset = () => { setDemo(makeInitial(application, linkedJobs)); window.localStorage.removeItem(storageKey); setActive("서류검토"); setNotice("샘플 진행상태를 처음으로 되돌렸습니다."); };

  const finishDecision = () => {
    if (!demo.decisionReviewer || linkedJobs.some((job) => !demo.decisions[job.id]?.result)) { setNotice("심의자와 모든 Job의 심의결과를 직접 선택해 주세요."); return; }
    move("CERTIFICATION_INFO_PENDING", "Job·패키지", "심의가 완료되었습니다. 승인 Job의 인증정보를 확인하세요.");
  };
  const finishCertification = () => {
    const approved = linkedJobs.filter((job) => demo.decisions[job.id]?.result === "승인");
    if (!approved.length) { setNotice("승인된 Job이 없어 패키지 생성 단계로 진행할 수 없습니다."); return; }
    if (approved.some((job) => !demo.certificates[job.id]?.certificationNo || !demo.certificates[job.id]?.issueDate || !demo.certificates[job.id]?.expiryDate)) { setNotice("승인 Job의 인증번호·발행일·만료일을 입력해 주세요."); return; }
    move("PACKAGE_READY", "Job·패키지", "인증정보가 확정되었습니다. 기록 패키지를 생성하세요.");
  };
  const generate = () => { setDemo((current) => ({ ...current, stage: "COMPLETED", generated: true })); setNotice("Job별 기록 패키지가 생성되었습니다. Word·PDF·ZIP 다운로드를 시험해 보세요."); };
  const downloadZip = () => {
    const files = linkedJobs.flatMap((job) => buildDocuments(packageContext, job).map((document) => ({ name: `${job.jobNo}/${document.fileName}`, content: document.html })));
    downloadBlob(`${application.applicationNo}_기록패키지.zip`, createZip(files));
  };

  return <div className="space-y-5">
    <section className="rounded-lg border border-blue-200 bg-blue-50 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center"><div className="flex-1"><p className="text-sm font-semibold text-blue-950">샘플 업무 진행</p><p className="mt-1 text-sm text-blue-800">{notice}</p></div><Button size="sm" variant="outline" onClick={reset}><RotateCcw/>처음부터 다시</Button></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-4 xl:grid-cols-7">{stageOrder.map((stage, index) => <div key={stage} className={`rounded-md border px-2 py-2 text-center text-xs font-semibold ${index < currentIndex || demo.stage === "COMPLETED" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : index === currentIndex ? "border-blue-700 bg-blue-800 text-white" : "border-slate-200 bg-white text-slate-400"}`}>{index < currentIndex || demo.stage === "COMPLETED" ? "✓ " : ""}{stageLabels[stage]}</div>)}</div>
    </section>

    <section className="rounded-lg border bg-white p-5 shadow-sm"><div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-6"><Summary label="후보자" value={candidate.name}/><Summary label="분야" value={businessAreaLabels[application.businessArea]}/><Summary label="인정 구분" value={accreditationLabels[application.accreditationTrack]}/><Summary label="공식 접수일" value={application.receivedAt}/><Summary label="관리 No." value={`${application.managementNoFrom}${application.managementNoFrom === application.managementNoTo ? "" : `~${application.managementNoTo}`}`}/><div><p className="text-xs font-medium text-slate-500">기준상태</p><div className="mt-1.5"><ApplicationStatusBadge status={application.status}/></div></div></div></section>
    <div className="overflow-x-auto rounded-lg border bg-white px-2"><div className="flex min-w-max">{tabs.map((tab) => <button key={tab} onClick={() => setActive(tab)} className={`border-b-2 px-4 py-3 text-sm font-medium ${active === tab ? "border-blue-800 text-blue-800" : "border-transparent text-slate-500 hover:text-slate-800"}`}>{tab}</button>)}</div></div>

    {active === "신청 개요" && <div className="grid gap-5 xl:grid-cols-2"><Section title="접수정보"><dl className="grid gap-5 sm:grid-cols-2"><Info label="신청번호" value={application.applicationNo}/><Info label="신청구분" value={application.applicationType}/><Info label="파트너사" value={application.partnerCompany}/><Info label="주 담당자" value={application.primaryOwner}/><Info label="시스템 등록일시" value={application.registeredAt}/><Info label="등록 Job 수" value={`${linkedJobs.length}건`}/></dl></Section><Section title="Dropbox 신청 폴더"><div className="rounded-md bg-slate-50 p-4"><div className="flex gap-3"><FolderOpen className="h-5 w-5 text-blue-800"/><div><p className="font-semibold">{application.dropboxFolderName}</p><p className="mt-1 break-all text-xs text-slate-500">{application.dropboxPath}</p></div></div></div><Button className="mt-4" variant="outline" onClick={() => navigator.clipboard.writeText(application.dropboxFolderName)}><Copy/>폴더명 복사</Button></Section></div>}

    {active === "자료보관" && <Section title="대표메일 수신 및 Dropbox 보관"><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{["신청서", "계약서", "교육 증빙", "학력 증빙", "업무경력 증빙", "심사·실무경력 증빙"].map((item) => <label key={item} className="flex items-center gap-3 rounded-md border p-3 text-sm"><Checkbox defaultChecked/>{item}<span className="ml-auto text-xs text-emerald-700">보관 완료</span></label>)}</div><div className="mt-5 flex justify-end"><Button onClick={() => setNotice("자료보관 상태를 이 브라우저에 임시 저장했습니다.")}><Save/>보관상태 저장</Button></div></Section>}

    {active === "서류검토" && <Section title="통합 서류검토" description="AI 추천 없이 실무자가 결과를 직접 확정합니다."><div className="grid gap-3 sm:grid-cols-2">{["교육요건", "학력요건", "업무경력요건", "심사·실무경력요건"].map((item) => <div key={item} className="rounded-md border p-4"><p className="text-sm font-semibold">{item}</p><div className="mt-3 flex gap-4 text-sm">{["충족", "미충족", "해당없음"].map((value, index) => <label key={value}><input type="radio" name={item} defaultChecked={index === 0}/> {value}</label>)}</div></div>)}</div><div className="mt-5 grid gap-4 sm:grid-cols-2"><Field label="종합 검토결과"><select className={controlClass} value={demo.review.result} onChange={(event) => setDemo((current) => ({ ...current, review: { ...current.review, result: event.target.value as DemoReview["result"] } }))}><option>적합</option><option>보완필요</option><option>부적합</option></select></Field><Field label="검토자"><input className={controlClass} value={demo.review.reviewer} onChange={(event) => setDemo((current) => ({ ...current, review: { ...current.review, reviewer: event.target.value } }))}/></Field><Field label="검토일"><input type="date" className={controlClass} value={demo.review.reviewedAt} onChange={(event) => setDemo((current) => ({ ...current, review: { ...current.review, reviewedAt: event.target.value } }))}/></Field><Field label="검토의견" className="sm:col-span-2"><textarea className={textareaClass} value={demo.review.comment} onChange={(event) => setDemo((current) => ({ ...current, review: { ...current.review, comment: event.target.value } }))}/></Field></div><div className="mt-5 flex justify-end gap-2"><Button variant="outline" onClick={() => setNotice("서류검토 내용을 임시 저장했습니다.")}>임시저장</Button><Button onClick={() => move("INVOICE_PENDING", "인보이스·입금", "서류검토가 확정되었습니다. 인보이스를 발행하세요.")}><Check/>서류검토 확정</Button></div></Section>}

    {active === "인보이스·입금" && <Section title="인보이스 및 입금"><div className="grid gap-4 sm:grid-cols-3"><Field label="인보이스 번호"><input className={controlClass} value={demo.invoiceNo} onChange={(event) => setDemo((current) => ({ ...current, invoiceNo: event.target.value }))}/></Field><Field label="청구금액"><input type="number" className={controlClass} value={demo.invoiceAmount} onChange={(event) => setDemo((current) => ({ ...current, invoiceAmount: event.target.value }))}/></Field><Field label="수신자"><input className={controlClass} value={application.partnerCompany} readOnly/></Field></div>{invoices.length > 0 && <p className="mt-3 text-xs text-slate-500">기존 가상 인보이스: {invoices.map((invoice) => invoice.invoiceNo).join(", ")}</p>}<div className="mt-5 flex flex-wrap justify-end gap-2"><Button variant="outline" onClick={() => move("PAYMENT_PENDING", "인보이스·입금", "인보이스 발행을 기록했습니다. 입금을 확인하세요.")}><FileText/>인보이스 발행 기록</Button><Button disabled={demo.stage === "INVOICE_PENDING"} onClick={() => move("DECISION_PENDING", "인증심의", "입금 확인이 완료되었습니다. 심의결과를 입력하세요.")}><Check/>입금 확인</Button></div></Section>}

    {active === "인증심의" && <Section title="인증심의 및 인증결정보고서" description="실무자가 전달받은 결과를 직접 입력하며 AI 추천이나 자동선택은 없습니다."><div className="mb-5 grid gap-4 sm:grid-cols-2"><Field label="심의자"><select className={controlClass} value={demo.decisionReviewer} onChange={(event) => setDemo((current) => ({ ...current, decisionReviewer: event.target.value }))}><option value="">심의자 선택</option><option>박심의</option><option>이위원</option></select></Field><Field label="심의일"><input type="date" className={controlClass} value={demo.decisionDate} onChange={(event) => setDemo((current) => ({ ...current, decisionDate: event.target.value }))}/></Field></div><div className="overflow-x-auto"><table className="w-full min-w-[720px] text-left text-sm"><thead className="bg-slate-50 text-xs text-slate-500"><tr><th className="px-4 py-3">Job No.</th><th className="px-4 py-3">분야 / 등급</th><th className="px-4 py-3">심의결과</th><th className="px-4 py-3">의견</th></tr></thead><tbody className="divide-y">{linkedJobs.map((job) => <tr key={job.id}><td className="px-4 py-3 font-medium text-blue-800">{job.jobNo}</td><td className="px-4 py-3">{job.standard} / {job.currentGrade}</td><td className="px-4 py-3"><select className={controlClass} value={demo.decisions[job.id]?.result ?? ""} onChange={(event) => setDemo((current) => ({ ...current, decisions: { ...current.decisions, [job.id]: { ...current.decisions[job.id], result: event.target.value as DemoDecision[string]["result"] } } }))}><option value="">직접 선택</option><option>승인</option><option>보완</option><option>불승인</option></select></td><td className="px-4 py-3"><input className={controlClass} value={demo.decisions[job.id]?.comment ?? ""} onChange={(event) => setDemo((current) => ({ ...current, decisions: { ...current.decisions, [job.id]: { ...current.decisions[job.id], comment: event.target.value } } }))}/></td></tr>)}</tbody></table></div><div className="mt-5 flex justify-end"><Button onClick={finishDecision}><Check/>심의 완료</Button></div></Section>}

    {active === "Job·패키지" && <Section title="Job별 인증정보 및 기록 패키지" description="승인 Job별 정보를 확정합니다. 인증서 자체의 자동발행은 이번 범위에서 제외합니다."><div className="space-y-4">{linkedJobs.map((job) => { const certificate = demo.certificates[job.id]; const documents = buildDocuments(packageContext, job); return <div key={job.id} className="rounded-lg border"><div className="flex flex-col gap-3 border-b bg-slate-50 p-4 sm:flex-row sm:items-center"><div className="flex-1"><p className="font-semibold">{job.standard} / {job.currentGrade}</p><p className="mt-1 text-xs text-slate-500">{job.jobNo} · 심의결과 {demo.decisions[job.id]?.result || "미입력"}</p></div><Button variant="outline" asChild><Link href={`/jobs/${job.id}`}>Job 열기</Link></Button></div><div className="grid gap-4 p-4 sm:grid-cols-2 lg:grid-cols-4"><CertificateField label="인증번호" value={certificate?.certificationNo} onChange={(value) => changeCertificate(job.id, "certificationNo", value, setDemo)}/><CertificateField type="date" label="인증발행일" value={certificate?.issueDate} onChange={(value) => changeCertificate(job.id, "issueDate", value, setDemo)}/><CertificateField type="date" label="만료일" value={certificate?.expiryDate} onChange={(value) => changeCertificate(job.id, "expiryDate", value, setDemo)}/><CertificateField label="운송장 번호" value={certificate?.trackingNumber} placeholder="선택 입력" onChange={(value) => changeCertificate(job.id, "trackingNumber", value, setDemo)}/></div>{demo.generated && <div className="grid gap-3 border-t p-4 md:grid-cols-2">{documents.map((document) => <div key={document.fileName} className="flex flex-wrap items-center gap-2 rounded-md border p-3"><FileText className="h-4 w-4 text-slate-500"/><span className="mr-auto text-sm font-medium">{document.title}</span><Button size="sm" variant="outline" onClick={() => downloadWord(document.fileName, document.html)}><Download/>Word</Button><Button size="sm" variant="outline" onClick={() => { try { printAsPdf(document.title, document.html); } catch { setNotice("PDF 창이 차단되었습니다. 이 사이트의 팝업을 허용하세요."); } }}><Printer/>PDF 저장</Button></div>)}</div>}</div>; })}</div><div className="mt-5 flex flex-wrap justify-end gap-2"><Button variant="outline" disabled={currentIndex < stageOrder.indexOf("CERTIFICATION_INFO_PENDING")} onClick={finishCertification}><Check/>인증정보 확정</Button><Button disabled={demo.stage !== "PACKAGE_READY"} onClick={generate}><PackageCheck/>패키지 생성</Button><Button variant="outline" disabled={!demo.generated} onClick={downloadZip}><FileArchive/>전체 ZIP 다운로드</Button></div></Section>}
  </div>;
}

function changeCertificate(jobId: string, field: keyof DemoCertificate[string], value: string, setDemo: React.Dispatch<React.SetStateAction<DemoState>>) { setDemo((current) => ({ ...current, certificates: { ...current.certificates, [jobId]: { ...current.certificates[jobId], [field]: value } } })); }
function CertificateField({ label, value = "", type = "text", placeholder, onChange }: { label: string; value?: string; type?: string; placeholder?: string; onChange: (value: string) => void }) { return <Field label={label}><input type={type} className={controlClass} value={value} placeholder={placeholder} onChange={(event) => onChange(event.target.value)}/></Field>; }
function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) { return <section className="rounded-lg border bg-white shadow-sm"><div className="border-b px-5 py-4"><h3 className="font-semibold">{title}</h3>{description && <p className="mt-1 text-sm text-slate-500">{description}</p>}</div><div className="p-5">{children}</div></section>; }
function Summary({ label, value }: { label: string; value: string }) { return <div><p className="text-xs font-medium text-slate-500">{label}</p><p className="mt-1.5 text-sm font-semibold text-slate-900">{value}</p></div>; }
function Info({ label, value }: { label: string; value: string }) { return <div><dt className="text-xs font-medium text-slate-500">{label}</dt><dd className="mt-1.5 text-sm font-medium text-slate-900">{value}</dd></div>; }
