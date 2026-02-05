# MegaBonk WS Relay Server - Uninstaller
# Removes the relay server and startup entry

$ErrorActionPreference = "Stop"

$InstallDir = "$env:LOCALAPPDATA\MegaBonkRelay"
$StartupPath = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Startup\MegaBonk WS Relay.lnk"
$TrayShortcut = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\MegaBonk Tray.lnk"
$TrayStartMenuDir = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\MegaBonk Tray"
$TrayDataRoaming = "$env:APPDATA\MegaBonk Tray"
$TrayDataLocal = "$env:LOCALAPPDATA\MegaBonk Tray"
$TrayInstallDir = "$env:LOCALAPPDATA\Programs\MegaBonk Tray"

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  MegaBonk WS Relay Server Uninstaller" -ForegroundColor Cyan  
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Confirm
$confirm = Read-Host "This will remove MegaBonk WS Relay Server. Continue? (y/N)"
if ($confirm -ne "y" -and $confirm -ne "Y") {
    Write-Host "Cancelled." -ForegroundColor Yellow
    exit 0
}

Write-Host ""
Write-Host "Uninstalling..." -ForegroundColor Yellow

# Stop any running instance
Write-Host "Stopping relay server..." -ForegroundColor Gray
Get-Process -Name "MegaBonkRelay" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Write-Host "Stopping tray app..." -ForegroundColor Gray
Get-Process -Name "MegaBonkTray" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
# Fallback kill by image name (if still running)
try { & taskkill /IM MegaBonkTray.exe /F | Out-Null } catch { }
Start-Sleep -Seconds 1

# Remove startup shortcut
if (Test-Path $StartupPath) {
    Remove-Item $StartupPath -Force
    Write-Host "Removed startup shortcut" -ForegroundColor Green
} else {
    Write-Host "No startup shortcut found" -ForegroundColor Gray
}

# Remove tray shortcuts
if (Test-Path $TrayShortcut) {
    Remove-Item $TrayShortcut -Force
    Write-Host "Removed tray Start Menu shortcut" -ForegroundColor Green
}
if (Test-Path $TrayStartMenuDir) {
    Remove-Item $TrayStartMenuDir -Recurse -Force
    Write-Host "Removed tray Start Menu folder" -ForegroundColor Green
}

# Run tray uninstaller (registry uninstall string takes precedence)
function Invoke-TrayUninstallFromRegistry {
    $paths = @(
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )
    foreach ($path in $paths) {
        $items = Get-ItemProperty $path -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq "MegaBonk Tray" }
        foreach ($item in $items) {
            $cmd = $item.UninstallString
            if (-not $cmd) { continue }
            Write-Host "Running tray uninstaller from registry..." -ForegroundColor Gray
            try {
                if ($cmd.StartsWith('"')) {
                    $parts = $cmd -split '"'
                    $exe = $parts[1]
                    $args = $cmd.Substring($exe.Length + 2).Trim()
                    if ($args -notmatch '/S') { $args = ($args + ' /S').Trim() }
                    Start-Process -FilePath $exe -ArgumentList $args -Wait
                } else {
                    if ($cmd -notmatch '/S') { $cmd = $cmd + ' /S' }
                    Start-Process -FilePath "cmd.exe" -ArgumentList "/c", $cmd -Wait
                }
                Write-Host "Tray uninstaller completed" -ForegroundColor Green
                return $true
            } catch {
                Write-Host "Tray uninstaller failed: $($_.Exception.Message)" -ForegroundColor Yellow
            }
        }
    }
    return $false
}

$ranRegistryUninstall = Invoke-TrayUninstallFromRegistry
if (-not $ranRegistryUninstall -and (Test-Path $TrayInstallDir)) {
    $explicitUninstaller = Join-Path $TrayInstallDir "Uninstall MegaBonk Tray.exe"
    $trayUninstaller = $null
    if (Test-Path $explicitUninstaller) {
        $trayUninstaller = Get-Item $explicitUninstaller -ErrorAction SilentlyContinue
    } else {
        $trayUninstaller = Get-ChildItem -Path $TrayInstallDir -Filter "Uninstall*.exe" -ErrorAction SilentlyContinue | Select-Object -First 1
    }
    if ($trayUninstaller) {
        Write-Host "Running tray uninstaller..." -ForegroundColor Gray
        try {
            Start-Process -FilePath $trayUninstaller.FullName -ArgumentList "/S" -Wait
            Write-Host "Tray uninstaller completed" -ForegroundColor Green
        } catch {
            Write-Host "Tray uninstaller failed: $($_.Exception.Message)" -ForegroundColor Yellow
        }
    }
}

# Remove tray app data
if (Test-Path $TrayDataRoaming) {
    Remove-Item $TrayDataRoaming -Recurse -Force
    Write-Host "Removed MegaBonk Tray app data (roaming)" -ForegroundColor Green
}
if (Test-Path $TrayDataLocal) {
    Remove-Item $TrayDataLocal -Recurse -Force
    Write-Host "Removed MegaBonk Tray app data (local)" -ForegroundColor Green
}

# Remove install directory
if (Test-Path $InstallDir) {
    try {
        Remove-Item $InstallDir -Recurse -Force
        Write-Host "Removed installation files" -ForegroundColor Green
    } catch {
        Write-Host "Could not remove all files. You may need to delete manually:" -ForegroundColor Yellow
        Write-Host "  $InstallDir" -ForegroundColor Gray
    }
} else {
    Write-Host "No installation directory found" -ForegroundColor Gray
}

# Remove tray install directory if still present
if (Test-Path $TrayInstallDir) {
    try {
        Remove-Item $TrayInstallDir -Recurse -Force
        Write-Host "Removed tray installation folder" -ForegroundColor Green
    } catch {
        Write-Host "Could not remove tray installation folder. You may need to delete manually:" -ForegroundColor Yellow
        Write-Host "  $TrayInstallDir" -ForegroundColor Gray
    }
}

# Remove tray uninstall registry entries (Programs & Features)
try {
    $uninstallPaths = @(
        "HKCU:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\Software\Microsoft\Windows\CurrentVersion\Uninstall\*",
        "HKLM:\Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\*"
    )
    foreach ($path in $uninstallPaths) {
        $uninstallKeys = Get-ItemProperty $path -ErrorAction SilentlyContinue | Where-Object { $_.DisplayName -eq "MegaBonk Tray" }
        foreach ($key in $uninstallKeys) {
            if ($key.PSPath) {
                Remove-Item -Path $key.PSPath -Force -ErrorAction SilentlyContinue
                Write-Host "Removed tray uninstall registry entry" -ForegroundColor Green
            }
        }
    }
} catch {
    Write-Host "Could not remove tray uninstall registry entry" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Uninstall Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""

Read-Host "Press Enter to exit"
