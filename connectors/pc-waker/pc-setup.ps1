# Run once on the MAIN PC (the one with Vectorworks), in an admin PowerShell:
#   powershell -ExecutionPolicy Bypass -File .\pc-setup.ps1
# Lets the wired network card wake the PC, makes the PC sleep instead of staying on, and prints
# the two values the home server needs; it also lets the home network ping it. Nothing else. The BIOS part is by hand (README).
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

# 4. Let the home server see that the PC is awake: Windows refuses pings by default. Only from
#    this home network (LocalSubnet), only echo requests.
if (-not (Get-NetFirewallRule -DisplayName "PC waker: ping from home network" -ErrorAction SilentlyContinue)) {
  New-NetFirewallRule -DisplayName "PC waker: ping from home network" -Direction Inbound -Protocol ICMPv4 -IcmpType 8 -RemoteAddress LocalSubnet -Profile Any -Action Allow | Out-Null
}

$ip = (Get-NetIPConfiguration -InterfaceIndex $nic.ifIndex).IPv4Address | Where-Object { $_.IPAddress -notlike "169.254.*" } | Select-Object -First 1 -ExpandProperty IPAddress
if (-not $ip) { throw "The wired connection has no address on the home network. Is the cable plugged into the router?" }
Write-Host ""
Write-Host "Done on this PC. Give these two to setup.ps1 on the home server:"
Write-Host "  -Mac $($nic.MacAddress) -Ip $ip"
Write-Host ""
Write-Host "Also: reserve $ip for this PC in the Deco app so it never changes, and turn on"
Write-Host "Wake-on-LAN in the BIOS (README.md, step 1)."
