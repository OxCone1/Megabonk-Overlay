# Build script for MegaBonk WS Relay Server
# Creates a standalone .exe that runs without Node.js installed

Write-Host "=== MegaBonk WS Relay Server Build ===" -ForegroundColor Cyan

# Check if npm is available
if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
    Write-Host "ERROR: npm is not installed. Please install Node.js to build." -ForegroundColor Red
    Write-Host "Download from: https://nodejs.org/" -ForegroundColor Yellow
    exit 1
}

# Install dependencies
Write-Host "`nInstalling dependencies..." -ForegroundColor Yellow
npm install

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install dependencies" -ForegroundColor Red
    exit 1
}

# Create dist folder
if (-not (Test-Path "dist")) {
    New-Item -ItemType Directory -Path "dist" | Out-Null
}

# Build with pkg
Write-Host "`nBuilding executable..." -ForegroundColor Yellow
npx pkg . --targets node18-win-x64 --output dist/MegaBonkRelay.exe

if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Build failed" -ForegroundColor Red
    exit 1
}

# Copy launcher and scripts to dist
Write-Host "`nCopying installation files..." -ForegroundColor Yellow
Copy-Item "install.ps1" "dist/" -Force  
Copy-Item "uninstall.ps1" "dist/" -Force

# Build overlay before tray app
Write-Host "`nBuilding overlay..." -ForegroundColor Yellow
Push-Location "../obs-megabonk-overlay"
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to install overlay dependencies" -ForegroundColor Red
    Pop-Location
    exit 1
}
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "ERROR: Failed to build overlay" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location

# Build tray app directly from source (optional)
if (Test-Path "tray") {
    Write-Host "`nPackaging tray app with electron-builder from tray/..." -ForegroundColor Yellow

    # Verify relay exe exists before packaging (it will be bundled as extraResource)
    if (-not (Test-Path "dist/MegaBonkRelay.exe")) {
        Write-Host "ERROR: dist/MegaBonkRelay.exe not found; cannot bundle with tray." -ForegroundColor Red
        exit 1
    }

    Push-Location "tray"
    npm install
    if ($LASTEXITCODE -ne 0) {
        Write-Host "WARNING: Failed to install tray dependencies; skipping tray packaging." -ForegroundColor Yellow
        Pop-Location
    } else {
        npx electron-builder --win --x64 --publish never --config.directories.output=../dist
        if ($LASTEXITCODE -ne 0) {
            Write-Host "WARNING: electron-builder failed; skipping tray packaging." -ForegroundColor Yellow
            Pop-Location
        } else {
            Write-Host "Tray pack complete; artifact should be in dist/ as MegaBonkTray.exe" -ForegroundColor Green
            Pop-Location
        }
    }
}

Write-Host "`n=== Build Complete ===" -ForegroundColor Green
Write-Host "Output: dist/MegaBonkRelay.exe" -ForegroundColor White
Write-Host "`nTo install, run: dist/install.ps1" -ForegroundColor Cyan
