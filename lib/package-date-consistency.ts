import type { PackageContext, DeliveryDocumentKey } from "@/lib/prototype-package";

type Input = Pick<PackageContext, "examSchedules" | "certificates" | "deliveryDocuments">;
export type PackageDateDifference = { jobId: string; key: DeliveryDocumentKey; label: string; sourceDate: string; documentDate: string };

// 날짜의 의미가 다를 수 있으므로 경고만 제공합니다. 값을 덮어쓰거나 생성을 차단하지 않습니다.
export function packageDateDifferences(jobs: { id: string }[], input: Input): PackageDateDifference[] {
  return jobs.flatMap((job) => {
    const schedule = input.examSchedules?.[job.id];
    const comparisons: [DeliveryDocumentKey, string, string | undefined][] = [
      ["examNotice", "시험 통보일", schedule?.examNoticeDate],
      ["examAnswers", "시험일", schedule?.examDate],
      ["certificate", "인증서 발행일", input.certificates[job.id]?.issueDate],
    ];
    return comparisons.flatMap(([key, label, sourceDate]) => {
      const record = input.deliveryDocuments[job.id]?.[key];
      if (!sourceDate || !record?.date || record.applicability === "NOT_APPLICABLE" || !record.received || sourceDate === record.date) return [];
      return [{ jobId: job.id, key, label, sourceDate, documentDate: record.date }];
    });
  });
}
