"use client";
import { normalizeManagementArea, managementNumberKey, readManagementNumberPolicy } from "@/lib/management-number-policy";

import { ChangeEvent, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Database, Download, FileSpreadsheet, Loader2, RotateCcw, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";

type CanonicalKey = "candidateName" | "candidateNameEn" | "candidateBirthDate" | "candidateNationality" | "candidateEmail" | "candidatePhone" | "businessArea" | "accreditationTrack" | "managementNo" | "jobNo" | "certificationNo" | "standard" | "grade" | "applicationType" | "receivedAt" | "issueDate" | "expiryDate" | "partnerName" | "certificationState";
type ImportRow = Record<CanonicalKey, string> & { sourceRow: number; errors: string[]; warnings: string[] };

const fieldAliases: Record<CanonicalKey, string[]> = {
  candidateName: ["후보자명", "후보자", "성명", "이름", "name", "candidate name"],
  candidateNameEn: ["영문명", "영문성명", "name en", "english name"],
  candidateBirthDate: ["생년월일", "birth date", "date of birth", "dob"],
  candidateNationality: ["국적", "nationality"],
  candidateEmail: ["이메일", "email", "e mail"],
  candidatePhone: ["전화번호", "연락처", "phone", "mobile"],
  businessArea: ["발행분야", "분야", "business area", "category"],
  accreditationTrack: ["인정구분", "인정여부", "accreditation track", "accreditation"],
  managementNo: ["no", "관리 no", "관리번호", "management no"],
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
  candidateName: "후보자명", candidateNameEn: "영문명", candidateBirthDate: "생년월일", candidateNationality: "국적", candidateEmail: "이메일", candidatePhone: "전화번호", businessArea: "발행분야", accreditationTrack: "인정구분", managementNo: "관리 No.", jobNo: "Job No.", certificationNo: "인증번호", standard: "표준", grade: "등급", applicationType: "신청구분", receivedAt: "접수일", issueDate: "인증발행일", expiryDate: "만료일", partnerName: "파트너사", certificationState: "인증상태",
};

const canonicalKeys = Object.keys(fieldAliases) as CanonicalKey[];
const requiredFields: CanonicalKey[] = ["candidateName", "standard", "grade"];

export function LegacyDataImport() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [parseError, setParseError] = useState("");
  const [previewOnly, setPreviewOnly] = useState(false);
  const [readingFile, setReadingFile] = useState(false);
  const readingRef = useRef(false);
  const [filter, setFilter] = useState<"ALL" | "VALID" | "ERROR" | "WARNING">("ALL");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [imported, setImported] = useState<Set<number>>(new Set());
  const [verifyingDatabase, setVerifyingDatabase] = useState(false);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{ success: number; failed: { row: number; message: string }[] } | null>(null);

  const counts = useMemo(() => ({
    valid: rows.filter((row) => !row.errors.length).length,
    error: rows.filter((row) => row.errors.length).length,
    warning: rows.filter((row) => !row.errors.length && row.warnings.length).length,
  }), [rows]);
  const visibleRows = useMemo(() => rows.filter((row) => filter === "ALL" || (filter === "VALID" ? !row.errors.length : filter === "ERROR" ? row.errors.length > 0 : !row.errors.length && row.warnings.length > 0)), [filter, rows]);

  const loadFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || importing || readingRef.current) return;
    readingRef.current = true; setReadingFile(true);
    setPreviewOnly(false);
    setParseError("");
    try {
      if (file.size > 5_000_000) throw new Error("5MB 이하의 CSV를 사용해 주세요. 큰 자료는 파일을 나누어 검증하세요.");
      const text = await file.text();
      const delimiter = detectDelimiter(text);
      const parsed = parseDelimited(text, delimiter).filter((line) => line.some((cell) => cell.trim()));
      if (parsed.length < 2) throw new Error("제목 행과 최소 1개의 자료 행이 필요합니다.");
      if (parsed.length > 5001) throw new Error("한 번에 최대 5,000행까지 검증할 수 있습니다.");
      const sourceHeaders = parsed[0].map((value) => value.trim().replace(/^\uFEFF/, ""));
      const mapping = buildHeaderMapping(sourceHeaders);
      const missing = requiredFields.filter((key) => mapping[key] === undefined);
      if (missing.length) throw new Error(`필수 열을 찾지 못했습니다: ${missing.map((key) => displayLabels[key]).join(", ")}`);
      const normalized = parsed.slice(1).map((line, index) => { const row = normalizeRow(line, index + 2, mapping); if (line.length !== sourceHeaders.length) row.errors.push("제목과 자료의 열 개수가 다름"); return row; });
      applyDuplicateChecks(normalized);
      if (hasEnvVars) {
        setVerifyingDatabase(true);
        await applyDatabaseDuplicateChecks(normalized);
      }
      setFileName(file.name);
      setHeaders(sourceHeaders);
      setRows(normalized);
      setSelected(new Set(normalized.filter((row) => !row.errors.length && !row.warnings.length).map((row) => row.sourceRow)));
      setImported(new Set());
      setImportResult(null);
      setFilter("ALL");
    } catch (error) {
      setRows([]);
      setHeaders([]);
      setFileName(file.name);
      setParseError(error instanceof Error ? error.message : "파일을 읽지 못했습니다.");
    } finally {
      setVerifyingDatabase(false);
      readingRef.current = false; setReadingFile(false);
    }
  };

  const reset = () => {
    if (importing || readingRef.current) return;
    setPreviewOnly(false);
    setRows([]); setHeaders([]); setFileName(""); setParseError(""); setFilter("ALL"); setSelected(new Set()); setImported(new Set()); setImportResult(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const loadValidationSample = () => {
    if (importing || readingRef.current) return;
    const sampleHeaders = ["후보자명", "표준", "등급", "접수일", "Job No.", "발행분야", "인정구분", "생년월일", "인증번호", "인증발행일", "만료일"];
    const mapping = buildHeaderMapping(sampleHeaders);
    const sampleRows = [
      ["샘플 정상", "ISO 9001", "심사원", "2026-10-01", "QMS260901", "ISO", "인정", "1990-01-01", "26130901", "2026-10-02", "2029-10-01"],
      ["샘플 중복 A", "ISO 14001", "심사원", "2026-10-01", "EMS260902", "ISO", "인정", "1990-01-02", "", "", ""],
      ["샘플 중복 B", "ISO 14001", "심사원", "2026-10-01", "EMS260902", "ISO", "인정", "1990-01-03", "", "", ""],
      ["샘플 날짜 오류", "ISO 45001", "심사원", "2026-02-30", "OHSMS260903", "ISO", "비인정", "1990-01-04", "", "", ""],
      ["샘플 식별 확인", "스킨케어", "전문가", "2026-10-01", "TEST-BEAUTY-01", "K_BEAUTY", "비인정", "", "", "", ""],
      ["샘플 필수 누락", "", "심사원", "2026-10-01", "QMS260904", "ISO", "인정", "1990-01-05", "", "", ""],
    ].map((line,index)=>normalizeRow(line,index+2,mapping));
    applyDuplicateChecks(sampleRows); setPreviewOnly(true); setRows(sampleRows); setHeaders(sampleHeaders); setFileName("검증용 가상 샘플 · DB 등록 불가"); setSelected(new Set()); setImported(new Set()); setImportResult(null); setParseError(""); setFilter("ALL");
  };

  const downloadTemplate = () => {
    const sample = [canonicalKeys.map((key) => displayLabels[key]), ["홍길동", "GIL DONG HONG", "1990-01-01", "대한민국", "hong@example.com", "010-0000-0000", "ISO", "인정", "1", "QMS260001", "26130001", "ISO 9001", "심사원", "최초", "2026-09-01", "2026-09-15", "2029-09-14", "개인", "인증 완료"]];
    downloadCsv(sample, "과거자료_가져오기_양식.csv");
  };

  const downloadIssues = () => {
    const issueRows = rows.filter((row) => row.errors.length || row.warnings.length).map((row) => [row.sourceRow, row.candidateName, row.jobNo, row.certificationNo, row.errors.join(" · "), row.warnings.join(" · ")]);
    downloadCsv([["원본 행", "후보자명", "Job No.", "인증번호", "오류", "확인사항"], ...issueRows], "과거자료_검증결과.csv");
  };

  const toggleRow = (sourceRow: number) => setSelected((current) => { const next = new Set(current); if (next.has(sourceRow)) next.delete(sourceRow); else next.add(sourceRow); return next; });
  const selectableRows = rows.filter((row) => !row.errors.length && !imported.has(row.sourceRow));
  const autoSelectableRows = selectableRows.filter(row => !row.warnings.length);
  const toggleAll = () => setSelected((current) => autoSelectableRows.length && autoSelectableRows.every(row => current.has(row.sourceRow)) ? new Set() : new Set(autoSelectableRows.map((row) => row.sourceRow)));
  const importSelected = async () => {
    if (!hasEnvVars || !selected.size || importing || previewOnly || readingRef.current) return;
    if (!window.confirm(`선택한 ${selected.size}행을 실제 DB에 등록할까요? 확인 필요 행은 원본과 대조한 뒤 선택해야 합니다. 기존 기록은 자동 병합하지 않습니다.`)) return;
    setImporting(true); setImportResult(null);
    const supabase = createClient(); let success = 0; const failed: { row: number; message: string }[] = []; const succeededRows: number[] = [];
    const { data: batchData, error: batchError } = await supabase.rpc("start_legacy_import_batch", { p_file_name: fileName, p_total_rows: selected.size });
    if (batchError || !batchData) {
      setImportResult({ success: 0, failed: [{ row: 0, message: batchError?.message ?? "가져오기 배치를 생성하지 못했습니다." }] });
      setImporting(false);
      return;
    }
    const batchId = batchData as string;
    for (const row of rows.filter((item) => selected.has(item.sourceRow) && !item.errors.length)) {
      const payload = Object.fromEntries(canonicalKeys.map((key) => [key, row[key]]));
      const { error } = await supabase.rpc("import_legacy_certification_row_v3", { p_batch_id: batchId, p_source_row: row.sourceRow, p_row: payload });
      if (error) { failed.push({ row: row.sourceRow, message: error.message }); await supabase.rpc("record_legacy_import_failure", { p_batch_id: batchId, p_source_row: row.sourceRow, p_row: payload, p_error_message: error.message }); } else { success += 1; succeededRows.push(row.sourceRow); }
    }
    await supabase.rpc("complete_legacy_import_batch", { p_batch_id: batchId });
    setImportResult({ success, failed }); setImporting(false);
    setImported((current) => new Set([...current, ...succeededRows]));
    setSelected(new Set(failed.map((item) => item.row)));
    window.dispatchEvent(new Event("legacy-import-updated"));
  };

  return <div className="space-y-4">
    <div className="rounded-lg border bg-card p-4 text-sm" role="status">{previewOnly ? "검증용 미리보기입니다. DB 조회·등록은 실행하지 않으며 실제 기존 데이터와의 중복 검증을 뜻하지 않습니다." : "확인 필요 행은 자동 선택하지 않습니다. 원본과 대조한 뒤 해당 행을 직접 선택하세요. 파일 선택은 조회·검증만 하며 DB 등록은 별도 확인 후 실행합니다."}</div>
    <section className="rounded-lg border bg-white p-5 shadow-sm">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div><h2 className="font-semibold text-slate-900">1. CSV 파일 준비</h2><p className="mt-1 text-sm text-slate-500">구글 시트에서 파일 → 다운로드 → 쉼표로 구분된 값(.csv)을 선택하세요. 원본 시트는 변경되지 않습니다.</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" onClick={downloadTemplate}><Download />입력 양식</Button><Button onClick={() => inputRef.current?.click()} disabled={readingFile || verifyingDatabase || importing}>{verifyingDatabase ? <Loader2 className="animate-spin" /> : <Upload />}{verifyingDatabase ? "DB 중복 확인 중" : "CSV 선택"}</Button><Button variant="outline" disabled={readingFile || importing} onClick={loadValidationSample}>검증용 샘플 보기</Button><input ref={inputRef} type="file" accept=".csv,.tsv,text/csv,text/tab-separated-values" className="hidden" disabled={readingFile || importing} onChange={loadFile} /></div>
      </div>
      {fileName && <div className="mt-4 flex items-center justify-between rounded-md border bg-slate-50 px-4 py-3 text-sm"><span className="flex items-center gap-2 font-medium"><FileSpreadsheet className="h-4 w-4 text-emerald-700" />{fileName}</span><Button size="sm" variant="ghost" onClick={reset} disabled={readingFile || importing}><RotateCcw />다시 선택</Button></div>}
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
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3"><div><h2 className="font-semibold text-slate-900">2. 검증 및 등록 대상 선택</h2><p className="mt-1 text-xs text-slate-500">인식한 원본 열 {headers.length}개 · 현재 표시 {visibleRows.length}건 · 선택 {selected.size}건 · 등록 완료 {imported.size}건</p></div><div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" onClick={downloadIssues} disabled={!counts.error && !counts.warning}><Download />오류 목록</Button><Button size="sm" onClick={importSelected} disabled={!hasEnvVars || !selected.size || importing || readingFile || previewOnly}>{importing ? <Loader2 className="animate-spin" /> : <Database />}{importing ? "등록 중" : `${selected.size}건 DB 등록`}</Button></div></div>
        {!hasEnvVars && <div className="border-b bg-amber-50 px-4 py-3 text-sm text-amber-900">Supabase가 연결된 배포 환경에서만 DB 등록을 실행할 수 있습니다.</div>}
        {importResult && <div className={`border-b px-4 py-3 text-sm ${importResult.failed.length ? "bg-amber-50 text-amber-900" : "bg-emerald-50 text-emerald-900"}`}><p className="font-semibold">등록 성공 {importResult.success}건 · 실패 {importResult.failed.length}건</p>{importResult.failed.length > 0 && <p className="mt-1 text-xs">{importResult.failed.map((item) => `${item.row}행: ${item.message}`).join(" / ")}</p>}</div>}
        <div className="max-w-full overflow-x-auto"><table className="w-full min-w-[1900px] text-left text-xs"><thead className="bg-slate-100 text-slate-600"><tr><th className="border-b px-3 py-3"><input type="checkbox" aria-label="확인사항 없는 정상 행 전체 선택" disabled={importing || previewOnly} checked={autoSelectableRows.length > 0 && autoSelectableRows.every(row => selected.has(row.sourceRow))} onChange={toggleAll} /></th>{["원본 행", "검증", "후보자명", "생년월일", "이메일", "분야", "인정구분", "관리 No.", "Job No.", "인증번호", "표준", "등급", "신청구분", "접수일", "발행일", "만료일", "파트너사", "오류·확인사항"].map((heading) => <th key={heading} className="whitespace-nowrap border-b px-3 py-3 font-semibold">{heading}</th>)}</tr></thead>
          <tbody className="divide-y">{visibleRows.map((row) => <tr key={row.sourceRow} className={row.errors.length ? "bg-red-50/40" : row.warnings.length ? "bg-amber-50/40" : "hover:bg-blue-50/40"}>
            <td className="px-3 py-3"><input type="checkbox" aria-label={`${row.sourceRow}행 선택`} disabled={row.errors.length > 0 || importing || imported.has(row.sourceRow)} checked={selected.has(row.sourceRow)} onChange={() => toggleRow(row.sourceRow)} /></td><td className="px-3 py-3 text-slate-500">{row.sourceRow}</td><td className="whitespace-nowrap px-3 py-3"><ValidationBadge row={row} imported={imported.has(row.sourceRow)} /></td><td className="whitespace-nowrap px-3 py-3 font-semibold">{row.candidateName || "-"}</td><td className="whitespace-nowrap px-3 py-3">{row.candidateBirthDate || "-"}</td><td className="whitespace-nowrap px-3 py-3">{row.candidateEmail || "-"}</td><td className="whitespace-nowrap px-3 py-3">{row.businessArea || "-"}</td><td className="whitespace-nowrap px-3 py-3">{row.accreditationTrack || "-"}</td><td className="whitespace-nowrap px-3 py-3">{row.managementNo || "자동"}</td><td className="whitespace-nowrap px-3 py-3">{row.jobNo || "-"}</td><td className="whitespace-nowrap px-3 py-3">{row.certificationNo || "-"}</td><td className="whitespace-nowrap px-3 py-3">{row.standard || "-"}</td><td className="whitespace-nowrap px-3 py-3">{row.grade || "-"}</td><td className="whitespace-nowrap px-3 py-3">{row.applicationType || "-"}</td><td className="whitespace-nowrap px-3 py-3">{row.receivedAt || "-"}</td><td className="whitespace-nowrap px-3 py-3">{row.issueDate || "-"}</td><td className="whitespace-nowrap px-3 py-3">{row.expiryDate || "-"}</td><td className="whitespace-nowrap px-3 py-3">{row.partnerName || "-"}</td><td className="min-w-80 px-3 py-3"><p className="text-red-700">{row.errors.join(" · ")}</p><p className="text-amber-800">{row.warnings.join(" · ")}</p></td>
          </tr>)}</tbody></table></div>
        <div className="border-t bg-slate-50 px-4 py-3 text-xs text-slate-500">오류가 없는 행만 선택할 수 있습니다. 각 행은 하나의 트랜잭션으로 처리되어 일부 정보만 저장되는 것을 방지합니다.</div>
      </section>
    </>}
  </div>;
}

