import { readFile } from "node:fs/promises";
import path from "node:path";
import PizZip from "pizzip";
import type { PackageContext } from "@/lib/prototype-package";
import type { Job } from "@/types/certification";

type RequestBody = { context: PackageContext; job: Job };

function xml(value: unknown) {
  return String(value ?? "-").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&apos;");
}

export async function POST(request: Request) {
  const { context, job } = await request.json() as RequestBody;
  const decision = context.decisions[job.id];
  const certificate = context.certificates[job.id];
  const assessment = context.assessment[job.id] ?? {};
  const selectedPanel = context.panelMembers.filter((member) => member.selected);
  const values: Record<string, unknown> = {
    candidateName: context.candidate.name,
    jobNo: job.jobNo,
    standard: job.standard,
    grade: job.currentGrade,
    knowledge: assessment["지식 시험"],
    personality: assessment["인성 시험"],
    education: assessment["교육 요구사항"],
    academic: assessment["학력 요구사항"],
    auditExperience: assessment["심사이력"],
    assessmentComment: context.review.comment,
    approveMark: decision?.result === "승인" ? "■" : "□",
    rejectMark: decision?.result === "불승인" ? "■" : "□",
    reapproveMark: decision?.result === "재승인" ? "■" : "□",
    panelMembers: selectedPanel.map((member) => `${member.name} (${member.decision})`).join(", "),
    decisionDate: context.decisionDate,
    decisionComment: selectedPanel.map((member) => `${member.name}: ${member.comment || "-"}`).join(" / "),
    certificationNo: certificate?.certificationNo,
    validityPeriod: certificate ? `${certificate.issueDate} ~ ${certificate.expiryDate}` : "-",
    finalApprover: context.finalApprover,
    finalApprovalDate: context.finalApprovalDate,
  };

  const templatePath = path.join(process.cwd(), "templates", "FGPC-012-01-decision-report-kr.docx");
  const template = await readFile(templatePath);
  const zip = new PizZip(template);
  for (const fileName of Object.keys(zip.files).filter((name) => name.endsWith(".xml"))) {
    let content = zip.file(fileName)?.asText();
    if (!content) continue;
    for (const [key, value] of Object.entries(values)) content = content.replaceAll(`{{${key}}}`, xml(value));
    zip.file(fileName, content);
  }
  const output = zip.generate({ type: "uint8array", compression: "DEFLATE" });
  const body = output.buffer.slice(output.byteOffset, output.byteOffset + output.byteLength) as ArrayBuffer;
  const safeJobNo = job.jobNo.replace(/[^A-Za-z0-9_-]/g, "_");
  return new Response(body, { headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document", "Content-Disposition": `attachment; filename="${safeJobNo}_Certification_Decision_Report_KR.docx"` } });
}
