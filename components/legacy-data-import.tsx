"use client";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";

type CanonicalKey = "candidateName" | "candidateNameEn" | "businessArea" | "jobNo" | "certificationNo" | "standard" | "grade" | "applicationType" | "receivedAt" | "issueDate" | "expiryDate" | "partnerName" | "certificationState";
type ImportRow = Record<CanonicalKey, string> & { sourceRow: number; errors: string[]; warnings: string[] };

const fieldAliases: Record<CanonicalKey, string[]> = {
  candidateName: ["후보자명", "후보자", "성명", "이름", "name", "candidate name"],
  candidateNameEn: ["영문명", "영문성명", "name en", "english name"],
  businessArea: ["발행분야", "분야", "business area", "category"],
  jobNo: ["job no", "job number", "jobno", "잡번호"],
  certificationNo: ["인증번호", "cert no", "certificate no", "certification no"],
  standard: ["인증규격", "신청표준", "표준", "standard"],
  grade: ["신청등급", "등급", "grade"],
  applicationType: ["신청구분", "주기", "application type"],
  receivedAt: ["접수일", "신청일", "서류접수일", "received at", "application date"],
  issueDate: ["인증발행일자", "인증발행일", "발행일", "issue date"],
  expiryDate: ["만료일자", "만료일", "유효종료일", "expiry date", "valid until"],
  partnerName: ["파트너사", "협력사", "partner", "partner company"],
  certificationState: ["인증상태", "상태", "certification state", "status"],
};

const displayLabels: Record<CanonicalKey, string> = {
  candidateName: "후보자명", candidateNameEn: "영문명", businessArea: "발행분야", jobNo: "Job No.", certificationNo: "인증번호", standard: "표준", grade: "등급", applicationType: "신청구분", receivedAt: "접수일", issueDate: "인증발행일", expiryDate: "만료일", partnerName: "파트너사", certificationState: "인증상태",
};

const canonicalKeys = Object.keys(fieldAliases) as CanonicalKey[];
const requiredFields: CanonicalKey[] = ["candidateName", "standard", "grade"];

