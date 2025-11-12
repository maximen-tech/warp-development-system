Param()
$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot\..\..\.."
$cfg = Join-Path $root 'project.config.yml'

Write-Host "[/init] Agent-led initialization..."
$type = Read-Host "Project type [web/api/cli] (web)"; if (-not $type) { $type = 'web' }
$pkg = Read-Host "Package manager [npm/pnpm/yarn] (npm)"; if (-not $pkg) { $pkg = 'npm' }
$build = Read-Host "Build command (default: $pkg run build)"; if (-not $build) { $build = "$pkg run build" }
$test = Read-Host "Test command (default: $pkg test)"; if (-not $test) { $test = "$pkg test" }
$target = Read-Host "Deploy target [none/staging/prod] (staging)"; if (-not $target) { $target = 'staging' }

@"
project:
  type: $type
  package_manager: $pkg
commands:
  build: "$build"
  test: "$test"
deploy:
  target: $target
"@ | Set-Content -LiteralPath $cfg -NoNewline

Write-Host "[/init] Wrote $cfg"
