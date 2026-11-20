param([ValidateSet('normal','long','missing','packet')][string[]]$Names=@('normal','long','missing'))
$ErrorActionPreference='Stop'
$taskRoot=[System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../../output/delivery-confirmation/qa'))
$taskResults=@()
$taskWord=$null
try {
 $taskWord=New-Object -ComObject Word.Application
 $taskWord.Visible=$false
 $taskWord.DisplayAlerts=0
 $taskWord.AutomationSecurity=3
 foreach($taskName in $Names){
  $taskInput=Join-Path $taskRoot ('delivery-'+$taskName+'.docx')
  $taskPdf=Join-Path $taskRoot ('delivery-'+$taskName+'.pdf')
  $taskDocument=$null
  try {
   $taskDocument=$taskWord.Documents.Open($taskInput,$false,$true,$false)
   $taskDocument.Activate()
   $taskDocument.ActiveWindow.View.Type=3
   $taskDocument.ActiveWindow.View.SeekView=0
   $taskDocument.Fields.Update() | Out-Null
   foreach($taskSection in $taskDocument.Sections){foreach($taskFooter in $taskSection.Footers){$taskFooter.Range.Fields.Update() | Out-Null}}
   $taskDocument.Repaginate()
   $taskPages=$taskDocument.ComputeStatistics(2)
   $taskDocument.ExportAsFixedFormat($taskPdf,17)
   $taskResults+=@{name=$taskName;pages=$taskPages;renderer='Microsoft Word';pdf=$taskPdf}
   Write-Output ($taskName+': '+$taskPages+' pages / top margin '+$taskDocument.PageSetup.TopMargin)
  } finally {if($taskDocument){$taskDocument.Close(0);[System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($taskDocument)|Out-Null}}
 }
 $taskResults | ConvertTo-Json -Depth 3 | Set-Content -LiteralPath (Join-Path $taskRoot 'word-render-results.json') -Encoding utf8
} finally {if($taskWord){$taskWord.Quit(0);[System.Runtime.InteropServices.Marshal]::FinalReleaseComObject($taskWord)|Out-Null}}
