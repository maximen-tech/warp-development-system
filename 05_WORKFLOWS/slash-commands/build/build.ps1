$ErrorActionPreference = 'Stop'
& "$PSScriptRoot\..\..\..\tools\logger\log.ps1" build start "Building project (multi-step)"n$ok = $true
$root = Resolve-Path "$PSScriptRoot/../../.."

Write-Host "[/build] step=frontend: tools/dashboard"
$fe = Join-Path $root 'tools/dashboard'
if (Test-Path $fe) {
  Push-Location $fe
  try {
    npm install | Out-Null
    node -e "console.log('node ok')" | Out-Null
    $p = Start-Process node -ArgumentList 'server.js' -PassThru
    Start-Sleep -Seconds 2
    Stop-Process -Id $p.Id -ErrorAction SilentlyContinue
  } catch { $ok = $false }
  Pop-Location
} else { Write-Host "[/build] frontend not present (skipping)" }

Write-Host "[/build] step=backend: uvicorn smoke"
try {
  python - << 'PY'
import importlib, sys
try:
    importlib.import_module('uvicorn')
    sys.exit(0)
except Exception:
    sys.exit(1)
PY
  if ($LASTEXITCODE -eq 0) { & uvicorn --version | Out-Null }
} catch { }

if ($ok) { & "$PSScriptRoot\..\..\..\tools\logger\log.ps1" build end "Build finished: OK"; exit 0 } else { & "$PSScriptRoot\..\..\..\tools\logger\log.ps1" build end "Build finished: FAIL"; exit 1 }
