Param()
$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot\..\..\.."
$agents = Join-Path $root '.warp\agents'

Write-Host "[/agent-sync] Agents config summary:"
if (Test-Path -LiteralPath (Join-Path $agents 'agents.yml')) {
  Write-Host "- Agents:"
  (Get-Content -LiteralPath (Join-Path $agents 'agents.yml')) | Select-String -Pattern '^  [a-zA-Z0-9_-]+:' | ForEach-Object { $_.Line -replace '^\s+','  • ' } | Write-Host
} else { Write-Host "- Agents: none" }
if (Test-Path -LiteralPath (Join-Path $agents 'skills.yml')) {
  Write-Host "- Skills:"
  (Get-Content -LiteralPath (Join-Path $agents 'skills.yml')) | Select-String -Pattern '^  [a-zA-Z0-9_-]+:' | ForEach-Object { $_.Line -replace '^\s+','  • ' } | Write-Host
} else { Write-Host "- Skills: none" }
