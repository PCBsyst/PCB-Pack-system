"use client";
import { Button } from "@/components/ui/button";
import { candidateFieldLabels, changedCandidateFields, type CandidateForm } from "@/lib/candidate-form";

export function CandidateConflictNotice({ input, latest, onReload }: { input: CandidateForm; latest: CandidateForm | null; onReload: () => void }) {
  const changed = latest ? changedCandidateFields(input, latest) : [];
  return <section role="alert" className="rounded-lg border border-amber-300 bg-amber-50 p-5">
    <h2 className="font-semibold text-amber-950">다른 변경이 있어 저장을 중단했습니다</h2>
    <p className="mt-2 text-sm text-amber-900">내 입력은 유지했으며 서버 값을 덮어쓰지 않았습니다. 최신 정보를 확인한 뒤 필요한 내용만 다시 수정해 주세요. 보관 상태 변경도 충돌로 처리됩니다.</p>
    {latest && changed.length > 0 && <div className="mt-3 overflow-x-auto"><table className="w-full min-w-[450px] text-left text-sm"><thead><tr><th className="p-2">항목</th><th className="p-2">내 입력 (미저장)</th><th className="p-2">최신 저장 값</th></tr></thead><tbody>{changed.map((key) => <tr key={key} className="border-t border-amber-200"><td className="p-2 font-medium">{candidateFieldLabels[key]}</td><td className="break-all p-2">{input[key] || "미입력"}</td><td className="break-all p-2">{latest[key] || "미입력"}</td></tr>)}</tbody></table></div>}
    {!latest && <p className="mt-3 text-sm">최신 값을 조회하지 못했습니다. 아래 버튼으로 다시 조회해 주세요.</p>}
    <Button className="mt-4" variant="outline" onClick={onReload}>최신 정보로 다시 불러오기</Button>
    <p className="mt-2 text-xs text-amber-900">다시 불러올 때 확인을 받으며, 내 미저장 입력과 수정 사유를 초기화합니다. 강제 덮어쓰기는 제공하지 않습니다.</p>
  </section>;
}
