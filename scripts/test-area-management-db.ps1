param([switch]$FullWorkflow,[switch]$Permissions)
$ErrorActionPreference='Stop'
$taskDocker=Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Programs/DockerDesktop/resources/bin/docker.exe'
$taskContainer='pcb-area-test-'+[Guid]::NewGuid().ToString('N').Substring(0,12)
$taskSecret=[Guid]::NewGuid().ToString('N')
$taskPriorPassword=[Environment]::GetEnvironmentVariable('POSTGRES_PASSWORD','Process')
$taskCreated=$false
try {
 $env:POSTGRES_PASSWORD=$taskSecret
 & $taskDocker run -d --name $taskContainer --network none --tmpfs /var/lib/postgresql/data -e POSTGRES_PASSWORD public.ecr.aws/supabase/postgres:17.11.0.002 | Out-Null
 if($LASTEXITCODE -ne 0){throw '가상 DB 생성 실패'}
 $taskCreated=$true
 $taskReady=$false
 for($i=0;$i -lt 30;$i++){
  & $taskDocker exec $taskContainer pg_isready -h 127.0.0.1 -U postgres 2>$null | Out-Null
  if($LASTEXITCODE -eq 0){$taskReady=$true;break}
  Start-Sleep -Seconds 1
 }
 if(-not $taskReady){throw '가상 DB 준비 시간 초과'}
 if($Permissions){
  $taskPermissionSql=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'fixtures/permissions-auth.sql') -Raw
  $taskPermissionSql+="`n"+(Get-Content -LiteralPath (Join-Path $PSScriptRoot '../supabase/migrations/202609280001_initial_certification_schema.sql') -Raw)
  $taskPermissionSql+="`n"+(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'fixtures/permissions-seed.sql') -Raw)
  foreach($file in @('202610030016_account_approval.sql','202610030018_privacy_access_logs.sql','202610030019_candidate_archive.sql','202610030023_customer_reason_and_evidence_protection.sql','202610040025_database_mfa_guard.sql','202610050026_mfa_requirement_control.sql')){
   $taskPermissionSql+="`n"+(Get-Content -LiteralPath (Join-Path $PSScriptRoot "../supabase/migrations/$file") -Raw)
  }
  $taskPermissionSql+="`n"+(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'fixtures/permissions-checks.sql') -Raw)
  $taskPermissionSql+="`n"+(Get-Content -LiteralPath (Join-Path $PSScriptRoot 'sql/operational-inventory.sql') -Raw)
  $taskPermissionSql | & $taskDocker exec -i $taskContainer psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1
  if($LASTEXITCODE -ne 0){throw '권한별 가상 DB 검사 실패'}
  Write-Output '실제 DB 역할/RLS 권한 검사 통과. 로그인·서명 JWT·서비스 API와 전체 스키마 검증은 별도입니다.'
  return
 }
 $taskMigration=Get-Content -LiteralPath (Join-Path $PSScriptRoot '../supabase/migrations/202610050028_area_management_numbers.sql') -Raw
 $taskFixture=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'fixtures/area-management.sql') -Raw
 $taskChecks=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'fixtures/area-management-checks.sql') -Raw
 if($FullWorkflow){
  $taskFixture=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'fixtures/legacy-workflow.sql') -Raw
  $taskOriginal=Get-Content -LiteralPath (Join-Path $PSScriptRoot '../supabase/migrations/202610030023_customer_reason_and_evidence_protection.sql') -Raw
  $taskChecks=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'fixtures/legacy-workflow-checks.sql') -Raw
  $taskBatch=Get-Content -LiteralPath (Join-Path $PSScriptRoot '../supabase/migrations/202609300013_legacy_import_audit.sql') -Raw
  $taskVerify=Get-Content -LiteralPath (Join-Path $PSScriptRoot '../supabase/migrations/202609300014_verify_legacy_import_batches.sql') -Raw
  $taskFixture+="`n"+$taskOriginal+"`n"+$taskBatch+"`n"+$taskVerify
 }
 $taskFix=''
 if($FullWorkflow){$taskFix=Get-Content -LiteralPath (Join-Path $PSScriptRoot '../supabase/migrations/202610050029_import_status_casts.sql') -Raw}
 $taskSql=$taskFixture+"`n"+$taskMigration+"`n"+$taskMigration+"`n"+$taskFix+"`n"+$taskFix+"`n"+$taskChecks
 if($FullWorkflow){
  $taskConcurrentFix=Get-Content -LiteralPath (Join-Path $PSScriptRoot '../supabase/migrations/202610050030_import_concurrency_audit.sql') -Raw
  $taskAuditChecks=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'fixtures/legacy-audit-checks.sql') -Raw
  $taskSql+="`n"+$taskConcurrentFix+"`n"+$taskConcurrentFix+"`n"+$taskAuditChecks
 }
 $taskSql | & $taskDocker exec -i $taskContainer psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1
 if($LASTEXITCODE -ne 0){throw '관리번호 SQL 검증 실패'}
 if($FullWorkflow){
  $taskProcesses=@()
  try {
   for($i=0;$i -lt 12;$i++){
    $taskArea=if($i%2 -eq 0){'ISO'}else{'K_BEAUTY'}
    $taskInfo=[Diagnostics.ProcessStartInfo]::new()
    $taskInfo.FileName=$taskDocker;$taskInfo.UseShellExecute=$false;$taskInfo.CreateNoWindow=$true
    $taskInfo.RedirectStandardOutput=$true;$taskInfo.RedirectStandardError=$true
    $taskQuery="insert into public.concurrent_allocations values('$taskArea',public.allocate_management_numbers_for_area('$taskArea',1)); select public.import_legacy_certification_row('{`"candidateName`":`"동시 이관 후보자`",`"candidateEmail`":`"parallel@example.invalid`",`"businessArea`":`"$taskArea`",`"jobNo`":`"PARALLEL-$i`",`"standard`":`"TEST`",`"grade`":`"TEST`",`"receivedAt`":`"2026-01-01`"}');"
    # Match production's independent reservation RPC; release area locks before importing.
    $taskQuery='begin; '+$taskQuery.Replace('; select public.import','; commit; select public.import')
    foreach($arg in @('exec',$taskContainer,'psql','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1','-c',$taskQuery)){$taskInfo.ArgumentList.Add($arg)}
    $taskProcess=[Diagnostics.Process]::new();$taskProcess.StartInfo=$taskInfo;[void]$taskProcess.Start()
    $taskProcesses+=@{process=$taskProcess;output=$taskProcess.StandardOutput.ReadToEndAsync();error=$taskProcess.StandardError.ReadToEndAsync()}
   }
   foreach($entry in $taskProcesses){if(-not $entry.process.WaitForExit(30000)){throw '동시 검사 시간 초과'};if($entry.process.ExitCode -ne 0){throw ('동시 검증 실패: '+$entry.error.GetAwaiter().GetResult())}}
   "do `$`$begin if (select count(*) from public.concurrent_allocations)<>12 or exists(select area from public.concurrent_allocations group by area having count(*)<>6) then raise exception 'Concurrent allocation mismatch';end if; if (select count(*) from public.candidates where email='parallel@example.invalid')<>1 or (select count(distinct candidate_id) from public.jobs where job_no like 'PARALLEL-%')<>1 or (select count(*) from public.jobs where job_no like 'PARALLEL-%')<>12 then raise exception 'Concurrent candidate duplication';end if;end;`$`$;" | & $taskDocker exec -i $taskContainer psql -U supabase_admin -d postgres -v ON_ERROR_STOP=1
   if($LASTEXITCODE -ne 0){throw '동시 번호 할당 결과 오류'}
  } finally {foreach($entry in $taskProcesses){if(-not $entry.process.HasExited){$entry.process.Kill();$entry.process.WaitForExit()};$entry.process.Dispose()}}
  Write-Output '실제 이관 함수·배치 감사기록·12개 동시 번호 할당 및 동일 후보자 이관 검사 통과. 실제 인증/RLS/전체 운영 스키마 검증은 별도입니다.'
 }
 Write-Output '관리번호 SQL 가상 DB 검사 통과: 분야 분리·중복 차단·예약 유지·재실행·권한 검사. 운영 DB 및 전체 이관 흐름 검증은 별도입니다.'
} finally {
 [Environment]::SetEnvironmentVariable('POSTGRES_PASSWORD',$taskPriorPassword,'Process')
 if($taskCreated){ & $taskDocker rm -f $taskContainer | Out-Null }
}
