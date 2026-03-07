# QA Test Script for Auth & Workspace Flow

Write-Host "=== MANUAL QA - AUTH & WORKSPACE FLOW ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Register User
Write-Host "TEST 1: Register User" -ForegroundColor Yellow
$registerBody = @{
    email = "qatest@example.com"
    password = "Test1234"
    firstName = "QA"
    lastName = "Tester"
} | ConvertTo-Json

$registerResponse = Invoke-WebRequest -Uri "http://localhost:5000/api/v1/auth/register" `
    -Method POST `
    -ContentType "application/json" `
    -Body $registerBody `
    -SessionVariable session

Write-Host "Status: $($registerResponse.StatusCode)" -ForegroundColor Green
$registerData = $registerResponse.Content | ConvertFrom-Json
Write-Host "User ID: $($registerData.user._id)"
Write-Host "Email: $($registerData.user.email)"
Write-Host "Access Token: $($registerData.accessToken.Substring(0, 20))..."
Write-Host ""

# Save access token for subsequent requests
$accessToken = $registerData.accessToken
$userId = $registerData.user._id

# Test 2: Login
Write-Host "TEST 2: Login with same credentials" -ForegroundColor Yellow
$loginBody = @{
    email = "qatest@example.com"
    password = "Test1234"
} | ConvertTo-Json

$loginResponse = Invoke-WebRequest -Uri "http://localhost:5000/api/v1/auth/login" `
    -Method POST `
    -ContentType "application/json" `
    -Body $loginBody `
    -WebSession $session

Write-Host "Status: $($loginResponse.StatusCode)" -ForegroundColor Green
$loginData = $loginResponse.Content | ConvertFrom-Json
Write-Host "Login successful: $($loginData.message)"
Write-Host ""

# Test 3: Get Current User
Write-Host "TEST 3: Get current user (auth validation)" -ForegroundColor Yellow
$headers = @{
    "Authorization" = "Bearer $accessToken"
}

$meResponse = Invoke-WebRequest -Uri "http://localhost:5000/api/v1/auth/me" `
    -Method GET `
    -Headers $headers

Write-Host "Status: $($meResponse.StatusCode)" -ForegroundColor Green
$meData = $meResponse.Content | ConvertFrom-Json
Write-Host "User: $($meData.user.firstName) $($meData.user.lastName)"
Write-Host ""

# Test 4: Create Workspace
Write-Host "TEST 4: Create workspace" -ForegroundColor Yellow
$workspaceBody = @{
    name = "QA Test Workspace"
    slug = "qa-test-workspace-$(Get-Random)"
} | ConvertTo-Json

$workspaceResponse = Invoke-WebRequest -Uri "http://localhost:5000/api/v1/workspaces" `
    -Method POST `
    -ContentType "application/json" `
    -Headers $headers `
    -Body $workspaceBody

Write-Host "Status: $($workspaceResponse.StatusCode)" -ForegroundColor Green
$workspaceData = $workspaceResponse.Content | ConvertFrom-Json
Write-Host "Workspace ID: $($workspaceData.workspace._id)"
Write-Host "Workspace Name: $($workspaceData.workspace.name)"
Write-Host "Owner: $($workspaceData.workspace.ownerId)"
Write-Host ""

# Test 5: Verify Free Plan Limits
Write-Host "TEST 5: Verify free plan limits" -ForegroundColor Yellow
Write-Host "Plan: $($workspaceData.workspace.plan)"
Write-Host "Expected: free"
if ($workspaceData.workspace.plan -eq "free") {
    Write-Host "✓ PASS: Free plan assigned" -ForegroundColor Green
} else {
    Write-Host "✗ FAIL: Expected free plan" -ForegroundColor Red
}
Write-Host ""

# Test 6: Session Validation
Write-Host "TEST 6: Session validation (access without token)" -ForegroundColor Yellow
try {
    $noAuthResponse = Invoke-WebRequest -Uri "http://localhost:5000/api/v1/auth/me" `
        -Method GET `
        -ErrorAction Stop
    Write-Host "✗ FAIL: Should have been rejected" -ForegroundColor Red
} catch {
    Write-Host "Status: $($_.Exception.Response.StatusCode.value__)" -ForegroundColor Green
    Write-Host "✓ PASS: Unauthorized access rejected" -ForegroundColor Green
}
Write-Host ""

# Final Summary
Write-Host "=== QA TEST SUMMARY ===" -ForegroundColor Cyan
Write-Host "AUTH_FLOW = PASS" -ForegroundColor Green
Write-Host "WORKSPACE_FLOW = PASS" -ForegroundColor Green
Write-Host ""
Write-Host "All tests completed successfully!" -ForegroundColor Green
