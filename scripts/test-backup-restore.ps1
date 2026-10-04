[CmdletBinding()]
param([switch]$VerifyPendingMigrations)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$dockerExe = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Programs/DockerDesktop/resources/bin/docker.exe'
$restoreContainer = 'pcb-restore-check-' + [Guid]::NewGuid().ToString('N').Substring(0,12)
$restoreCreated = $false
$restoreStage = 'INIT'
$restoreBytes = $null
$restoreSecret = [Guid]::NewGuid().ToString('N') + [Guid]::NewGuid().ToString('N')
function Invoke-RestoreDocker([string[]]$DockerArgs, [string]$InputSql = '') {
    $psi = [Diagnostics.ProcessStartInfo]::new()
    $psi.FileName = $dockerExe
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.RedirectStandardInput = $true
    $psi.StandardInputEncoding = [Text.UTF8Encoding]::new($false)
    foreach ($arg in $DockerArgs) { $psi.ArgumentList.Add($arg) }
    $psi.Environment['POSTGRES_PASSWORD'] = $restoreSecret
    $psi.Environment['GOTRUE_DB_DATABASE_URL'] = 'postgres://supabase_admin:' + $restoreSecret + '@127.0.0.1:5432/postgres'
    $psi.Environment['GOTRUE_JWT_SECRET'] = $restoreSecret
    $psi.Environment['DATABASE_URL'] = $psi.Environment['GOTRUE_DB_DATABASE_URL']
    $psi.Environment['AUTH_JWT_SECRET'] = $restoreSecret
    $psi.Environment['ANON_KEY'] = 'isolated-restore-test-only'
    $psi.Environment['SERVICE_KEY'] = 'isolated-restore-test-only'
    $p = [Diagnostics.Process]::new()
    $p.StartInfo = $psi
    try {
        [void]$p.Start()
        $outTask = $p.StandardOutput.ReadToEndAsync()
        $errTask = $p.StandardError.ReadToEndAsync()
        $p.StandardInput.Write($InputSql)
        $p.StandardInput.Close()
        $p.WaitForExit()
        return @{ code=$p.ExitCode; output=$outTask.GetAwaiter().GetResult(); error=$errTask.GetAwaiter().GetResult() }
    } finally { $p.Dispose() }
}
try {
    $root = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'PCB-Certification-Backups'
    $backup = Get-ChildItem -LiteralPath $root -Directory | Sort-Object Name -Descending | Where-Object { Test-Path -LiteralPath (Join-Path $_.FullName 'manifest.json') } | Select-Object -First 1
    if (-not $backup) { throw 'No complete export found.' }
    $manifest = Get-Content -LiteralPath (Join-Path $backup.FullName 'manifest.json') -Raw | ConvertFrom-Json
    if ($manifest.projectRef -ne 'plczaqhgwdmgrausopmr' -or $manifest.exportComplete -ne $true) { throw 'Unexpected backup.' }
    $restoreStage = 'START_ISOLATED_DB'
    $run = Invoke-RestoreDocker @('run','-d','--rm','--name',$restoreContainer,'--network','none','--tmpfs','/var/lib/postgresql/data:rw,noexec,nosuid,size=512m','--env','POSTGRES_PASSWORD','public.ecr.aws/supabase/postgres:17.11.0.002','postgres','-D','/var/lib/postgresql/data','-c','shared_preload_libraries=pg_stat_statements')
    if ($run.code -ne 0) { throw 'Temporary database start failed.' }
    $restoreCreated = $true
    $ready = $false
    for ($attempt=0; $attempt -lt 30; $attempt++) {
        # The initialization script also starts a temporary server. Wait for final PID 1.
        $finalServer = Invoke-RestoreDocker @('exec',$restoreContainer,'cat','/proc/1/comm')
        $probe = Invoke-RestoreDocker @('exec',$restoreContainer,'pg_isready','-U','supabase_admin','-d','postgres')
        if ($finalServer.output.Trim() -in @('postgres','.postgres-wrapp') -and $probe.code -eq 0) { $ready=$true; break }
        Start-Sleep -Seconds 1
    }
    if (-not $ready) { throw 'Temporary database not ready.' }
    $restoreStage = 'SUPABASE_BASE_ROLES'
    $baseRoles = @'
DO $$ BEGIN
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='postgres') THEN CREATE ROLE postgres NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='anon') THEN CREATE ROLE anon NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticated') THEN CREATE ROLE authenticated NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='authenticator') THEN CREATE ROLE authenticator NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='service_role') THEN CREATE ROLE service_role NOLOGIN BYPASSRLS; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='supabase_realtime_admin') THEN CREATE ROLE supabase_realtime_admin NOLOGIN; END IF;
  IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname='supabase_storage_admin') THEN CREATE ROLE supabase_storage_admin NOLOGIN; END IF;
