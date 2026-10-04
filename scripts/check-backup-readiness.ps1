# Read-only preflight. No password input, database access, downloads or writes.
[CmdletBinding()]
param()

$ErrorActionPreference = 'Stop'
$cli = Get-Command supabase -ErrorAction SilentlyContinue
$localCli = Join-Path $PSScriptRoot '../.tools/supabase/2.119.0/bin/supabase.exe'
$localCliAvailable = Test-Path -LiteralPath $localCli -PathType Leaf
$docker = Get-Command docker -ErrorAction SilentlyContinue
$localDocker = Join-Path ([Environment]::GetFolderPath('LocalApplicationData')) 'Programs/DockerDesktop/resources/bin/docker.exe'
if (-not $docker -and (Test-Path -LiteralPath $localDocker -PathType Leaf)) {
    $docker = Get-Command $localDocker
}
$dump = Get-Command pg_dump -ErrorAction SilentlyContinue
$restore = Get-Command pg_restore -ErrorAction SilentlyContinue
$dockerReady = $false
if ($docker) {
    & $docker.Source info --format '{{.ServerVersion}}' *> $null
    $dockerReady = ($LASTEXITCODE -eq 0)
}

[pscustomobject]@{
    supabaseCliAvailable = ([bool]$cli -or $localCliAvailable)
    dockerClientAvailable = [bool]$docker
    dockerServerReady = $dockerReady
    officialCliToolchainReady = (([bool]$cli -or $localCliAvailable) -and $dockerReady)
    postgresDumpAvailable = [bool]$dump
    postgresRestoreAvailable = [bool]$restore
    credentialsChecked = $false
    backupCreated = $false
    restoreTestPassed = $false
    databaseChanged = $false
} | ConvertTo-Json
