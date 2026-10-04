$ErrorActionPreference = 'Stop'
$tokens = $null
$errors = $null
$ast = [Management.Automation.Language.Parser]::ParseFile((Join-Path $PSScriptRoot 'run-manual-backup.ps1'), [ref]$tokens, [ref]$errors)
if ($errors.Count) { throw 'Backup script syntax errors.' }
$function = $ast.Find({ param($node) $node -is [Management.Automation.Language.FunctionDefinitionAst] -and $node.Name -eq 'Get-BackupFailureCode' }, $true)
Invoke-Expression $function.Extent.Text
$cases = @{
    'password authentication failed for user PRIVATE-TEST' = 'DATABASE_AUTH_FAILED'
    'server version mismatch: aborting because of server version' = 'POSTGRES_VERSION_MISMATCH'
    'error getting credentials: docker-credential-desktop missing' = 'DOCKER_CREDENTIAL_HELPER_FAILED'
    'failed to connect to the docker API' = 'DOCKER_ENGINE_UNAVAILABLE'
    'TLS certificate invalid' = 'TLS_CONNECTION_FAILED'
    'permission denied PRIVATE-TEST' = 'ACCESS_DENIED'
    'manifest unknown PRIVATE-TEST' = 'CONTAINER_IMAGE_PULL_FAILED'
    'connection refused PRIVATE-TEST' = 'NETWORK_CONNECTION_FAILED'
    'PRIVATE-TEST-unrecognized-output' = 'EXPORT_FAILED_UNCLASSIFIED'
}
foreach ($case in $cases.GetEnumerator()) {
    if ((Get-BackupFailureCode $case.Key) -ne $case.Value) { throw 'Diagnostic classification failed.' }
}
Write-Output ('Backup diagnostics passed: ' + $cases.Count + ' cases; no raw output returned.')
