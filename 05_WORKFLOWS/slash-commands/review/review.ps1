$ErrorActionPreference = 'Stop'
& "$PSScriptRoot\..\..\..\tools\logger\log.ps1" review start "Static checks and diff summary"
Write-Host "[/review] Running static checks and preparing diff summary..."
# TODO: call linters and summarize git diff
& "$PSScriptRoot\..\..\..\tools\logger\log.ps1" review end "Review completed"
