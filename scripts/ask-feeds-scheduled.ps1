# Run the Ask VCFO official-update watchers once, for the Windows scheduled task.
#
# Installed by `npm run ask:feeds:schedule` (scripts/ask-feeds-schedule.ps1); it runs
# every 30 minutes and at log-on, with no `npm run dev` and no Inngest server needed.
# It makes sure the local Postgres is up (starting Docker Desktop and the compose
# containers when they are not), then runs `npm run ask:feeds:once`, which polls every
# watcher and indexes what is new for a manager to review.
#
# A run that cannot reach the database is skipped, not retried: each watcher looks back
# 60 days and skips what is already saved, so the next run catches up on what was missed
# while the laptop was off or asleep.
#
# Output goes to .logs/ask-feeds.log (git-ignored), trimmed to the last 2000 lines.

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
Set-Location $root

$logDir = Join-Path $root '.logs'
New-Item -ItemType Directory -Force -Path $logDir | Out-Null
$log = Join-Path $logDir 'ask-feeds.log'

function Write-Log([string]$message) {
  "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $message" | Out-File -FilePath $log -Append -Encoding utf8
}

# The database host and port come from DATABASE_URL in .env.local (localhost:5432 when absent).
$dbHost = '127.0.0.1'
$dbPort = 5432
$envFile = Join-Path $root '.env.local'
if (Test-Path $envFile) {
  $line = Select-String -Path $envFile -Pattern '^\s*DATABASE_URL\s*=' | Select-Object -First 1
  if ($line -and $line.Line -match '@([^:/]+):(\d+)/') {
    $dbHost = $Matches[1]
    $dbPort = [int]$Matches[2]
  }
}
if ($dbHost -eq 'localhost') { $dbHost = '127.0.0.1' }

function Test-Database {
  $client = New-Object System.Net.Sockets.TcpClient
  try {
    $client.Connect($dbHost, $dbPort)
    return $true
  } catch {
    return $false
  } finally {
    $client.Close()
  }
}

function Wait-Until([scriptblock]$condition, [int]$seconds) {
  for ($i = 0; $i -lt $seconds; $i += 3) {
    if (& $condition) { return $true }
    Start-Sleep -Seconds 3
  }
  return (& $condition)
}

if (-not (Test-Database)) {
  cmd /c "docker info >nul 2>&1"
  if ($LASTEXITCODE -ne 0) {
    $dockerDesktop = Join-Path $env:ProgramFiles 'Docker\Docker\Docker Desktop.exe'
    if (Test-Path $dockerDesktop) {
      Write-Log 'Docker is not running; starting Docker Desktop.'
      Start-Process -FilePath $dockerDesktop | Out-Null
      $null = Wait-Until { cmd /c "docker info >nul 2>&1"; $LASTEXITCODE -eq 0 } 180
    }
  }
  cmd /c "docker compose up -d >nul 2>&1"
  $null = Wait-Until { Test-Database } 90
}

if (-not (Test-Database)) {
  Write-Log "Skipped: the database at ${dbHost}:${dbPort} is not reachable. The next run catches up (60-day window)."
  exit 0
}

Write-Log 'Checking the official portals.'
$output = cmd /c "npm run --silent ask:feeds:once 2>&1"
$code = $LASTEXITCODE
foreach ($line in $output) { Write-Log "  $line" }
Write-Log "Done (exit $code)."

# Keep the log small.
$lines = Get-Content -Path $log -Encoding utf8
if ($lines.Count -gt 2000) {
  $lines | Select-Object -Last 2000 | Set-Content -Path $log -Encoding utf8
}
exit $code
