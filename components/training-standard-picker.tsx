"use client";

import { useState } from "react";
import { useCertificationFields } from "@/components/use-certification-fields";
import { appendTrainingStandard, trainingStandardOptions } from "@/lib/training-standard-selection";
import { Button } from "@/components/ui/button";
import { controlClass } from "@/components/form-fields";

export function TrainingStandardPicker({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  const store = useCertificationFields();
  const [query, setQuery] = useState("");
  const [notice, setNotice] = useState("");
  const options = trainingStandardOptions(store.catalog, query);
  const select = (field: string) => {
    if (store.loading || store.error) return;
    try { onChange(appendTrainingStandard(value, field, store.catalog)); setNotice(`${field}을(를) 신청표준에 추가했습니다.`); }
    catch { setNotice("신청표준을 추가하지 못했습니다. 입력값을 확인해 주세요."); }
  };
  return <details className="mt-3 rounded-lg border bg-card p-3">
    <summary className="cursor-pointer text-sm font-medium">등록된 인증분야에서 신청표준 선택</summary>
    <p className="mt-2 text-xs text-muted-foreground">선택한 표준을 기존 입력에 추가합니다. 기존 표준을 삭제하거나 인정범위를 자동 승인하지 않습니다. 지정 유효범위만 선택하세요.</p>
    <div className="mt-3 flex flex-wrap items-center gap-2"><input aria-label="등록 인증분야 검색" className={controlClass} placeholder="표준·세부 분야 검색" value={query} onChange={event => setQuery(event.target.value)}/><Button type="button" variant="outline" disabled={store.loading} onClick={store.reload}>분야 다시 조회</Button></div>
    <p role="status" className="mt-2 text-sm">{store.loading ? "인증분야 조회 중..." : store.error || notice}</p>
    {!store.loading && !store.error && <div className="mt-2 flex max-h-40 flex-wrap gap-2 overflow-auto">{options.map(field => <Button key={field} type="button" size="sm" variant="outline" disabled={value.split(",").some(item => item.trim() === field)} onClick={() => select(field)}>{field}</Button>)}{!options.length && <p className="text-sm text-muted-foreground">조건에 맞는 등록 분야가 없습니다.</p>}</div>}
  </details>;
}
