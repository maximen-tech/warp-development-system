Param()
$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot\..\..\.."
Write-Host "[/rules] Showing rules...`n"
Get-Content -Raw -LiteralPath "$root\.warp\WARP.md" | Write-Host
Write-Host "`n---`nAgent config:`n"
Get-Content -Raw -LiteralPath "$root\.warp\agent-config.yml" | Write-Host
