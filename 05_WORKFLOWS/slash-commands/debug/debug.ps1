Param([string]$Service = "app")
$ErrorActionPreference = 'Stop'
Write-Host "[/debug] Collecting logs for $Service..."
# TODO: Add log tail, filters, health probes
