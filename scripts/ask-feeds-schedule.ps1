# Install, remove or inspect the Windows scheduled task that runs the Ask VCFO
# official-update watchers on this laptop without `npm run dev` or Inngest.
#
#   npm run ask:feeds:schedule              install (or update) the task
#   npm run ask:feeds:schedule -- status    last run, next run, last log lines
#   npm run ask:feeds:schedule -- run       run it now
#   npm run ask:feeds:schedule -- remove    remove the task
#
# The task runs scripts/ask-feeds-scheduled.ps1 every 30 minutes and at log-on, as the
# signed-in user (no stored password, no admin rights). A run missed while the laptop
# was off or asleep starts as soon as it is back (StartWhenAvailable). It cannot run
# while the laptop is off; only the deployed app (App Runner with Inngest keys) watches
# around the clock.

param(
  [ValidateSet('install', 'status', 'run', 'remove')]
  [string]$Command = 'install'
)

$ErrorActionPreference = 'Stop'
$taskName = 'VCFO official updates (every 30 min)'
$root = Split-Path -Parent $PSScriptRoot
$runner = Join-Path $PSScriptRoot 'ask-feeds-scheduled.ps1'
$log = Join-Path $root '.logs\ask-feeds.log'

function Get-Task {
  Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue
}

switch ($Command) {
  'install' {
    $action = New-ScheduledTaskAction -Execute 'powershell.exe' `
      -Argument "-NoProfile -NonInteractive -ExecutionPolicy Bypass -WindowStyle Hidden -File `"$runner`"" `
      -WorkingDirectory $root
    $every30 = New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(1) -RepetitionInterval (New-TimeSpan -Minutes 30)
    $atLogOn = New-ScheduledTaskTrigger -AtLogOn -User "$env:USERDOMAIN\$env:USERNAME"
    $settings = New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew `
      -ExecutionTimeLimit (New-TimeSpan -Minutes 25) -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries
    $principal = New-ScheduledTaskPrincipal -UserId "$env:USERDOMAIN\$env:USERNAME" -LogonType Interactive -RunLevel Limited
    $description = 'Runs the VCFO Suite official-update watchers (GST, Income Tax, MCA, RBI, EPFO, ESIC, DGFT, Telangana) ' +
      "and saves new items for manager review. Installed by scripts/ask-feeds-schedule.ps1 in $root."
    try {
      Register-ScheduledTask -TaskName $taskName -Action $action -Trigger @($every30, $atLogOn) `
        -Settings $settings -Principal $principal -Description $description -Force | Out-Null
    } catch {
      # Some Windows setups refuse a log-on trigger without admin rights; the 30-minute
      # trigger with StartWhenAvailable still catches up after a restart.
      Register-ScheduledTask -TaskName $taskName -Action $action -Trigger $every30 `
        -Settings $settings -Principal $principal -Description $description -Force | Out-Null
      Write-Host 'Note: the log-on trigger needs admin rights here; installed with the 30-minute trigger only.'
    }
    Write-Host "Installed '$taskName'. First run in about a minute; log: $log"
  }
  'status' {
    $task = Get-Task
    if (-not $task) { Write-Host 'Not installed. Run: npm run ask:feeds:schedule'; break }
    $info = $task | Get-ScheduledTaskInfo
    Write-Host "Task:      $taskName ($($task.State))"
    Write-Host "Last run:  $($info.LastRunTime)  (result $($info.LastTaskResult))"
    Write-Host "Next run:  $($info.NextRunTime)"
    if (Test-Path $log) {
      Write-Host '--- last log lines ---'
      Get-Content -Path $log -Tail 15 -Encoding utf8
    }
  }
  'run' {
    if (-not (Get-Task)) { Write-Host 'Not installed. Run: npm run ask:feeds:schedule'; break }
    Start-ScheduledTask -TaskName $taskName
    Write-Host "Started. Watch the log: $log"
  }
  'remove' {
    if (Get-Task) {
      Unregister-ScheduledTask -TaskName $taskName -Confirm:$false
      Write-Host "Removed '$taskName'."
    } else {
      Write-Host 'Not installed.'
    }
  }
}
