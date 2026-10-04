import type { PrototypeApplicationRecord } from "@/lib/prototype-storage";
export function groupApplicationRecords(records: PrototypeApplicationRecord[]) {
  const groups = new Map<string, PrototypeApplicationRecord[]>();
  for (const record of records) {
    const group = groups.get(record.id) ?? [];
    group.push(record); groups.set(record.id, group);
  }
  return [...groups.values()].map((linkedRecords) => ({ record: linkedRecords[0], linkedRecords }));
}
export type ApplicationListSort = "received-desc" | "received-asc" | "candidate" | "standard" | "partner" | "status";
export function sortApplicationGroups(groups: ReturnType<typeof groupApplicationRecords>, sort: ApplicationListSort, statusLabel: (record: PrototypeApplicationRecord) => string) {
  return [...groups].sort((a, b) => {
    const first = a.record, second = b.record;
    const compare = (left: string, right: string) => left.localeCompare(right, "ko", { numeric: true });
    let result = 0;
    if (sort === "received-desc") result = compare(second.receivedAt, first.receivedAt);
    else if (sort === "received-asc") result = compare(first.receivedAt, second.receivedAt);
    else if (sort === "candidate") result = compare(first.candidateName, second.candidateName);
    else if (sort === "partner") result = compare(first.partnerCompany, second.partnerCompany);
    else if (sort === "standard") result = compare(a.linkedRecords.map((item) => item.standard).sort().join(", "), b.linkedRecords.map((item) => item.standard).sort().join(", "));
    else result = compare(statusLabel(first), statusLabel(second));
    return result || compare(first.applicationNo, second.applicationNo) || compare(first.id, second.id);
  });
}
