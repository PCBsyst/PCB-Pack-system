export type CandidateReadState = { id: string; status: "IDLE" | "PROFILE_LOADING" | "JOBS_LOADING" | "READY" | "PROFILE_ERROR" | "JOBS_ERROR" };
export function candidateProfileReady(state: CandidateReadState, selectedId: string) {
  return !!selectedId && state.id === selectedId && ["JOBS_LOADING","READY","JOBS_ERROR"].includes(state.status);
}
export function candidatePreviousJobsReady(state: CandidateReadState, selectedId: string) {
  return !!selectedId && state.id === selectedId && state.status === "READY";
}
