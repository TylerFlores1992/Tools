# Run once on the MAIN PC (the one with Vectorworks), in an admin PowerShell:
#   powershell -ExecutionPolicy Bypass -File .\pc-setup.ps1
# Lets the wired network card wake the PC, makes the PC sleep instead of staying on, and prints
# the two values the home server needs. It changes nothing else. The BIOS part is by hand (README).
$ErrorActionPreference = "Stop"

$nic = Get-NetAdapter -Physical | Where-Object { $_.Status -eq "Up" -and $_.MediaType -eq "802.3" } | Select-Object -First 1
if (-not $nic) { throw "No wired network connection is up. Wake-on-LAN needs the PC on a cable." }

# 1. The network card may wake the PC, but only for a magic packet (not for any traffic).
Set-NetAdapterPowerManagement -Name $nic.Name -WakeOnMagicPacket Enabled -ErrorAction SilentlyContinue
foreach ($p in "Wake on Magic Packet", "Wake on magic packet", "Wake on Pattern Match", "Shutdown Wake-On-Lan", "Shutdown Wake Up") {
  $v = Get-NetAdapterAdvancedProperty -Name $nic.Name -DisplayName $p -ErrorAction SilentlyContinue
  if ($v) { Set-NetAdapterAdvancedProperty -Name $nic.Name -DisplayName $p -DisplayValue $(if ($p -like "*Pattern*") { "Disabled" } else { "Enabled" }) -ErrorAction SilentlyContinue }
}
powercfg /deviceenablewake "$($nic.InterfaceDescription)" 2>$null

# 2. Fast Startup stops most PCs waking from "Shut down"; turn it off.
Set-ItemProperty -Path "HKLM:\SYSTEM\CurrentControlSet\Control\Session Manager\Power" -Name HiberbootEnabled -Value 0 -Type DWord

# 3. Sleep after 30 idle minutes when plugged in (Vectorworks stays open; waking takes seconds).
powercfg /change standby-timeout-ac 30
powercfg /change hibernate-timeout-ac 0

$ip = (Get-NetIPAddress -InterfaceIndex $nic.ifIndex -AddressFamily IPv4 | Select-Object -First 1).IPAddress
Write-Host ""
Write-Host "Done on this PC. Give these two to setup.ps1 on the home server:"
Write-Host "  -Mac $($nic.MacAddress) -Ip $ip"
Write-Host ""
Write-Host "Also: reserve $ip for this PC in the Deco app so it never changes, and turn on"
Write-Host "Wake-on-LAN in the BIOS (README.md, step 1)."
