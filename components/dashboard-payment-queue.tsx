"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { hasEnvVars } from "@/lib/utils";
import { paymentQueueItem, type PaymentInvoice } from "@/lib/payment-queue";

export function DashboardPaymentQueue() {
  const [invoices, setInvoices] = useState<PaymentInvoice[]>([]);
  const [state, setState] = useState("loading");
  const [refresh, setRefresh] = useState(0);
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState("all");
  const [page, setPage] = useState(0);
  useEffect(() => {
    if (!hasEnvVars) { setState("prototype"); return; }
    let active = true;
    setState("loading");
    void (async () => {
      const client = createClient();
      const result: PaymentInvoice[] = [];
      for (let offset = 0; ; offset += 500) {
        const { data, error } = await client.from("invoices").select("id, invoice_no, recipient_name, amount, paid_amount, issued_at, paid_at, payment_status, invoice_jobs(job_id)").order("id").range(offset, offset + 499);
        if (!active) return;
        if (error) { setState("error"); return; }
        result.push(...(data as unknown as PaymentInvoice[]));
        if ((data?.length ?? 0) < 500) break;
      }
      setInvoices(result); setPage(0); setState("ready");
    })().catch(() => { if (active) setState("error"); });
    return () => { active = false; };
  }, [refresh]);
  const pending = useMemo(() => invoices.map(paymentQueueItem).filter((item) => item.pending).sort((a, b) => Number(b.needsConfirmation) - Number(a.needsConfirmation) || a.invoice.issued_at.localeCompare(b.invoice.issued_at)), [invoices]);
  const visible = pending.filter((item) => (mode !== "check" || item.needsConfirmation) && `${item.invoice.invoice_no} ${item.invoice.recipient_name}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const lastPage = Math.max(0, Math.ceil(visible.length / 10) - 1);
  const currentPage = Math.min(page, lastPage);
  const amount = (value: number) => value.toLocaleString("ko-KR");
  return <section className="mt-6 overflow-hidden rounded-xl border bg-white shadow-sm">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b p-5"><div><h2 className="font-semibold">인보이스·입금 확인 대기</h2><p className="mt-1 text-xs text-slate-500">통합 인보이스는 한 번만 집계합니다. 오래된 발행 건과 확인 필요 건을 우선 표시합니다.</p></div><button disabled={state === "loading"} className="rounded border px-3 py-2 text-sm disabled:opacity-50" onClick={() => setRefresh((value) => value + 1)}>새로고침</button></div>
    {state !== "ready" ? <p role="status" className="p-5 text-sm text-slate-500">{state === "loading" ? "공유 DB를 조회하고 있습니다." : state === "prototype" ? "가상데이터 모드에서는 실제 인보이스 DB를 조회하지 않습니다." : "입금 대기 자료를 조회하지 못했습니다. 대기 0건으로 간주하지 않습니다."}</p> : <>
      <div className="flex flex-wrap items-center justify-between gap-3 p-5"><p className="text-sm">대기 {pending.length}건 · 잔액 {amount(pending.reduce((sum, item) => sum + item.outstanding, 0))}원 · 확인 필요 {pending.filter((item) => item.needsConfirmation).length}건</p><div className="flex flex-wrap gap-2"><input aria-label="인보이스 번호 또는 수신자 검색" placeholder="인보이스 번호 / 수신자" className="rounded border bg-white px-3 py-2 text-sm" value={search} onChange={(event) => { setSearch(event.target.value); setPage(0); }}/><select aria-label="입금 대기 구분" className="rounded border bg-white px-3 py-2 text-sm" value={mode} onChange={(event) => { setMode(event.target.value); setPage(0); }}><option value="all">전체 대기</option><option value="check">확인 필요</option></select></div></div>
      <div className="overflow-x-auto"><table className="w-full min-w-[850px] text-left text-sm"><thead className="bg-slate-50"><tr>{["발행일", "인보이스", "수신자", "청구액", "입금액", "잔액", "확인 상태", "연결 업무"].map((label) => <th key={label} className="p-3">{label}</th>)}</tr></thead><tbody>{visible.slice(currentPage * 10, (currentPage + 1) * 10).map(({ invoice, outstanding, needsConfirmation }) => <tr key={invoice.id} className="border-b"><td className="p-3">{invoice.issued_at}</td><td className="p-3 font-semibold">{invoice.invoice_no}</td><td className="p-3">{invoice.recipient_name}</td><td className="p-3">{amount(Number(invoice.amount))}</td><td className="p-3">{amount(Number(invoice.paid_amount ?? 0))}</td><td className="p-3">{amount(outstanding)}</td><td className="p-3 text-amber-700">{needsConfirmation ? "입금·기록 확인 필요" : "입금 대기"}</td><td className="p-3"><div className="flex flex-wrap gap-2">{[...new Set(invoice.invoice_jobs.map((item) => item.job_id))].map((id, index) => <Link key={id} href={`/jobs/${id}`} className="text-blue-700 underline">Job {index + 1}</Link>)}{!invoice.invoice_jobs.length && <span className="text-amber-700">Job 연결 누락</span>}</div></td></tr>)}{!visible.length && <tr><td colSpan={8} className="p-8 text-center text-slate-500">조건에 맞는 대기 인보이스가 없습니다.</td></tr>}</tbody></table></div>
      <div className="flex items-center justify-end gap-3 p-4 text-sm"><button className="rounded border px-3 py-1 disabled:opacity-50" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>이전</button><span>{currentPage + 1} / {lastPage + 1}</span><button className="rounded border px-3 py-1 disabled:opacity-50" disabled={currentPage >= lastPage} onClick={() => setPage(currentPage + 1)}>다음</button></div>
      <p className="px-5 pb-4 text-xs text-slate-500">조회 전용입니다. 입금 확인은 연결 업무에서 진행합니다. 납기일이 없으므로 연체로 판단하지 않으며 부분 입금·날짜 누락·완납 표시와 금액 불일치는 확인 대상으로 표시합니다.</p>
    </>}
  </section>;
}
