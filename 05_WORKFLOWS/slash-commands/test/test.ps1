Param([string]$Pattern = "all")
$ErrorActionPreference = 'Stop'
& "$PSScriptRoot\..\..\..\tools\logger\log.ps1" test start "Pattern=$Pattern"
Write-Host "[/test] Running tests: $Pattern"
# TODO: Wire to your test runner
& "$PSScriptRoot\..\..\..\tools\logger\log.ps1" test end "Completed Pattern=$Pattern"