export function LegacyDataImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parseError, setParseError] = useState("");
  const [filter, setFilter] = useState<"ALL" | "VALID" | "ERROR" | "WARNING">("ALL");

  const counts = useMemo(() => ({
    valid: rows.filter((row) => !row.errors.length).length,
    error: rows.filter((row) => row.errors.length).length,
    warning: rows.filter((row) => !row.errors.length && row.warnings.length).length,
  }), [rows]);
  const visibleRows = useMemo(() => rows.filter((row) => filter === "ALL" || (filter === "VALID" ? !row.errors.length : filter === "ERROR" ? row.errors.length > 0 : !row.errors.length && row.warnings.length > 0)), [filter, rows]);

  const loadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setParseError("");
    try {
      const text = await file.text();
      const delimiter = detectDelimiter(text);
      const parsed = parseDelimited(text, delimiter).filter((line) => line.some((cell) => cell.trim()));
      if (parsed.length < 2) throw new Error("제목 행과 최소 1개의 자료 행이 필요합니다.");
      const sourceHeaders = parsed[0].map((value) => value.trim().replace(/^\uFEFF/, ""));
      const mapping = buildHeaderMapping(sourceHeaders);
      const missing = requiredFields.filter((key) => mapping[key] === undefined);
      if (missing.length) throw new Error(`필수 열을 찾지 못했습니다: ${missing.map((key) => displayLabels[key]).join(", ")}`);
      const normalized = parsed.slice(1).map((line, index) => normalizeRow(line, index + 2, mapping));
      applyDuplicateChecks(normalized);
      setFileName(file.name);
      setHeaders(sourceHeaders);
      setRows(normalized);
      setFilter("ALL");
    } catch (error) {
      setRows([]);
      setHeaders([]);
      setFileName(file.name);
      setParseError(error instanceof Error ? error.message : "파일을 읽지 못했습니다.");
    }
  };

  const reset = () => {
    setRows([]); setHeaders([]); setFileName(""); setParseError(""); setFilter("ALL");
    if (inputRef.current) inputRef.current.value = "";
  };

  const downloadTemplate = () => {
    const sample = [canonicalKeys.map((key) => displayLabels[key]), ["홍길동", "GIL DONG HONG", "ISO", "QMS260001", "26130001", "ISO 9001", "심사원", "최초", "2026-09-01", "2026-09-15", "2029-09-14", "개인", "인증 완료"]];
    downloadCsv(sample, "과거자료_가져오기_양식.csv");
  };

  const downloadIssues = () => {
    const issueRows = rows.filter((row) => row.errors.length || row.warnings.length).map((row) => [row.sourceRow, row.candidateName, row.jobNo, row.certificationNo, row.errors.join(" · "), row.warnings.join(" · ")]);
    downloadCsv([["원본 행", "후보자명", "Job No.", "인증번호", "오류", "확인사항"], ...issueRows], "과거자료_검증결과.csv");
  };

  return <div className="space-y-4">
    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div><h2 className="font-semibold text-slate-900">1. CSV 파일 준비</h2><p className="mt-1 text-sm text-slate-500">구글 시트에서 파일 → 다운로드 → 쉼표로 구분된 값(.csv)을 선택하세요. 원본 시트는 변경되지 않습니다.</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={downloadTemplate}><Download />입력 양식</Button><Button onClick={() => inputRef.current?.click()}><Upload />CSV 선택</Button><input ref={inputRef} type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" className="hidden" onChange={loadFile} /></div>
      </div>
      {fileName && <div className="mt-4 flex items-center justify-between rounded-md border bg-slate-50 px-4 py-3 text-sm"><span className="flex items-center gap-2 font-medium"><FileSpreadsheet className="h-4 w-4 text-emerald-700" />{fileName}</span><Button size="sm" variant="ghost" onClick={reset}><RotateCcw />다시 선택</Button></div>}
      {parseError && <div className="mt-4 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800"><p className="font-semibold">파일을 검증할 수 없습니다.</p><p className="mt-1">{parseError}</p></div>}
    </section>

    {rows.length > 0 && <>
      <div className="grid gap-3 sm:grid-cols-4">
        <Summary label="전체 행" value={rows.length} tone="slate" active={filter === "ALL"} onClick={() => setFilter("ALL")} />
        <Summary label="저장 가능" value={counts.valid} tone="green" active={filter === "VALID"} onClick={() => setFilter("VALID")} />
        <Summary label="오류" value={counts.error} tone="red" active={filter === "ERROR"} onClick={() => setFilter("ERROR")} />
        <Summary label="확인 필요" value={counts.warning} tone="amber" active={filter === "WARNING"} onClick={() => setFilter("WARNING")} />
      </div>

      <section className="overflow-hidden rounded-lg border bg-white shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"><div><h2 className="font-semibold text-slate-900">2. 검증 대기 목록</h2><p className="mt-1 text-xs text-slate-500">인식한 원본 열 {headers.length}개 · 현재 표시 {visibleRows.length}건</p></div><Button variant="outline" size="sm" onClick={downloadIssues} disabled={!counts.error && !counts.warning}><Download />오류 목록 다운로드</Button></div>
        <div className="max-w-full overflow-x-auto"><table className="w-full min-w-[1500px] text-left text-xs"><thead className="bg-slate-100 text-slate-600"><tr>{["원본 행", "검증", "후보자명", "분야", "Job No.", "인증번호", "표준", "등급", "신청구분", "접수일", "발행일", "만료일", "파트너사", "오류·확인사항"].map((heading) => <th key={heading} className="whitespace-nowrap border-b px-3 py-3 font-semibold">{heading}</th>)}</tr></thead>
          <tbody className="divide-y">{visibleRows.map((row) => <tr key={row.sourceRow} className={row.errors.length ? "bg-red-50/40" : row.warnings.length ? "bg-amber-50/40" : "hover:bg-blue-50/40"}>
            <td className="px-3 py-3 text-slate-500">{row.sourceRow}</td><td className="whitespace-nowrap px-3 py-3"><ValidationBadge row={row} /></td><td className="whitespace-nowrap px-3 py-3 font-semibold">{row.candidateName || "-"}</td><td className="whitespace-nowrap px-3 py-3">{row.businessArea || "-"}</td><td className="whitespace-nowrap px-3 py-3">{row.jobNo || "-"}</td><td className="whitespace-nowrap px-3 py-3">{row.certificationNo || "-"}</td><td className="whitespace-nowrap px-3 py-3">{row.standard || "-"}</td><td className="whitespace-nowrap px-3 py-3">{row.grade || "-"}</td><td className="whitespace-nowrap px-3 py-3">{row.applicationType || "-"}</td><td className="whitespace-nowrap px-3 py-3">{row.receivedAt || "-"}</td><td className="whitespace-nowrap px-3 py-3">{row.issueDate || "-"}</td><td className="whitespace-nowrap px-3 py-3">{row.expiryDate || "-"}</td><td className="whitespace-nowrap px-3 py-3">{row.partnerName || "-"}</td><td className="min-w-80 px-3 py-3"><p className="text-red-700">{row.errors.join(" · ")}</p><p className="text-amber-800">{row.warnings.join(" · ")}</p></td>
          </tr>)}</tbody></table></div>
        <div className="border-t bg-slate-50 px-4 py-3 text-xs text-slate-500">이 단계에서는 DB에 저장하지 않습니다. 오류를 정리하고 검증된 자료만 다음 단계에서 일괄 등록합니다.</div>
      </section>
    </>}
  </div>;
}

