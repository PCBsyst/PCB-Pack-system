import type { DocumentLanguage } from "@/lib/prototype-package";

export type DocumentExamSchedule = {
  providerType: "PARTNER" | "NON_PARTNER";
  providerName: string;
  trainingEndDate: string;
  examNoticeDate: string;
  examDate: string;
};

/** Report saved inputs only; never calculate or invent evidence dates here. */
export function documentTrainingSummary(schedule: DocumentExamSchedule | undefined, language: DocumentLanguage): string {
  if (!schedule) return "";
  const labels = language === "KR"
    ? ["교육기관 구분", "교육기관", "교육 종료일", "시험 통보일", "시험일"]
    : ["Training provider type", "Training provider", "Training end date", "Exam notice date", "Exam date"];
  const type = language === "KR"
    ? schedule.providerType === "PARTNER" ? "지정 연수기관" : "비지정 교육기관"
    : schedule.providerType === "PARTNER" ? "Designated training provider" : "Non-designated training provider";
  return [type, schedule.providerName, schedule.trainingEndDate, schedule.examNoticeDate, schedule.examDate]
    .map((value, index) => `${labels[index]}: ${value || "-"}`).join(" / ");
}
