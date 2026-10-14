"use client";
import type { CandidateReadState } from "@/lib/registration-candidate-state";
import { Button } from "@/components/ui/button";

export function RegistrationCandidateStatus({ state, onRetry, saving }: { state: CandidateReadState; onRetry: () => void; saving: boolean }) {
  if (!state.id) return null;
  const labels = {IDLE:"후보자를 선택해 주세요.",PROFILE_LOADING:"조회 이력을 기록하며 후보자 상세정보를 확인 중입니다.",JOBS_LOADING:"후보자 상세정보 확인 완료 · 이전 Job 목록을 조회 중입니다.",READY:"후보자 상세정보와 이전 Job 목록 확인 완료",PROFILE_ERROR:"후보자 상세정보 미확인 · 개인정보 적용 및 등록을 중단했습니다.",JOBS_ERROR:"후보자 상세정보 확인 완료 · 이전 Job 목록 미확인 (갱신·등급변경 등록 불가)"};
  const failed = state.status === "PROFILE_ERROR" || state.status === "JOBS_ERROR";
  return <div role="status" aria-live="polite" className="rounded-md border bg-card p-3 text-sm text-foreground"><p>{labels[state.status]}</p>{failed && <><p className="mt-1 text-xs text-muted-foreground">재조회는 기존 인증 연결 선택을 초기화합니다. 신청 분야와 등급은 유지되며 조회 이력이 다시 기록될 수 있습니다.</p><Button type="button" variant="outline" className="mt-2" disabled={saving} onClick={onRetry}>선택한 후보자 다시 조회</Button></>}</div>;
}