function normalizeHeader(value: string) { return value.toLowerCase().replace(/[._\-()]/g, " ").replace(/\s+/g, " ").trim(); }
function buildHeaderMapping(headers: string[]) {
  const normalized = headers.map(normalizeHeader);
  return canonicalKeys.reduce<Partial<Record<CanonicalKey, number>>>((result, key) => {
    const index = normalized.findIndex((header) => fieldAliases[key].some((alias) => header === normalizeHeader(alias)));
    if (index >= 0) result[key] = index;
    return result;
  }, {});
}
function normalizeRow(line: string[], sourceRow: number, mapping: Partial<Record<CanonicalKey, number>>): ImportRow {
  const row = Object.fromEntries(canonicalKeys.map((key) => [key, mapping[key] === undefined ? "" : (line[mapping[key]!] ?? "").trim()])) as Record<CanonicalKey, string>;
  const errors: string[] = [];
  const warnings: string[] = [];
  requiredFields.forEach((key) => { if (!row[key]) errors.push(`${displayLabels[key]} 누락`); });
  (["receivedAt", "issueDate", "expiryDate"] as CanonicalKey[]).forEach((key) => { if (row[key] && !isValidDate(row[key])) errors.push(`${displayLabels[key]} 날짜 형식 오류`); });
  if (row.issueDate && row.expiryDate && normalizeDate(row.expiryDate) < normalizeDate(row.issueDate)) errors.push("만료일이 발행일보다 빠름");
  if (!row.jobNo) warnings.push("Job No. 미입력");
  if (!row.certificationNo && row.issueDate) warnings.push("발행일은 있으나 인증번호 없음");
  if (!row.businessArea) warnings.push("발행분야 확인 필요");
  (["receivedAt", "issueDate", "expiryDate"] as CanonicalKey[]).forEach((key) => { if (row[key] && isValidDate(row[key])) row[key] = normalizeDate(row[key]); });
  return { ...row, sourceRow, errors, warnings };
}
function applyDuplicateChecks(rows: ImportRow[]) {
  const check = (key: "jobNo" | "certificationNo", label: string) => {
    const counts = new Map<string, number>();
    rows.forEach((row) => { if (row[key]) counts.set(row[key], (counts.get(row[key]) ?? 0) + 1); });
    rows.forEach((row) => { if (row[key] && (counts.get(row[key]) ?? 0) > 1) row.errors.push(`${label} 파일 내 중복`); });
  };
  check("jobNo", "Job No."); check("certificationNo", "인증번호");
}
function isValidDate(value: string) { const normalized = normalizeDate(value); return /^\d{4}-\d{2}-\d{2}$/.test(normalized) && !Number.isNaN(new Date(`${normalized}T00:00:00`).getTime()); }
function normalizeDate(value: string) {
  const compact = value.trim().replace(/[./]/g, "-");
  const match = compact.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  return match ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}` : compact;
}
function detectDelimiter(text: string) { const line = text.split(/\r?\n/, 1)[0] ?? ""; return (line.match(/\t/g)?.length ?? 0) > (line.match(/,/g)?.length ?? 0) ? "\t" : ","; }
function parseDelimited(text: string, delimiter: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) { const char = text[index]; const next = text[index + 1]; if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; } else if (char === '"') quoted = !quoted; else if (char === delimiter && !quoted) { row.push(cell); cell = ""; } else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && next === "\n") index += 1; row.push(cell); rows.push(row); row = []; cell = ""; } else cell += char; }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
function downloadCsv(rows: unknown[][], fileName: string) { const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`; const csv = rows.map((row) => row.map(quote).join(",")).join("\r\n"); const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = fileName; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
function ValidationBadge({ row }: { row: ImportRow }) { return row.errors.length ? <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 font-semibold text-red-800"><AlertTriangle className="h-3 w-3" />오류</span> : row.warnings.length ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-900"><AlertTriangle className="h-3 w-3" />확인</span> : <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-800"><CheckCircle2 className="h-3 w-3" />정상</span>; }
function Summary({ label, value, tone, active, onClick }: { label: string; value: number; tone: "slate" | "green" | "red" | "amber"; active: boolean; onClick: () => void }) { const tones = { slate: "border-slate-200 bg-white", green: "border-emerald-200 bg-emerald-50", red: "border-red-200 bg-red-50", amber: "border-amber-200 bg-amber-50" }; return <button type="button" onClick={onClick} className={`rounded-lg border p-4 text-left shadow-sm transition ${tones[tone]} ${active ? "ring-2 ring-blue-500" : "hover:border-blue-300"}`}><p className="text-xs font-medium text-slate-600">{label}</p><p className="mt-1 text-2xl font-bold text-slate-950">{value}<span className="ml-1 text-sm font-medium">건</span></p></button>; }
