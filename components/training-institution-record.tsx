import { trainingInstitutionRecordComparison, type TrainingInstitution } from "@/lib/training-institutions";

export function TrainingInstitutionRecord({ record, current, lookupState }: {
  record: { providerInstitutionId?: string; providerName: string; providerDesignationNo?: string };
  current?: TrainingInstitution;
  lookupState: "LOADING" | "ERROR" | "READY";
}) {
  const comparison = trainingInstitutionRecordComparison(record, current);
  return <div className="mt-3 space-y-2 rounded-lg border bg-card p-3 text-xs">
    <p className="font-semibold">업무 입력 기록 · 문서 반영 기준</p>
    <p>기관명 {record.providerName || "미입력"} · 지정번호 {record.providerDesignationNo || "미입력"}</p>
    <p className="text-muted-foreground">기관명·지정번호는 명단 재조회로 덮어쓰지 않습니다. 다른 기관을 선택하면 업무 입력 기록이 변경됩니다.</p>
    {lookupState !== "READY" ? <p className="text-amber-700">{lookupState === "LOADING" ? "현재 기관 명단 조회 중 · 대조 미확정" : "현재 기관 명단 조회 실패 · 대조 미확정"}</p> : <>
      {comparison === "LEGACY" && <p className="text-amber-700">기존 이름 기반 기록 · 기관 ID 미연결. 아래 명단 정보는 참고용이며 과거 지정번호를 추정하지 않습니다.</p>}
      {comparison === "MISSING" && <p className="text-amber-700">연결된 기관을 현재 명단에서 확인하지 못했습니다. 업무 입력 기록은 유지합니다.</p>}
      {comparison === "CHANGED" && <p className="text-amber-700">현재 명단의 기관명 또는 지정번호가 업무 입력 기록과 다릅니다. 당시 증빙을 확인해 주세요.</p>}
      {current && comparison !== "MISSING" && <p className="text-muted-foreground">현재 명단(참고): {current.name} · 지정번호 {current.designationNo} · 유효기간 {current.validFrom} ~ {current.validUntil} · 신청표준 {current.standards.join(", ")} · {current.active ? "활성" : "비활성"}</p>}
    </>}
  </div>;
}
