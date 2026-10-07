export function StorageBackupOverview({ sharedConfigured }: { sharedConfigured: boolean }) {
  const locations = [
    { title: "업무 데이터", location: sharedConfigured ? "Supabase PostgreSQL" : "브라우저 가상데이터 저장", detail: sharedConfigured ? "후보자·신청·Job·검토·심의·인증 및 업무 이력을 저장하도록 구성돼 있습니다. 연결 설정은 실제 저장 성공의 증거가 아닙니다." : "공유 DB 설정이 없는 미리보기 모드입니다. 이 브라우저에 저장한 값은 다른 기기에 자동 공유되지 않습니다." },
    { title: "등록한 문서 양식", location: sharedConfigured ? "Supabase Storage · document-templates" : "내장 양식·로컬 미리보기", detail: "관리자가 업로드한 양식 파일과 DB의 양식 정보는 별개입니다. DB 기록만 복원해도 양식 파일이 복구되는 것은 아닙니다." },
    { title: "생성한 기록 패키지", location: "다운로드한 기기의 파일 저장소", detail: "생성 이력은 파일 보관과 다릅니다. 현재 생성 이력 목록에는 ZIP 자체를 보관하지 않으며 Dropbox 자동 보관은 아직 별도 작업입니다." },
  ];
  return <section className="rounded-xl border bg-card p-6 text-card-foreground" aria-labelledby="storage-backup-title">
    <h3 id="storage-backup-title" className="font-semibold">데이터 보관·백업 범위</h3>
    <p className="mt-2 text-sm text-muted-foreground">저장 위치 안내이며 실시간 백업 상태 점검 결과가 아닙니다. Vercel은 프로그램 실행, GitHub는 소스코드 보관용으로 고객 DB의 백업을 대신하지 않습니다.</p>
    <div className="mt-4 grid gap-3 lg:grid-cols-3">{locations.map(item => <div key={item.title} className="rounded-lg border p-4"><h4 className="text-sm font-semibold">{item.title}</h4><p className="mt-2 text-sm">{item.location}</p><p className="mt-2 text-xs leading-5 text-muted-foreground">{item.detail}</p></div>)}</div>
    <div className="mt-4 rounded-lg border border-amber-300 p-4 text-sm">
      <p className="font-semibold">자동백업 실행·보관기간·실패 알림: 확인되지 않음</p>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">수동 백업·격리 복원 시험용 도구가 준비돼 있어도 현재 자동백업이 동작한다는 뜻은 아닙니다. 최근 백업 파일, 암호화·외부 보관, 복원 결과와 실패 알림을 확인해야 합니다. 이 화면에서는 백업이나 복원을 실행하지 않습니다.</p>
    </div>
    <details className="mt-4 text-sm"><summary className="cursor-pointer font-medium">실제 데이터 투입 전 확인할 사항</summary><ul className="mt-3 list-disc space-y-2 pl-5 text-xs leading-5 text-muted-foreground">
      <li>Supabase 프로젝트의 실제 서버 지역과 보관 정책을 확인합니다. 이 프로그램에서 지역을 조회·검증하지 않았습니다.</li>
      <li>업무 DB와 Storage 실파일을 각각 백업·복원 시험합니다. 생성한 패키지의 별도 보관 위치도 정합니다.</li>
      <li>복원 시험은 운영 DB를 덮어쓰지 않는 격리 환경에서 수행하고 로그인·권한·파일 열기를 확인합니다.</li>
      <li>DB 비밀번호·서비스 키·백업 복호화 키를 대화나 GitHub에 올리지 않습니다.</li>
    </ul></details>
  </section>;
}
