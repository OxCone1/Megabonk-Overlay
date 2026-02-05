# MegaBonk Tray - Installer
# Runs the tray NSIS installer which includes both the tray app and bundled relay server

$ErrorActionPreference = "Stop"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MegaBonk Tray Installer" -ForegroundColor Cyan  
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Get script directory
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# Find installer
$InstallerPath = Join-Path $ScriptDir "MegaBonkTray.exe"
if (-not (Test-Path $InstallerPath)) {
    Write-Host "ERROR: MegaBonkTray.exe installer not found in $ScriptDir" -ForegroundColor Red
    Write-Host "Please run this script from the dist folder containing MegaBonkTray.exe." -ForegroundColor Yellow
    Read-Host "Press Enter to exit"
    exit 1
}

# Stop any running instances
Write-Host "Stopping any running instances..." -ForegroundColor Yellow
Get-Process -Name "MegaBonkRelay","MegaBonkTray" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
try { & taskkill /IM MegaBonkTray.exe /F 2>$null } catch { }
try { & taskkill /IM MegaBonkRelay.exe /F 2>$null } catch { }
Start-Sleep -Seconds 1

# Run the NSIS installer
Write-Host "Running MegaBonk Tray installer..." -ForegroundColor Yellow
Start-Process -FilePath $InstallerPath -Wait

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "MegaBonk Tray has been installed with the bundled relay server." -ForegroundColor White
Write-Host ""
Write-Host "To uninstall, use:" -ForegroundColor White
Write-Host "  - Windows Settings > Apps > MegaBonk Tray" -ForegroundColor Gray
Write-Host "  - Or run: $env:LOCALAPPDATA\Programs\megabonk-tray\Uninstall MegaBonk Tray.exe" -ForegroundColor Gray
Write-Host ""

Read-Host "Press Enter to exit"
