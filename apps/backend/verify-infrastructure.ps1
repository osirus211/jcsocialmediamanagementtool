# Server Infrastructure Verification Script (PowerShell)
# Task 3.1 STEP 1 — Server Infrastructure Verification
#
# This script runs the comprehensive infrastructure verification
# for the email-password-login-security-fix spec.

Write-Host "🔍 Starting Server Infrastructure Verification..." -ForegroundColor Cyan
Write-Host "==================================================" -ForegroundColor Cyan

# Check if we're in the right directory
if (-not (Test-Path "package.json")) {
    Write-Host "❌ Error: Must be run from the backend directory (apps/backend)" -ForegroundColor Red
    exit 1
}

# Check if tsx is available
try {
    tsx --version | Out-Null
} catch {
    Write-Host "📦 Installing tsx globally..." -ForegroundColor Yellow
    npm install -g tsx
}

# Load environment variables if .env exists
if (Test-Path ".env") {
    Write-Host "📋 Loading environment variables from .env" -ForegroundColor Green
    Get-Content ".env" | ForEach-Object {
        if ($_ -match "^([^#][^=]+)=(.*)$") {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2], "Process")
        }
    }
}

# Run the verification script
Write-Host "🚀 Running infrastructure verification..." -ForegroundColor Green
tsx src/scripts/server-infrastructure-verification.ts

if ($LASTEXITCODE -eq 0) {
    Write-Host "✅ Infrastructure verification completed successfully!" -ForegroundColor Green
} else {
    Write-Host "❌ Infrastructure verification failed!" -ForegroundColor Red
    exit $LASTEXITCODE
}