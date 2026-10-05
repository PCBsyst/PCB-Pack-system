import { createHash } from "node:crypto";
import { requireApiStaff } from "@/lib/server/api-auth";
import { createClient } from "@/lib/supabase/server";
import { recordMonthlyReportAccess } from "@/lib/server/report-access";
import { privateDocumentResponse } from "@/lib/private-document-response";
import { matchesReportMonth, matchesReportFilters, type ReportFilters } from "@/lib/report-filters";
import { normalizeMonthlyReportRecords } from "@/lib/monthly-report-records";
import { reportExportMetadata, reportApplicationTypeLabel, reportStateLabel, reportGroupLabel, serializeReportCsv } from "@/lib/report-export";

const failure = (message: string, status: number) => privateDocumentResponse(Response.json({ error: message }, { status }));
export async function POST(request: Request) {
  try {
    const denied = await requireApiStaff();
    if (denied) return privateDocumentResponse(denied);
    const origin = request.headers.get("Origin");
    if (origin && origin !== new URL(request.url).origin) return failure("허용되지 않은 요청입니다.", 403);
    const reader = request.body?.getReader();
    if (!reader) return failure("조회 조건을 확인해 주세요.", 400);
    let raw = "", size = 0;
    const decoder = new TextDecoder();
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        size += part.value.byteLength;
        if (size > 8192) { await reader.cancel(); return failure("보고서 요청이 너무 큽니다.", 413); }
        raw += decoder.decode(part.value, { stream: true });
      }
      raw += decoder.decode();
    } finally { reader.releaseLock(); }
    let input;
    try { input = JSON.parse(raw); } catch { return failure("조회 조건을 확인해 주세요.", 400); }
    if (!input || typeof input.month !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(input.month) || !["RECEIVED", "ISSUED"].includes(input.dateBasis)
      || !input.filters || typeof input.filters !== "object" || Array.isArray(input.filters)) return failure("조회 조건을 확인해 주세요.", 400);
    const filterKeys = ["area", "standard", "partner", "grade", "applicationType", "certificationState"] as const;
    if (filterKeys.some((key) => typeof input.filters[key] !== "string" || !input.filters[key].length || input.filters[key].length > 300)
      || Object.keys(input).some((key) => !["month", "dateBasis", "filters"].includes(key))
      || Object.keys(input.filters).some((key) => !filterKeys.includes(key as typeof filterKeys[number]))) return failure("조회 조건을 확인해 주세요.", 400);
    const filters = input.filters as ReportFilters;
    const client = await createClient();
    const records: unknown[] = [];
    for (let offset = 0; ; offset += 500) {
      const result = await client.from("applications").select("id, received_at, business_area, partner_name_snapshot, application_type, jobs(id, job_no, standard, grade, certification_state, candidates(name), certification_records(certification_no, issue_date, state, history_state))").order("id").range(offset, offset + 499);
      if (result.error || !Array.isArray(result.data)) return failure("보고서 자료를 조회하지 못했습니다.", 503);
      records.push(...result.data);
      if (records.length > 10000) return failure("대상 자료가 많아 상세 내보내기를 중단했습니다. 관리자에게 문의해 주세요.", 413);
      if (result.data.length < 500) break;
    }
    const selected = normalizeMonthlyReportRecords(records).filter((row) => matchesReportFilters(row, filters) && matchesReportMonth(row, input.month, input.dateBasis));
    if (!selected.length) return failure("선택한 조건에 해당하는 서버 자료가 없습니다. 화면 자료를 다시 조회해 주세요.", 409);
    const applications = [...new Set(selected.map((row) => row.applicationId))];
    if (selected.length > 5000 || applications.length > 100) return failure("상세 내보내기는 신청 100건·Job 5,000건 이내로 제한됩니다. 필터 범위를 줄여 주세요.", 413);
    const rows = [...reportExportMetadata("월간 업무보고", input.month, input.dateBasis === "RECEIVED" ? "접수일" : "인증발행일", filters),
      ["자료 출처", "다운로드 요청 시 서버 재조회"], [], ["접수일", "인증발행일", "분야", "후보자", "파트너사", "신청구분", "Job No.", "표준", "등급", "인증번호", "현재 인증상태"],
      ...selected.map((row) => [row.receivedAt, row.issueDate, reportGroupLabel(row.businessArea, "businessArea"), row.candidateName, row.partner, reportApplicationTypeLabel(row.applicationType), row.jobNo, row.standard, row.grade, row.certificationNo, reportStateLabel(row.certificationState)])];
    const csv = `\ufeff${serializeReportCsv(rows)}`;
    const bytes = new TextEncoder().encode(csv);
    if (bytes.byteLength > 20 * 1024 * 1024) return failure("파일이 너무 큽니다. 필터 범위를 줄여 주세요.", 413);
    const sha = createHash("sha256").update(bytes).digest("hex");
    if (!await recordMonthlyReportAccess(applications, `CSV ${input.month} ${input.dateBasis} ${sha}`)) return failure("보고서 접근이력을 저장하지 못해 다운로드를 중단했습니다. 서버 설정과 개인정보 접근이력 기능을 확인해 주세요.", 503);
    return privateDocumentResponse(new Response(bytes, { headers: { "Content-Type": "text/csv;charset=utf-8", "Content-Disposition": `attachment; filename="monthly-report-${input.month}.csv"`,
      "X-Report-SHA256": sha, "X-Report-Byte-Size": String(bytes.byteLength), "X-Report-Row-Count": String(selected.length) } }));
  } catch { return failure("보고서 생성 상태를 확인하지 못했습니다. 다시 시도해 주세요.", 503); }
}