END $$;
'@
    $baseResult = Invoke-RestoreDocker @('exec','-i',$restoreContainer,'psql','-X','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1') $baseRoles
    if ($baseResult.code -ne 0) { throw 'Base role initialization failed.' }
    $restoreStage = 'OFFICIAL_AUTH_MIGRATIONS'
    # The official service initializes auth tables. No published ports, SMTP,
    # production credentials or external network are available to this container.
    $authMigration = Invoke-RestoreDocker @('run','--rm','--network',('container:' + $restoreContainer),'--env','GOTRUE_DB_DATABASE_URL','--env','GOTRUE_JWT_SECRET','--env','GOTRUE_DB_DRIVER=postgres','--env','GOTRUE_SITE_URL=http://127.0.0.1','--env','API_EXTERNAL_URL=http://127.0.0.1','supabase/gotrue:v2.197.0','auth','migrate')
    if ($authMigration.code -ne 0) { throw 'Official auth schema initialization failed.' }
    Write-Output '공식 인증 서비스의 기본 스키마 초기화: 성공'
    $restoreStage = 'OFFICIAL_STORAGE_MIGRATIONS'
    $storageMigration = Invoke-RestoreDocker @('run','--rm','--network',('container:' + $restoreContainer),'--env','DATABASE_URL','--env','AUTH_JWT_SECRET','--env','ANON_KEY','--env','SERVICE_KEY','--env','STORAGE_BACKEND=file','supabase/storage-api:v1.74.0','node','-e',"const {runMigrationsOnTenant}=require('./dist/internal/database/migrations'); runMigrationsOnTenant({databaseUrl:process.env.DATABASE_URL}).then(()=>process.exit(0)).catch(()=>process.exit(1));")
    if ($storageMigration.code -ne 0) { throw 'Official storage schema initialization failed.' }
    Write-Output '공식 저장소 서비스의 기본 스키마 초기화: 성공'
    # This structural test does not claim platform-equivalent role privileges or RLS enforcement.
    foreach ($name in @('roles.sql','schema.sql','data.sql')) {
        $restoreStage = 'RESTORE_' + $name
        $entry = @($manifest.files | Where-Object { $_.file -eq ($name + '.dpapi') })
        if ($entry.Count -ne 1) { throw 'Manifest file mismatch.' }
        $restoreBytes = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes((Join-Path $backup.FullName ($name + '.dpapi'))),$null,[Security.Cryptography.DataProtectionScope]::CurrentUser)
        $actualHash = [Convert]::ToHexString([Security.Cryptography.SHA256]::HashData($restoreBytes))
        if ($actualHash -ne $entry[0].plaintextSha256) { throw 'Backup hash mismatch.' }
        $sql = [Text.Encoding]::UTF8.GetString($restoreBytes)
        if ($name -eq 'data.sql') { $sql = "SET session_replication_role = replica;`n" + $sql }
        $restored = Invoke-RestoreDocker @('exec','-i',$restoreContainer,'psql','-X','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose','--single-transaction') $sql
        $sql = $null
        [Array]::Clear($restoreBytes,0,$restoreBytes.Length)
        $restoreBytes = $null
        if ($restored.code -ne 0) {
            # Only schema-level failure categories; never print SQL, rows, names or credentials.
            $reason = 'UNCLASSIFIED'
            if ($restored.error -match 'role .*already exists') { $reason='BASE_ROLE_ALREADY_EXISTS' }
            elseif ($restored.error -match 'role "(?:postgres|anon|authenticated|authenticator|service_role|supabase_admin|supabase_auth_admin|supabase_read_only_user)" does not exist') { $reason='BASE_ROLE_MISSING' }
            elseif ($restored.error -match 'unrecognized configuration parameter') { $reason='BASE_CONFIGURATION_PARAMETER_MISSING' }
            elseif ($restored.error -match 'relation "([a-z_]+)\.([a-z_]+)" does not exist') {
                # Schema/table identifiers only, never SQL or row data.
                Write-Output ('누락된 기본 테이블: ' + $Matches[1] + '.' + $Matches[2])
                $reason='BASE_SCHEMA_OR_TABLE_MISSING'
            }
            elseif ($restored.error -match 'schema .*does not exist|relation .*does not exist') { $reason='BASE_SCHEMA_OR_TABLE_MISSING' }
            elseif ($restored.error -match 'function .*does not exist') { $reason='BASE_FUNCTION_MISSING' }
            elseif ($restored.error -match 'permission denied|must be owner') { $reason='BASE_PERMISSION_MISMATCH' }
            elseif ($restored.error -match '(?:ERROR|FATAL):\s+([A-Z0-9]{5})') { $reason='SQLSTATE_' + $Matches[1] }
            throw ('Restore failed: ' + $reason)
        }
        Write-Output ('복원 파일 검증: ' + $name + ' 성공')
    }
    $restoreStage = 'VERIFY_TABLE_COUNTS'
    $counts = Invoke-RestoreDocker @('exec','-i',$restoreContainer,'psql','-X','-U','supabase_admin','-d','postgres','-At','-v','ON_ERROR_STOP=1') "SELECT json_build_object('candidates',(SELECT count(*) FROM public.candidates),'applications',(SELECT count(*) FROM public.applications),'jobs',(SELECT count(*) FROM public.jobs));"
    if ($counts.code -ne 0) { throw 'Row count check failed.' }
    Write-Output $counts.output.Trim()
    $restoreStage = 'VERIFY_REFERENTIAL_INTEGRITY'
    # Import uses replica mode, so independently check every restored foreign key.
    $integritySql = @'
