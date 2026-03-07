# Test Graceful Shutdown
# This script tests the graceful shutdown implementation

Write-Host "=== Testing Graceful Shutdown ===" -ForegroundColor Cyan
Write-Host ""

# Check if MongoDB is running
Write-Host "Checking MongoDB..." -ForegroundColor Yellow
$mongoRunning = docker ps --filter "name=mongodb" --filter "status=running" --format "{{.Names}}"
if (-not $mongoRunning) {
    Write-Host "❌ MongoDB is not running. Starting MongoDB..." -ForegroundColor Red
    docker run -d --name mongodb -p 27017:27017 mongo:latest
    Start-Sleep -Seconds 5
} else {
    Write-Host "✅ MongoDB is running" -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting server..." -ForegroundColor Yellow
Write-Host "The server will start and you should see startup logs." -ForegroundColor Gray
Write-Host "Press Ctrl+C to trigger graceful shutdown." -ForegroundColor Gray
Write-Host ""

# Start the server
$env:NODE_ENV = "development"
npm run dev

# Note: When user presses Ctrl+C, the graceful shutdown will be triggered
# Expected output:
# SIGINT received. Starting graceful shutdown...
# Closing Express server...
# ✅ Express server closed
# Stopping scheduler service...
# ✅ Scheduler service stopped
# Disconnecting Redis...
# ✅ Redis disconnected
# Disconnecting MongoDB...
# ✅ MongoDB disconnected
# ✅ Graceful shutdown completed successfully
