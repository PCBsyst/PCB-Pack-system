# Interactive, read-only DB export. Never execute migrations or print credentials.
[CmdletBinding()]
param()
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Security
$backupRoot = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'PCB-Certification-Backups'
$backupDir = Join-Path $backupRoot ([DateTime]::UtcNow.ToString('yyyyMMddTHHmmssfffZ'))
$backupCli = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../.tools/supabase/2.119.0/bin/supabase.exe'))
$dockerBin = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Programs/DockerDesktop/resources/bin'
$backupSecure = $null
$backupBstr = [IntPtr]::Zero
$backupPlain = $null
$backupUrl = $null
$backupRecords = @()
$backupStage = 'PRECHECK'
$backupFailureCode = 'LOCAL_PRECHECK_FAILED'
function Get-BackupFailureCode([string]$message) {
    # Return allowlisted labels only. Never return or log raw child output.
    if ($message -match '(?i)password authentication failed|SASL|SQLSTATE 28P01') { return 'DATABASE_AUTH_FAILED' }
    if ($message -match '(?i)server version mismatch|aborting because of server version') { return 'POSTGRES_VERSION_MISMATCH' }
    if ($message -match '(?i)docker-credential|error getting credentials') { return 'DOCKER_CREDENTIAL_HELPER_FAILED' }
    if ($message -match '(?i)failed to connect to the docker|docker daemon|docker_engine') { return 'DOCKER_ENGINE_UNAVAILABLE' }
    if ($message -match '(?i)certificate|TLS|SSL error') { return 'TLS_CONNECTION_FAILED' }
    if ($message -match '(?i)permission denied|access is denied|unauthorized') { return 'ACCESS_DENIED' }
    if ($message -match '(?i)pull access denied|manifest unknown|failed to pull|toomanyrequests') { return 'CONTAINER_IMAGE_PULL_FAILED' }
    if ($message -match '(?i)no such host|connection refused|timeout|network is unreachable|DNS|failed to resolve') { return 'NETWORK_CONNECTION_FAILED' }
    return 'EXPORT_FAILED_UNCLASSIFIED'
}
try {
    if (-not (Test-Path -LiteralPath $backupCli)) { throw 'Supabase CLI missing.' }
    & (Join-Path $dockerBin 'docker.exe') info --format '{{.ServerVersion}}' *> $null
    if ($LASTEXITCODE -ne 0) { throw 'Docker engine not running.' }
    Write-Host '읽기 전용 백업입니다. 운영 DB는 변경하지 않습니다.'
    Write-Host '백업이 완료될 때까지 다른 직원의 입력을 중지해 주세요.'
    Write-Host '암호화 파일은 현재 Windows 계정에서만 열 수 있습니다. 다른 기기용 백업은 아닙니다.'
    $backupSecure = Read-Host '저장해 둔 Supabase DB 비밀번호를 입력하세요 (입력 내용은 표시되지 않습니다)' -AsSecureString
    if ($backupSecure.Length -eq 0) { throw 'Password is empty.' }
    $backupBstr = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($backupSecure)
    $backupPlain = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($backupBstr)
    $backupUrl = 'postgresql://postgres.plczaqhgwdmgrausopmr:' + [Uri]::EscapeDataString($backupPlain) + '@aws-0-ap-northeast-2.pooler.supabase.com:5432/postgres?sslmode=require'
    $backupStage = 'SECURE_FOLDER'
    $backupFailureCode = 'LOCAL_FOLDER_FAILED'
    New-Item -ItemType Directory -Path $backupDir | Out-Null
    $backupSid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
    & icacls.exe $backupDir /inheritance:r /grant:r "*${backupSid}:(OI)(CI)F" *> $null
    if ($LASTEXITCODE -ne 0) { throw 'Cannot restrict backup folder access.' }
    $exports = @(
        @{ Name = 'roles.sql'; Flags = '--role-only' },
        @{ Name = 'schema.sql'; Flags = '' },
        @{ Name = 'data.sql'; Flags = '--data-only --use-copy --exclude storage.buckets_vectors,storage.vector_indexes' }
    )
    foreach ($export in $exports) {
        $backupStage = 'EXPORT_' + $export.Name
        $backupFailureCode = 'EXPORT_PROCESS_FAILED'
        Write-Host ('백업 내보내기: ' + $export.Name)
        $backupFile = Join-Path $backupDir $export.Name
        $start = New-Object Diagnostics.ProcessStartInfo
        $start.FileName = $backupCli
        $start.WorkingDirectory = [IO.Path]::GetDirectoryName($backupCli)
        $start.UseShellExecute = $false
        $start.CreateNoWindow = $true
        $start.RedirectStandardOutput = $true
        $start.RedirectStandardError = $true
        $start.EnvironmentVariables['PATH'] = $dockerBin + ';' + $env:PATH
        # Secret exists briefly in the child command line; privileged local tools can inspect it.
        # Do not use transcripts, debug/dry-run or log the process arguments.
        $start.Arguments = 'db dump --db-url "' + $backupUrl + '" --file "' + $backupFile + '" ' + $export.Flags
        $process = New-Object Diagnostics.Process
        $process.StartInfo = $start
        try {
            [void]$process.Start()
            $stdout = $process.StandardOutput.ReadToEndAsync()
            $stderr = $process.StandardError.ReadToEndAsync()
            $process.WaitForExit()
            $childOutput = $stdout.GetAwaiter().GetResult()
            $childError = $stderr.GetAwaiter().GetResult()
            if ($process.ExitCode -ne 0) {
                $backupFailureCode = Get-BackupFailureCode ($childOutput + "`n" + $childError)
                throw 'Export failed; raw output suppressed.'
            }
        } finally {
            $start.Arguments = ''
            $childOutput = $null
            $childError = $null
            $process.Dispose()
        }
        $backupStage = 'VERIFY_ENCRYPT_' + $export.Name
        $backupFailureCode = 'LOCAL_ENCRYPTION_OR_FILE_FAILED'
        $bytes = [IO.File]::ReadAllBytes($backupFile)
        if ($bytes.Length -eq 0) { throw ('Empty export: ' + $export.Name) }
        $hash = (Get-FileHash -LiteralPath $backupFile -Algorithm SHA256).Hash
        $encrypted = [Security.Cryptography.ProtectedData]::Protect($bytes, $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
        $encryptedFile = $backupFile + '.dpapi'
        [IO.File]::WriteAllBytes($encryptedFile, $encrypted)
        $roundtrip = [Security.Cryptography.ProtectedData]::Unprotect([IO.File]::ReadAllBytes($encryptedFile), $null, [Security.Cryptography.DataProtectionScope]::CurrentUser)
        $sha = [Security.Cryptography.SHA256]::Create()
        try { $verifiedHash = [BitConverter]::ToString($sha.ComputeHash($roundtrip)).Replace('-', '') } finally { $sha.Dispose() }
        if ($verifiedHash -ne $hash) { throw 'Encrypted export verification failed.' }
        $backupRecords += [pscustomobject]@{ file = $export.Name + '.dpapi'; plaintextBytes = $bytes.Length; plaintextSha256 = $hash }
        [Array]::Clear($bytes, 0, $bytes.Length)
        [Array]::Clear($roundtrip, 0, $roundtrip.Length)
        # Delete only this exact plaintext export inside the newly created backup directory.
        Remove-Item -LiteralPath $backupFile
    }
    $backupStage = 'WRITE_MANIFEST'
    $backupFailureCode = 'MANIFEST_WRITE_FAILED'
    [pscustomobject]@{
        projectRef = 'plczaqhgwdmgrausopmr'; finishedUtc = [DateTime]::UtcNow.ToString('o')
        exportComplete = $true; encryptionRoundtripVerified = $true; restoreTestPassed = $false
        singleSnapshot = $false; databaseChanged = $false; offDeviceBackup = $false; files = $backupRecords
    } | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath (Join-Path $backupDir 'manifest.json') -Encoding UTF8
    Write-Host ('백업 내보내기 완료: ' + $backupDir)
    Write-Host '암호화 무결성을 확인했습니다. 이 새 백업의 복원 시험은 별도로 실행해야 합니다.'
} catch {
    Write-Host '백업이 완료되지 않았습니다. 운영 DB는 변경하지 않았습니다.' -ForegroundColor Red
    Write-Host ('비민감 오류 코드: ' + $backupFailureCode)
    Write-Host ('진행 단계: ' + $backupStage)
    Write-Host '소유자 전용 백업 폴더에 일부 파일이 남아 있을 수 있습니다. 공유하지 마세요.'
} finally {
    if ($backupBstr -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($backupBstr) }
    if ($backupSecure) { $backupSecure.Dispose() }
    $backupPlain = $null
    $backupUrl = $null
    Read-Host '종료하려면 Enter를 누르세요' | Out-Null
}
