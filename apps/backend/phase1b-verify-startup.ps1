# Phase 1B: Backend Startup Verification Script (PowerShell)
# Captures first 40 lines of backend startup logs and verifies component initialization

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "PHASE 1B: BACKEND STARTUP VERIFICATION" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

Write-Host "Date: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')" -ForegroundColor Gray
Write-Host "Objective: Verify all Phase 1B components initialize at startup`n" -ForegroundColor Gray

# Check if backend is already running
Write-Host "STEP 1: Check if backend is already running" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────`n" -ForegroundColor Gray

$backendProcess = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*server*" }

if ($backendProcess) {
    Write-Host "⚠️  Backend appears to be running (PID: $($backendProcess.Id))" -ForegroundColor Yellow
    Write-Host "   To capture fresh startup logs, stop the backend first:`n" -ForegroundColor Yellow
    Write-Host "   1. Press Ctrl+C in the backend terminal" -ForegroundColor White
    Write-Host "   2. Or run: Stop-Process -Id $($backendProcess.Id)`n" -ForegroundColor White
    
    $response = Read-Host "Do you want to continue anyway? (y/n)"
    if ($response -ne "y") {
        Write-Host "`nExiting..." -ForegroundColor Gray
        exit 0
    }
}

Write-Host "`nSTEP 2: Start backend and capture startup logs" -ForegroundColor Yellow
Write-Host "─────────────────────────────────────────────────────────`n" -ForegroundColor Gray

Write-Host "Instructions:" -ForegroundColor White
Write-Host "1. Open a NEW terminal window" -ForegroundColor White
Write-Host "2. Navigate to: cd apps/backend" -ForegroundColor White
Write-Host "3. Run: npm run dev" -ForegroundColor White
Write-Host "4. Copy the FIRST 40 LINES of output" -ForegroundColor White
Write-Host "5. Return here and paste them`n" -ForegroundColor White

Write-Host "Waiting for startup logs..." -ForegroundColor Cyan
Write-Host "(Paste logs below and press Enter twice when done)`n" -ForegroundColor Gray

# Collect multi-line input
$logs = @()
$emptyLineCount = 0

while ($true) {
    $line = Read-Host
    
    if ([string]::IsNullOrWhiteSpace($line)) {
        $emptyLineCount++
        if ($emptyLineCount -ge 2) {
            break
        }
    } else {
        $emptyLineCount = 0
        $logs += $line
    }
}

if ($logs.Count -eq 0) {
    Write-Host "`n❌ No logs provided. Exiting.`n" -ForegroundColor Red
    exit 1
}

Write-Host "`n═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "ANALYZING STARTUP LOGS" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════`n" -ForegroundColor Cyan

# Component checklist
$components = @{
    "Redis Connection" = @{
        patterns = @("Redis connected", "Redis client connected")
        found = $false
    }
    "MongoDB Connection" = @{
        patterns = @("MongoDB connected", "Database connected")
        found = $false
    }
    "BullMQ Queue Initialization" = @{
        patterns = @("QueueManager initialized", "Queue initialized")
        found = $false
    }
    "Token Refresh Scheduler" = @{
        patterns = @("Token refresh scheduler started", "scheduler started")
        found = $false
    }
    "Token Refresh Worker" = @{
        patterns = @("Distributed token refresh worker started", "token refresh worker started")
        found = $false
    }
    "Worker Concurrency" = @{
        patterns = @("concurrency: 5", "concurrency=5")
        found = $false
    }
    "Publishing Worker" = @{
        patterns = @("Publishing worker started")
        found = $false
    }
    "Server Listening" = @{
        patterns = @("Server running on port", "listening on port")
        found = $false
    }
}

# Analyze logs
foreach ($log in $logs) {
    foreach ($componentName in $components.Keys) {
        $component = $components[$componentName]
        foreach ($pattern in $component.patterns) {
            if ($log -like "*$pattern*") {
                $component.found = $true
                break
            }
        }
    }
}

# Display results
Write-Host "Component Initialization Status:" -ForegroundColor White
Write-Host ""

$allPassed = $true
foreach ($componentName in $components.Keys) {
    $component = $components[$componentName]
    if ($component.found) {
        Write-Host "   ✅ $componentName" -ForegroundColor Green
    } else {
        Write-Host "   ❌ $componentName" -ForegroundColor Red
        $allPassed = $false
    }
}

Write-Host ""

# Summary
if ($allPassed) {
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Green
    Write-Host "✅ ALL COMPONENTS INITIALIZED SUCCESSFULLY" -ForegroundColor Green
    Write-Host "═══════════════════════════════════════════════════════════`n" -ForegroundColor Green
    
    Write-Host "Backend is ready for Phase 1B validation!`n" -ForegroundColor White
    
    Write-Host "Next Steps:" -ForegroundColor Yellow
    Write-Host "1. Run infrastructure audit: node phase1b-infrastructure-audit.js" -ForegroundColor White
    Write-Host "2. Verify Redis keys: redis-cli keys `"bull:*`"" -ForegroundColor White
    Write-Host "3. Proceed to validation tests`n" -ForegroundColor White
} else {
    Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Red
    Write-Host "❌ SOME COMPONENTS FAILED TO INITIALIZE" -ForegroundColor Red
    Write-Host "═══════════════════════════════════════════════════════════`n" -ForegroundColor Red
    
    Write-Host "Missing Components:" -ForegroundColor Yellow
    foreach ($componentName in $components.Keys) {
        $component = $components[$componentName]
        if (-not $component.found) {
            Write-Host "   - $componentName" -ForegroundColor Red
        }
    }
    
    Write-Host "`nTroubleshooting:" -ForegroundColor Yellow
    Write-Host "1. Check backend logs for errors" -ForegroundColor White
    Write-Host "2. Verify Redis is running: redis-cli ping" -ForegroundColor White
    Write-Host "3. Verify MongoDB is running" -ForegroundColor White
    Write-Host "4. Check .env file configuration`n" -ForegroundColor White
}

Write-Host "═══════════════════════════════════════════════════════════`n" -ForegroundColor Cyan