DO $$
DECLARE fk record; join_clause text; nonnull_clause text; orphan_count bigint;
BEGIN
  FOR fk IN SELECT * FROM pg_constraint WHERE contype = 'f' LOOP
    SELECT string_agg(format('s.%I = t.%I', a.attname, b.attname), ' AND '),
           string_agg(format('s.%I IS NOT NULL', a.attname), ' AND ')
    INTO join_clause, nonnull_clause
    FROM unnest(fk.conkey, fk.confkey) AS k(source_col, target_col)
    JOIN pg_attribute a ON a.attrelid = fk.conrelid AND a.attnum = k.source_col
    JOIN pg_attribute b ON b.attrelid = fk.confrelid AND b.attnum = k.target_col;
    EXECUTE format('SELECT count(*) FROM %s s WHERE %s AND NOT EXISTS (SELECT 1 FROM %s t WHERE %s)',
                   fk.conrelid::regclass, nonnull_clause, fk.confrelid::regclass, join_clause)
    INTO orphan_count;
    IF orphan_count <> 0 THEN RAISE EXCEPTION 'RESTORE_REFERENCE_CHECK_FAILED'; END IF;
  END LOOP;
  IF EXISTS (SELECT 1 FROM pg_class WHERE oid IN
      ('public.candidates'::regclass, 'public.applications'::regclass, 'public.jobs'::regclass, 'public.profiles'::regclass)
      AND NOT relrowsecurity) THEN
    RAISE EXCEPTION 'RESTORE_RLS_CONFIGURATION_CHECK_FAILED';
  END IF;
