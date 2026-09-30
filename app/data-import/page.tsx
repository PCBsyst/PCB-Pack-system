import { AppShell } from "@/components/app-shell";
import { LegacyDataImport } from "@/components/legacy-data-import";
import { LegacyImportHistory } from "@/components/legacy-import-history";

export default function DataImportPage() {
  return (
    <AppShell
      title="과거자료 가져오기"
      description="구글 시트에서 내려받은 CSV를 먼저 검증하고 이전 대상 자료를 확정합니다."
    >
      <div className="space-y-6"><LegacyDataImport /><LegacyImportHistory /></div>
    </AppShell>
  );
}
