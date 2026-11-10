# Run once on the MAIN PC (the one with Vectorworks), in an admin PowerShell, signed in as yourself:
#   powershell -ExecutionPolicy Bypass -File .\rdp-setup.ps1
#
# Why: when a Remote Desktop session disconnects (you close Remote Desktop on the phone), Windows
# parks your session with no screen at all. Programs keep running, but no window can be found or
# pressed, so the Vectorworks connector can't run jobs ("No Vectorworks window found"; measured
# 2026-11-10). The lock screen is fine: the connector works locked.
#
# What it does: two scheduled tasks, nothing else.
#   1. "Remote Desktop: back to the PC screen" - when YOUR Remote Desktop session disconnects,
#      Windows (as SYSTEM, the only account allowed to) hands the session back to the PC's own
#      screen with tscon.
#   2. "Remote Desktop: lock after returning" - right after that, the PC locks itself, so nobody
#      at the desk gets in without your password.
# Undo: Unregister-ScheduledTask "Remote Desktop: back to the PC screen","Remote Desktop: lock after returning"
$ErrorActionPreference = "Stop"

$me = [System.Security.Principal.WindowsIdentity]::GetCurrent().Name   # DOMAIN\user
$dir = Join-Path $env:ProgramData "pc-waker"
New-Item -ItemType Directory -Force -Path $dir | Out-Null

# The helper SYSTEM runs: find this user's session and connect it to the console.
$helper = Join-Path $dir "rdp-to-console.ps1"
@"
`$s = Get-Process explorer -IncludeUserName -ErrorAction SilentlyContinue | Where-Object { `$_.UserName -eq '$me' } | Select-Object -First 1
if (`$s) { & "`$env:SystemRoot\System32\tscon.exe" `$s.SessionId /dest:console }
"@ | Set-Content -Path $helper -Encoding UTF8

$cls = Get-CimClass -Namespace Root/Microsoft/Windows/TaskScheduler -ClassName MSFT_TaskSessionStateChangeTrigger
function SessionTrigger([int]$change, [string]$delay) {
  $t = New-CimInstance -CimClass $cls -ClientOnly
  $t.StateChange = $change   # 1 console connect, 4 remote disconnect
  $t.UserId = $me
  $t.Enabled = $true
  if ($delay) { $t.Delay = $delay }
  return $t
}
$settings = New-ScheduledTaskSettingsSet -AllowStartIfOnBatteries -DontStopIfGoingOnBatteries -ExecutionTimeLimit (New-TimeSpan -Minutes 2)

# 1. Remote Desktop disconnects -> back to the PC's own screen (SYSTEM: tscon needs it).
Register-ScheduledTask -TaskName "Remote Desktop: back to the PC screen" -Force `
  -Trigger (SessionTrigger 4 "PT2S") `
  -Action (New-ScheduledTaskAction -Execute "powershell.exe" -Argument "-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File `"$helper`"") `
  -Principal (New-ScheduledTaskPrincipal -UserId "SYSTEM" -LogonType ServiceAccount -RunLevel Highest) `
  -Settings $settings | Out-Null

# 2. Back on the PC's screen -> lock it (runs as you: only your own session can lock itself).
Register-ScheduledTask -TaskName "Remote Desktop: lock after returning" -Force `
  -Trigger (SessionTrigger 1 "PT3S") `
  -Action (New-ScheduledTaskAction -Execute "rundll32.exe" -Argument "user32.dll,LockWorkStation") `
  -Principal (New-ScheduledTaskPrincipal -UserId $me -LogonType Interactive) `
  -Settings $settings | Out-Null

Write-Host ""
Write-Host "Done. Next time you close Remote Desktop, the PC goes back to its own screen and locks itself;"
Write-Host "the Vectorworks connector keeps working. Check: Task Scheduler > 'Remote Desktop: ...' (two tasks)."