function normalizeHeader(value: string) { return value.toLowerCase().replace(/[._\-()]/g, " ").replace(/\s+/g, " ").trim(); }
function buildHeaderMapping(headers: string[]) {
  const normalized = headers.map(normalizeHeader);
  return canonicalKeys.reduce<Partial<Record<CanonicalKey, number>>>((result, key) => {
    const matches = normalized.map((header,index)=>fieldAliases[key].some(alias=>header===normalizeHeader(alias))?index:-1).filter(index=>index>=0);
    if (matches.length > 1) throw new Error(`${displayLabels[key]}에 해당하는 열이 여러 개입니다. 열을 구분한 후 다시 선택해 주세요.`);
    const index = matches[0] ?? -1;
    if (index >= 0) result[key] = index;
    return result;
  }, {});
}
function normalizeRow(line: string[], sourceRow: number, mapping: Partial<Record<CanonicalKey, number>>): ImportRow {
  const row = Object.fromEntries(canonicalKeys.map((key) => [key, mapping[key] === undefined ? "" : (line[mapping[key]!] ?? "").trim()])) as Record<CanonicalKey, string>;
  const errors: string[] = [];
  const warnings: string[] = [];
  requiredFields.forEach((key) => { if (!row[key]) errors.push(`${displayLabels[key]} 누락`); });
  (["candidateBirthDate", "receivedAt", "issueDate", "expiryDate"] as CanonicalKey[]).forEach((key) => { if (row[key] && !isValidDate(row[key])) errors.push(`${displayLabels[key]} 날짜 형식 오류`); });
  if (row.issueDate && row.expiryDate && normalizeDate(row.expiryDate) < normalizeDate(row.issueDate)) errors.push("만료일이 발행일보다 빠름");
  if (!row.receivedAt) errors.push("접수일 누락");
  if (!row.jobNo) errors.push("Job No. 누락");
  if (row.managementNo && (!/^\d+$/.test(row.managementNo) || Number(row.managementNo) > 2147483647)) errors.push("관리 No. 숫자 형식 오류");
  else if (row.managementNo) row.managementNo = String(Number(row.managementNo));
  if (row.certificationNo && !row.issueDate) errors.push("인증번호가 있으나 발행일 누락");
  if (row.certificationNo && !row.expiryDate) errors.push("인증번호가 있으나 만료일 누락");
  if (!row.certificationNo && row.issueDate) warnings.push("발행일은 있으나 인증번호 없음");
  const area = normalizeManagementArea(row.businessArea);
  if (!area) errors.push("발행분야는 ISO 또는 K뷰티로 명시해야 합니다");
  else row.businessArea = area;
  if (!row.candidateBirthDate && !row.candidateEmail) warnings.push("후보자 식별정보 부족: 동일인의 다른 Job과 자동 연결되지 않음");
  if (row.candidateEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.candidateEmail)) errors.push("이메일 형식 오류");
  (["candidateBirthDate", "receivedAt", "issueDate", "expiryDate"] as CanonicalKey[]).forEach((key) => { if (row[key] && isValidDate(row[key])) row[key] = normalizeDate(row[key]); });
  return { ...row, sourceRow, errors, warnings };
}
function applyDuplicateChecks(rows: ImportRow[]) {
  const check = (key: "jobNo" | "certificationNo", label: string) => {
    const counts = new Map<string, number>();
    rows.forEach((row) => { if (row[key]) counts.set(row[key], (counts.get(row[key]) ?? 0) + 1); });
    rows.forEach((row) => { if (row[key] && (counts.get(row[key]) ?? 0) > 1) row.errors.push(`${label} 파일 내 중복`); });
  };
  check("jobNo", "Job No."); check("certificationNo", "인증번호");
  const counts = new Map<string, number>();
  rows.forEach(row => { const area=normalizeManagementArea(row.businessArea); if(area && row.managementNo) {const key=managementNumberKey(area,row.managementNo);counts.set(key,(counts.get(key)??0)+1);} });
  rows.forEach(row => { const area=normalizeManagementArea(row.businessArea); if(area && row.managementNo && (counts.get(managementNumberKey(area,row.managementNo))??0)>1) row.errors.push("동일 분야 관리 No. 파일 내 중복"); });
}
async function applyDatabaseDuplicateChecks(rows: ImportRow[]) {
  const supabase = createClient();
  const policy = await readManagementNumberPolicy(supabase);
  if (policy === "unavailable") throw new Error("관리번호 정책을 확인할 수 없습니다. 등록을 중단합니다.");
  const jobNumbers = [...new Set(rows.map((row) => row.jobNo).filter(Boolean))];
  const certificationNumbers = [...new Set(rows.map((row) => row.certificationNo).filter(Boolean))];
  const managementNumbers = [...new Set(rows.map((row) => row.managementNo).filter(Boolean).map(Number))];
  const [jobsByNumber, jobsByManagement, certifications] = await Promise.all([
    jobNumbers.length ? supabase.from("jobs").select("job_no").in("job_no", jobNumbers) : Promise.resolve({ data: [], error: null }),
    managementNumbers.length ? supabase.from("jobs").select("business_area,management_no").in("management_no", managementNumbers) : Promise.resolve({ data: [], error: null }),
    certificationNumbers.length ? supabase.from("certification_records").select("certification_no").in("certification_no", certificationNumbers) : Promise.resolve({ data: [], error: null }),
  ]);
  const queryError = jobsByNumber.error ?? jobsByManagement.error ?? certifications.error;
  if (queryError) throw new Error(`DB 중복 확인 실패: ${queryError.message}`);
  const existingJobs = new Set((jobsByNumber.data ?? []).map((item) => item.job_no));
  const existingManagement = new Set((jobsByManagement.data ?? []).map((item) => policy === "separated" ? `${item.business_area}:${Number(item.management_no)}` : String(item.management_no)));
  const existingCertifications = new Set((certifications.data ?? []).map((item) => item.certification_no));
  rows.forEach((row) => {
    if (row.jobNo && existingJobs.has(row.jobNo)) row.errors.push("Job No. DB 기존자료와 중복");
    const area=normalizeManagementArea(row.businessArea);
    if (row.managementNo && area && existingManagement.has(policy === "separated" ? managementNumberKey(area,row.managementNo) : row.managementNo)) row.errors.push("관리 No. DB 기존자료와 중복");
    if (policy === "legacy" && row.managementNo && rows.some(other => other !== row && other.managementNo === row.managementNo && other.businessArea !== row.businessArea)) row.errors.push("분야별 관리번호 분리를 위해 DB 변경 028 적용 필요");
    if (row.certificationNo && existingCertifications.has(row.certificationNo)) row.errors.push("인증번호 DB 기존자료와 중복");
  });
}
function isValidDate(value: string) { const normalized = normalizeDate(value); const timestamp = Date.parse(`${normalized}T00:00:00Z`); return /^\d{4}-\d{2}-\d{2}$/.test(normalized) && Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0,10) === normalized; }
function normalizeDate(value: string) {
  const compact = value.trim().replace(/[./]/g, "-");
  const match = compact.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  return match ? `${match[1]}-${match[2].padStart(2, "0")}-${match[3].padStart(2, "0")}` : compact;
}
function detectDelimiter(text: string) { const line = text.split(/\r?\n/, 1)[0] ?? ""; return (line.match(/\t/g)?.length ?? 0) > (line.match(/,/g)?.length ?? 0) ? "\t" : ","; }
function parseDelimited(text: string, delimiter: string) {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let quoted = false;
  for (let index = 0; index < text.length; index += 1) { const char = text[index]; const next = text[index + 1]; if (char === '"' && quoted && next === '"') { cell += '"'; index += 1; } else if (char === '"') quoted = !quoted; else if (char === delimiter && !quoted) { row.push(cell); cell = ""; } else if ((char === "\n" || char === "\r") && !quoted) { if (char === "\r" && next === "\n") index += 1; row.push(cell); rows.push(row); row = []; cell = ""; } else cell += char; }
  if (quoted) throw new Error("닫히지 않은 따옴표가 있습니다. CSV 원본 형식을 확인해 주세요.");
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}
function downloadCsv(rows: unknown[][], fileName: string) { const quote = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`; const csv = rows.map((row) => row.map(quote).join(",")).join("\r\n"); const url = URL.createObjectURL(new Blob(["\ufeff", csv], { type: "text/csv;charset=utf-8" })); const anchor = document.createElement("a"); anchor.href = url; anchor.download = fileName; anchor.click(); window.setTimeout(() => URL.revokeObjectURL(url), 1000); }
function ValidationBadge({ row, imported }: { row: ImportRow; imported: boolean }) { return imported ? <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-1 font-semibold text-blue-800"><Database className="h-3 w-3" />등록 완료</span> : row.errors.length ? <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 font-semibold text-red-800"><AlertTriangle className="h-3 w-3" />오류</span> : row.warnings.length ? <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 font-semibold text-amber-900"><AlertTriangle className="h-3 w-3" />확인</span> : <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 font-semibold text-emerald-800"><CheckCircle2 className="h-3 w-3" />정상</span>; }
function Summary({ label, value, tone, active, onClick }: { label: string; value: number; tone: "slate" | "green" | "red" | "amber"; active: boolean; onClick: () => void }) { const tones = { slate: "border-slate-200 bg-white", green: "border-emerald-200 bg-emerald-50", red: "border-red-200 bg-red-50", amber: "border-amber-200 bg-amber-50" }; return <button type="button" onClick={onClick} className={`rounded-lg border p-4 text-left shadow-sm transition ${tones[tone]} ${active ? "ring-2 ring-blue-500" : "hover:border-blue-300"}`}><p className="text-xs font-medium text-slate-600">{label}</p><p className="mt-1 text-2xl font-bold text-slate-950">{value}<span className="ml-1 text-sm font-medium">건</span></p></button>; }
