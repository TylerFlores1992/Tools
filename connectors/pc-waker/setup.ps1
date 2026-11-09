# PC waker setup for the Windows HOME SERVER. Run once from this folder, in an admin PowerShell:
#   powershell -ExecutionPolicy Bypass -File .\setup.ps1 -Mac AA-BB-CC-DD-EE-FF -Ip 192.168.68.50
# (pc-setup.ps1, run on the main PC first, prints both values.)
param(
  [Parameter(Mandatory = $true)][string]$Mac,
  [Parameter(Mandatory = $true)][string]$Ip,
  [string]$Name = "Main PC",
  [int]$Port = 7381
)
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot

$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { throw "Node.js isn't installed on this server. Install Node 22+ and run this again." }

# Where the PC's network is: the subnet broadcast reaches it even if 255.255.255.255 is filtered.
$parts = $Ip.Split(".")
$broadcast = "$($parts[0]).$($parts[1]).$($parts[2]).255"
@{ mac = $Mac; ip = $Ip; name = $Name; port = $Port; broadcast = $broadcast } | ConvertTo-Json | Set-Content -Encoding ascii pc-waker.json

if (-not (Test-Path pc-waker.token)) {
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  $b = New-Object byte[] 32; $rng.GetBytes($b)
  (-join ($b | ForEach-Object { $_.ToString("x2") })) | Set-Content -Encoding ascii -NoNewline pc-waker.token
}

# Start at boot, before anyone signs in, and come back if it stops.
$action = New-ScheduledTaskAction -Execute $node -Argument "`"$PSScriptRoot\waker.mjs`"" -WorkingDirectory $PSScriptRoot
$trigger = New-ScheduledTaskTrigger -AtStartup
$settings = New-ScheduledTaskSettingsSet -RestartCount 999 -RestartInterval (New-TimeSpan -Minutes 1) -ExecutionTimeLimit ([TimeSpan]::Zero) -AllowStartIfOnBatteries
Register-ScheduledTask -TaskName "pc-waker" -Action $action -Trigger $trigger -Settings $settings -User "SYSTEM" -RunLevel Highest -Force | Out-Null
Stop-ScheduledTask -TaskName "pc-waker" -ErrorAction SilentlyContinue
Start-ScheduledTask -TaskName "pc-waker"

tailscale funnel --bg --set-path /pc "http://127.0.0.1:$Port"

Start-Sleep -Seconds 2
$key = Get-Content pc-waker.token
try {
  $s = Invoke-RestMethod -Uri "http://127.0.0.1:$Port/status" -Headers @{ Authorization = "Bearer $key" }
  Write-Host ("The waker is running. The PC is " + $(if ($s.awake) { "on (it answered)." } else { "not answering (asleep or off)." }))
} catch { Write-Host "The waker didn't answer yet: $_" }
Write-Host ""
Write-Host "Last step, in Vercel (project tylerflores-dev, Production), then redeploy:"
Write-Host "  PC_WAKER_URL   = https://<this server>.ts.net/pc   (same name as DVR_URL, with /pc)"
Write-Host "  PC_WAKER_TOKEN = the text in pc-waker.token in this folder (mark it Sensitive)"
