$ErrorActionPreference='Stop'
$taskRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../output/english-application/qa'))
$taskWord=$null
$taskResults=@()
try {
 $taskWord=New-Object -ComObject Word.Application
 $taskWord.Visible=$false
 $taskWord.DisplayAlerts=0
 $taskWord.AutomationSecurity=3
 foreach($taskFile in (Get-ChildItem -LiteralPath $taskRoot -Filter '*.docx')) {
  $taskDocument=$null
  try {
   $taskDocument=$taskWord.Documents.Open($taskFile.FullName,$false,$true,$false)
   $taskDocument.Activate()
   $taskDocument.ActiveWindow.View.Type=3
   $taskDocument.Fields.Update() | Out-Null
   foreach($taskSection in $taskDocument.Sections){foreach($taskFooter in $taskSection.Footers){$taskFooter.Range.Fields.Update() | Out-Null}}
   $taskDocument.Repaginate()
   $taskPdf=[IO.Path]::ChangeExtension($taskFile.FullName,'.pdf')
   $taskPages=$taskDocument.ComputeStatistics(2)
   $taskDocument.ExportAsFixedFormat($taskPdf,17)
   $taskResults+=@{name=$taskFile.Name;pages=$taskPages;renderer='Microsoft Word'}
   Write-Output ($taskFile.Name+': '+$taskPages+' pages')
  } finally {if($taskDocument){$taskDocument.Close(0);[Runtime.InteropServices.Marshal]::FinalReleaseComObject($taskDocument)|Out-Null}}
 }
 $taskResults | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $taskRoot 'render-results.json') -Encoding utf8
} finally {if($taskWord){$taskWord.Quit(0);[Runtime.InteropServices.Marshal]::FinalReleaseComObject($taskWord)|Out-Null}}

