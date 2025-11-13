Param([string]$Task = "Project status")
$ErrorActionPreference = 'Stop'
$root = Resolve-Path "$PSScriptRoot/../../.."
$runtime = Join-Path $root 'runtime'
$out = Join-Path $runtime 'plan.md'
New-Item -ItemType Directory -Force -Path $runtime | Out-Null
Write-Host "[/plan] Planning: $Task"
$content = @()
$content += "# Plan"
$content += "Task: $Task"
$content += "`n## Top-level directories"
(Get-ChildItem -Path $root -Depth 0 -Directory | Select-Object -ExpandProperty Name | Sort-Object) | ForEach-Object { $content += $_ }
$content += "`n## File count"
try { $count = git --no-pager ls-files | Measure-Object -Line | Select-Object -ExpandProperty Lines } catch { $count = 0 }
$content += "$count"
$content += "`n## Modules (README excerpt)"
try { $content += (Get-Content (Join-Path $root 'README.md'))[12..22] } catch { }
$content += "`n## Next steps (README excerpt)"
try { $content += (Get-Content (Join-Path $root 'README.md'))[38..42] } catch { }
$content | Set-Content -Path $out -Encoding UTF8
Write-Host "[/plan] wrote $out"
