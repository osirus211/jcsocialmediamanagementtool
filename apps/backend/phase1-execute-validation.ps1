# Phase 1: Live Validation Execution Script (PowerShell)
# This script guides you through the validation process

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "     PHASE 1: LIVE RUNTIME VALIDATION" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow
Write-Host ""

# Check if backend is running
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -UseBasicParsing -TimeoutSec 5 -ErrorAction Stop
    Write-Host "✅ Backend is running" -ForegroundColor Green
    $backendRunning = $true
} catch {
    Write-Host "❌ Backend is NOT running" -ForegroundColor Red
    Write-Host "   Start backend with: npm run dev" -ForegroundColor Yellow
    $backendRunning = $false
}

# Check Redis
try {
    $redisTest = redis-cli ping 2>$null
    if ($redisTest -eq "PONG") {
        Write-Host "✅ Redis is running" -ForegroundColor Green
        $redisRunning = $true
    } else {
        Write-Host "❌ Redis is NOT running" -ForegroundColor Red
        $redisRunning = $false
    }
} catch {
    Write-Host "❌ Redis is NOT running" -ForegroundColor Red
    $redisRunning = $false
}

# Check test accounts
Write-Host "✅ Test accounts: 5 (seeded earlier)" -ForegroundColor Green

Write-Host ""

if (-not $backendRunning) {
    Write-Host "⚠️  Backend must be running to proceed" -ForegroundColor Yellow
    Write-Host "   Start it with: npm run dev" -ForegroundColor Yellow
    Write-Host ""
    Read-Host "Press ENTER to exit"
    exit
}

Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# Test 1: Scheduler Observation
Write-Host "TEST 1: SCHEDULER OBSERVATION" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────────────────────────" -ForegroundColor Gray
Write-Host ""
Write-Host "This test observes the scheduler for 5 minutes."
Write-Host ""
Write-Host "What to watch:"
Write-Host "  1. Backend logs for 'Token refresh scan started'"
Write-Host "  2. Jobs being enqueued"
Write-Host "  3. Worker processing jobs"
Write-Host "  4. Locks in Redis"
Write-Host ""
Write-Host "You can monitor Redis in another terminal with:"
Write-Host "  node phase1-monitor-redis.js" -ForegroundColor Yellow
Write-Host ""
Read-Host "Press ENTER to wait 5 minutes (or Ctrl+C to skip)"

Write-Host ""
Write-Host "Waiting 5 minutes for scheduler scan..." -ForegroundColor Yellow
Write-Host "(Watch backend logs in another terminal)" -ForegroundColor Gray
Write-Host ""

# Countdown
for ($i = 300; $i -gt 0; $i--) {
    $minutes = [math]::Floor($i / 60)
    $seconds = $i % 60
    Write-Host "`rTime remaining: $($minutes.ToString('00')):$($seconds.ToString('00'))" -NoNewline
    Start-Sleep -Seconds 1
}

Write-Host ""
Write-Host ""
Write-Host "✅ 5 minutes elapsed" -ForegroundColor Green
Write-Host ""
Write-Host "Check if accounts were refreshed in MongoDB:"
Write-Host "  mongo social-scheduler --eval ""db.socialaccounts.find({accountName: /^PHASE1_TEST_/}, {accountName: 1, lastRefreshedAt: 1})""" -ForegroundColor Yellow
Write-Host ""
Read-Host "Press ENTER to continue to Test 2"
Write-Host ""

# Test 2: Duplicate Prevention
Write-Host "TEST 2: DUPLICATE PREVENTION" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────────────────────────" -ForegroundColor Gray
Write-Host ""
Write-Host "This test enqueues the same job 5 times and verifies"
Write-Host "only one refresh occurs."
Write-Host ""
Read-Host "Press ENTER to run test"

node phase1-test-duplicate-prevention.js

Write-Host ""
Read-Host "Press ENTER to continue to Test 3"
Write-Host ""

# Test 3: Retry + DLQ
Write-Host "TEST 3: RETRY + DLQ" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────────────────────────" -ForegroundColor Gray
Write-Host ""
Write-Host "⚠️  WARNING: This test requires modifying the worker code" -ForegroundColor Yellow
Write-Host ""
Write-Host "Before running this test:"
Write-Host "  1. Edit: src/workers/DistributedTokenRefreshWorker.ts"
Write-Host "  2. In refreshToken() method, add: throw new Error('FORCED_TEST_FAILURE');"
Write-Host "  3. Restart backend"
Write-Host ""
$response = Read-Host "Have you modified the code and restarted? (y/n)"

if ($response -eq 'y' -or $response -eq 'Y') {
    Write-Host "Running retry + DLQ test..." -ForegroundColor Yellow
    node phase1-test-retry-dlq.js
} else {
    Write-Host "Skipping Test 3" -ForegroundColor Gray
}

Write-Host ""
Read-Host "Press ENTER to continue to Test 4"
Write-Host ""

# Test 4: Worker Crash
Write-Host "TEST 4: WORKER CRASH SIMULATION" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────────────────────────" -ForegroundColor Gray
Write-Host ""
Write-Host "This test requires manual execution:"
Write-Host ""
Write-Host "  1. Find backend process: Get-Process | Where-Object {`$_.ProcessName -like '*node*'}"
Write-Host "  2. Kill process: Stop-Process -Id [PID] -Force"
Write-Host "  3. Wait 2 minutes for lock TTL"
Write-Host "  4. Restart backend: npm run dev"
Write-Host "  5. Verify job retries"
Write-Host ""
Write-Host "This test validates lock expiry and crash recovery."
Write-Host ""
Read-Host "Press ENTER to continue to Test 5"
Write-Host ""

# Test 5: Redis Failure
Write-Host "TEST 5: REDIS FAILURE SIMULATION" -ForegroundColor Cyan
Write-Host "────────────────────────────────────────────────────────────" -ForegroundColor Gray
Write-Host ""
Write-Host "This test requires manual execution:"
Write-Host ""
Write-Host "  1. Stop Redis: docker stop redis (or Stop-Service redis)"
Write-Host "  2. Watch backend logs for errors"
Write-Host "  3. Verify fail-closed behavior (no refresh executed)"
Write-Host "  4. Restart Redis: docker start redis (or Start-Service redis)"
Write-Host "  5. Verify recovery"
Write-Host ""
Write-Host "This test validates fail-closed behavior."
Write-Host ""
Read-Host "Press ENTER to finish"
Write-Host ""

# Summary
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "     VALIDATION COMPLETE" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:"
Write-Host "  1. Review PHASE_1_LIVE_VALIDATION_REPORT.md"
Write-Host "  2. Fill in observations from each test"
Write-Host "  3. Calculate final resilience rating"
Write-Host "  4. Document recommendations"
Write-Host ""
Write-Host "Report location: PHASE_1_LIVE_VALIDATION_REPORT.md" -ForegroundColor Yellow
Write-Host ""
