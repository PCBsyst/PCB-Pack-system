import type { SupabaseClient } from "@supabase/supabase-js";
import { readBoundedRows } from "@/lib/bounded-row-reader";

type ApplicationRow = { id: string; application_no: string; candidate_id: string; received_at: string; application_type: string; management_no_from: number; management_no_to: number; primary_owner_id: string | null };
type JobRow = { id: string; candidate_id: string; application_id: string; job_no: string; management_no: number; standard: string; grade: string; primary_owner_id: string | null };
type CycleRow = { id: string; job_id: string; sequence: number; application_type: string; application_date: string; status: string };
const uuid = (value: unknown): value is string => typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const text = (value: unknown): value is string => typeof value === "string" && !!value.trim() && value.length <= 200 && !/[\u0000-\u001f]/.test(value);
const date = (value: unknown): value is string => typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && Number.isFinite(Date.parse(value)) && new Date(value).toISOString().slice(0,10) === value;

export function summarizeRegistration(application: ApplicationRow, candidatePresent: boolean, jobs: JobRow[], cycles: CycleRow[]) {
  if (!uuid(application.id) || !uuid(application.candidate_id) || !text(application.application_no) || !text(application.application_type) || !date(application.received_at)
    || !Number.isInteger(application.management_no_from) || application.management_no_from < 1 || !Number.isInteger(application.management_no_to) || application.management_no_to < application.management_no_from
    || application.management_no_to > 2147483647 || application.primary_owner_id !== null && !uuid(application.primary_owner_id)) throw new Error("신청 응답 구성 오류");
  const ids = new Set(jobs.map(job => job.id));
  if (ids.size !== jobs.length || jobs.some(job => !uuid(job.id) || !uuid(job.candidate_id) || job.application_id !== application.id || !text(job.job_no) || !text(job.standard) || !text(job.grade) || !Number.isInteger(job.management_no) || job.management_no < 1 || job.primary_owner_id !== null && !uuid(job.primary_owner_id))) throw new Error("Job 응답 구성 오류");
  if (new Set(cycles.map(cycle => cycle.id)).size !== cycles.length || cycles.some(cycle => !uuid(cycle.id) || !ids.has(cycle.job_id) || !Number.isInteger(cycle.sequence) || cycle.sequence < 1 || !text(cycle.application_type) || !date(cycle.application_date) || !text(cycle.status))) throw new Error("처리 회차 응답 구성 오류");
  const issues: string[] = [];
  if (!candidatePresent) issues.push("후보자 연결 기록이 조회되지 않았습니다. 누락 또는 접근권한을 확인하세요.");
  if (!application.primary_owner_id) issues.push("신청 주 담당자가 지정되지 않았습니다.");
  const expectedCount = application.management_no_to - application.management_no_from + 1;
  const numbers = jobs.map(job => job.management_no);
  const jobNumberCounts = new Map<string, number>();
  for (const job of jobs) {
    const key = job.job_no.trim().normalize("NFC").toUpperCase();
    jobNumberCounts.set(key, (jobNumberCounts.get(key) ?? 0) + 1);
  }
  if (jobs.length !== expectedCount || new Set(numbers).size !== jobs.length || numbers.some(no => no < application.management_no_from || no > application.management_no_to)) issues.push("현재 신청의 관리번호 범위와 Job 수·번호가 일치하지 않습니다.");
  const jobChecks = jobs.map(job => {
    const notes: string[] = [];
    if ((jobNumberCounts.get(job.job_no.trim().normalize("NFC").toUpperCase()) ?? 0) > 1) notes.push("현재 신청 내 Job 번호 중복");
    if (job.candidate_id !== application.candidate_id) notes.push("후보자 연결 불일치");
    if (!job.primary_owner_id) notes.push("주 담당자 미지정");
    const initial = cycles.filter(cycle => cycle.job_id === job.id && cycle.sequence === 1);
    const sequences = new Set<number>();
    if (cycles.some(cycle => {
      if (cycle.job_id !== job.id || cycle.sequence === 1) return false;
      if (sequences.has(cycle.sequence)) return true;
      sequences.add(cycle.sequence); return false;
    })) notes.push("후속 회차 번호 중복");
    if (initial.length !== 1) notes.push(initial.length ? "초기 회차 중복" : "초기 회차 미조회");
    else if (initial[0].application_type !== application.application_type || initial[0].application_date !== application.received_at) notes.push("초기 회차의 신청구분·접수일 불일치");
    for (const note of notes) issues.push(`${job.job_no}: ${note}`);
    return { id: job.id, jobNo: job.job_no, standard: job.standard, grade: job.grade, managementNo: job.management_no, initialCycles: initial.length, notes };
  });
  return { applicationId: application.id, applicationNo: application.application_no, managementFrom: application.management_no_from, managementTo: application.management_no_to, candidatePresent, issues, jobs: jobChecks };
}

export async function inspectApplicationRegistration(client: Pick<SupabaseClient, "from">, applicationNo: string, cancelled: () => boolean = () => false) {
  if (!text(applicationNo) || applicationNo.length > 100) throw new Error("신청번호 입력 오류");
  const result = await client.from("applications").select("id, application_no, candidate_id, received_at, application_type, management_no_from, management_no_to, primary_owner_id").eq("application_no", applicationNo).maybeSingle();
  if (cancelled()) return null;
  if (result.error) throw new Error("신청 조회 실패");
  if (!result.data) return { found: false as const };
  const application = result.data as ApplicationRow;
  if (!uuid(application.id) || !uuid(application.candidate_id) || application.application_no !== applicationNo) throw new Error("신청 범위 오류");
  const candidate = await client.from("candidates").select("id").eq("id", application.candidate_id).maybeSingle();
  if (cancelled()) return null;
  if (candidate.error || candidate.data && candidate.data.id !== application.candidate_id) throw new Error("후보자 조회 실패");
  const jobs = await readBoundedRows((from,to) => client.from("jobs").select("id, candidate_id, application_id, job_no, management_no, standard, grade, primary_owner_id", {count:"exact"}).eq("application_id", application.id).order("id").range(from,to), row => row?.id, cancelled, 1000);
  if (cancelled()) return null;
  if (!jobs) throw new Error("Job 조회 실패");
  const cycles: CycleRow[] = [];
  for (let start = 0; start < jobs.length; start += 100) {
    const ids = jobs.slice(start,start+100).map(job => job.id);
    const rows = await readBoundedRows((from,to) => client.from("processing_cycles").select("id, job_id, sequence, application_type, application_date, status", {count:"exact"}).in("job_id",ids).order("id").range(from,to), row => ids.includes(row?.job_id) ? row.id : undefined, cancelled, 10000 - cycles.length);
    if (cancelled()) return null;
    if (!rows) throw new Error("회차 조회 실패");
    cycles.push(...rows as CycleRow[]);
  }
  return { found: true as const, ...summarizeRegistration(application, Boolean(candidate.data), jobs as JobRow[], cycles) };
}
