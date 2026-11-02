# Page Turner setup for the Windows home server. Run once from this folder:
#   powershell -ExecutionPolicy Bypass -File .\setup.ps1
$ErrorActionPreference = "Stop"
Set-Location $PSScriptRoot
npm install --omit=dev
if (-not (Test-Path .env)) {
  $rng = [Security.Cryptography.RandomNumberGenerator]::Create()
  function New-Hex($n) { $b = New-Object byte[] $n; $rng.GetBytes($b); -join ($b | ForEach-Object { $_.ToString("x2") }) }
  "COURSE_TOKEN=$(New-Hex 32)`nNTFY_TOPIC=pageturner-$(New-Hex 12)`nCOURSE_PORT=8095" | Set-Content -Encoding ascii .env
}
tailscale funnel --bg --set-path /course http://127.0.0.1:8095
Write-Host ""
Write-Host "Done. Your two private values are in the .env file in this folder."
Write-Host "Vercel needs COURSE_TOKEN. The ntfy app needs NTFY_TOPIC. See README.md."
