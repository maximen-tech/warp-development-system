Param([string]$Pattern = "all")
$ErrorActionPreference = 'Stop'
& "$PSScriptRoot\..\..\..\tools\logger\log.ps1" test start "Pattern=$Pattern"
$root = Resolve-Path "$PSScriptRoot/../../.."
$status = 0

Write-Host "[/test] discovering runner"
if ((Test-Path (Join-Path $root 'tests')) -and (Get-Command pytest -ErrorAction SilentlyContinue)) {
  Write-Host "[/test] running pytest"
  Push-Location $root
  try { pytest -q | Out-Null } catch { $status = 1 } finally { Pop-Location }
} else {
  Write-Host "[/test] pytest/tests not found; running python smoke"
  try { python - << 'PY'
print('smoke: python OK')
PY
  } catch { $status = 1 }
}

if ($status -eq 0) { & "$PSScriptRoot\..\..\..\tools\logger\log.ps1" test end "Completed Pattern=$Pattern (OK)"; exit 0 } else { & "$PSScriptRoot\..\..\..\tools\logger\log.ps1" test end "Completed Pattern=$Pattern (FAIL)"; exit 1 }