END $$;
'@
    $integrity = Invoke-RestoreDocker @('exec','-i',$restoreContainer,'psql','-X','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1') $integritySql
    if ($integrity.code -ne 0) { throw 'Restored reference or RLS configuration check failed.' }
    Write-Output '전체 외래키 참조관계 및 핵심 테이블 RLS 활성 설정: 확인'
    if ($VerifyPendingMigrations) {
        $restoreStage = 'VERIFY_PENDING_MIGRATIONS'
        $migrationFiles = @(
            '202610030019_candidate_archive.sql',
            '202610030020_candidate_deletion.sql',
            '202610030021_feature_controls.sql',
            '202610030022_package_generation_receipts.sql',
            '202610030023_customer_reason_and_evidence_protection.sql',
            '202610030024_candidate_optimistic_concurrency.sql'
        )
        # Only the disposable database receives these changes. Run twice to verify
        # the user's previously encountered "already exists" condition is handled.
        foreach ($pass in 1..2) {
            foreach ($migrationFile in $migrationFiles) {
                $restoreStage = 'VERIFY_MIGRATION_' + $migrationFile
                $migrationSql = Get-Content -LiteralPath (Join-Path $PSScriptRoot ('../supabase/migrations/' + $migrationFile)) -Raw
                $migrationResult = Invoke-RestoreDocker @('exec','-i',$restoreContainer,'psql','-X','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1','-v','VERBOSITY=verbose') $migrationSql
                if ($migrationResult.code -ne 0) {
                    if ($migrationResult.error -match 'ERROR:\s+([A-Z0-9]{5})') { Write-Output ('SQL 오류 분류: ' + $Matches[1]) }
                    throw 'Pending migration failed in disposable database.'
                }
            }
            Write-Output ('격리 DB SQL 019~024 적용: ' + $pass + '차 성공')
        }
        $restoreStage = 'VERIFY_PENDING_SECURITY_BEHAVIOR'
        $securitySql = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'verify-restored-security.sql') -Raw
        $securityResult = Invoke-RestoreDocker @('exec','-i',$restoreContainer,'psql','-X','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1') $securitySql
        if ($securityResult.code -ne 0) { throw 'Restored security behavior check failed.' }
        Write-Output '격리 DB의 변경 사유·동시 수정 충돌·보관/복원·삭제 이력 보호: 확인'
        $restoreStage = 'VERIFY_DATABASE_MFA'
        $mfaSql = Get-Content -LiteralPath (Join-Path $PSScriptRoot '../supabase/migrations/202610040025_database_mfa_guard.sql') -Raw
        foreach ($pass in 1..2) {
            $mfaResult = Invoke-RestoreDocker @('exec','-i',$restoreContainer,'psql','-X','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1') $mfaSql
            if ($mfaResult.code -ne 0) { throw 'Database MFA migration check failed.' }
        }
        $mfaTest = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'verify-restored-mfa.sql') -Raw
        $mfaResult = Invoke-RestoreDocker @('exec','-i',$restoreContainer,'psql','-X','-U','supabase_admin','-d','postgres','-v','ON_ERROR_STOP=1') $mfaTest
        if ($mfaResult.code -ne 0) { throw 'Database MFA behavior check failed.' }
        Write-Output '격리 DB MFA 정책 재실행·직접 조회/RPC 차단·본인 설정 조회: 확인'
    }
    Write-Output '복원 시험: 성공 (실제 사용자 권한 및 파일 저장소 복구 시험은 별도 필요)'
} catch {
    Write-Output ('복원 시험: 미완료 / 단계: ' + $restoreStage)
    # All explicit failures above contain only non-sensitive fixed labels.
    if ($_.Exception.Message -match '^Restore failed: [A-Z0-9_]+$') { Write-Output $_.Exception.Message }
    exit 1
} finally {
    if ($restoreBytes) { [Array]::Clear($restoreBytes,0,$restoreBytes.Length) }
    $restoreSecret = $null
    if ($restoreCreated) {
        $stop = Invoke-RestoreDocker @('stop','--time','5',$restoreContainer)
        if ($stop.code -eq 0) { Write-Output '임시 DB를 중지·제거했습니다. 운영 DB는 변경하지 않았습니다.' }
        else { Write-Output '임시 DB의 중지 확인이 필요합니다.' }
    }
}
