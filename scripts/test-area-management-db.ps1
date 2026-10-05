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
  & $taskDocker exec $taskContainer pg_isready -U postgres 2>$null | Out-Null
  if($LASTEXITCODE -eq 0){$taskReady=$true;break}
  Start-Sleep -Seconds 1
 }
 if(-not $taskReady){throw '가상 DB 준비 시간 초과'}
 $taskMigration=Get-Content -LiteralPath (Join-Path $PSScriptRoot '../supabase/migrations/202610050028_area_management_numbers.sql') -Raw
 $taskFixture=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'fixtures/area-management.sql') -Raw
 $taskChecks=Get-Content -LiteralPath (Join-Path $PSScriptRoot 'fixtures/area-management-checks.sql') -Raw
 $taskSql=$taskFixture+"`n"+$taskMigration+"`n"+$taskMigration+"`n"+$taskChecks
 $taskSql | & $taskDocker exec -i $taskContainer psql -U postgres -d postgres -v ON_ERROR_STOP=1
 if($LASTEXITCODE -ne 0){throw '관리번호 SQL 검증 실패'}
 Write-Output '관리번호 SQL 가상 DB 검사 통과: 분야 분리·중복 차단·예약 유지·재실행·권한 검사. 운영 DB 및 전체 이관 흐름 검증은 별도입니다.'
} finally {
 [Environment]::SetEnvironmentVariable('POSTGRES_PASSWORD',$taskPriorPassword,'Process')
 if($taskCreated){ & $taskDocker rm -f $taskContainer | Out-Null }
}
